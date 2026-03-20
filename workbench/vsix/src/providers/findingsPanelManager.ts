import * as vscode from 'vscode';
import * as path from 'path';
import { getWebviewHtml } from './webviewHtml';
import type { WebviewToExtMessage } from '../models/messages';
import type { FindingRow, AshYamlConfigSummary } from '../models/types';
import type { ScannerService } from '../services/scanner';
import type { FindingsService } from '../services/findings';
import type { ScanTreeProvider } from './scanTreeProvider';
import type { ScanRootService } from '../services/scanRoot';
import type { AshYamlService } from '../services/ashYaml';
import type { AshYamlWriteService } from '../services/ashYamlWrite';
import type { PrismaClient } from '@prisma/client';
import { AdminService } from '../services/admin';

export class FindingsPanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private currentScanId = '';
  private scanner: ScannerService | undefined;
  private findingsService: FindingsService | undefined;
  private scanTreeProvider: ScanTreeProvider | undefined;
  private scanRootService: ScanRootService | undefined;
  private ashYamlService: AshYamlService | undefined;
  private ashYamlWriteService: AshYamlWriteService | undefined;
  private adminDeps: { db: PrismaClient; extensionVersion: string; storagePath: string } | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
  ) {}

  setAdminDeps(deps: { db: PrismaClient; extensionVersion: string; storagePath: string }): void {
    this.adminDeps = deps;
  }

  setScanner(scanner: ScannerService): void {
    this.scanner = scanner;
  }

  setFindingsService(service: FindingsService): void {
    this.findingsService = service;
  }

  setScanTreeProvider(provider: ScanTreeProvider): void {
    this.scanTreeProvider = provider;
  }

  setScanRootService(service: ScanRootService): void {
    this.scanRootService = service;
  }

  setAshYamlService(service: AshYamlService): void {
    this.ashYamlService = service;
  }

  setAshYamlWriteService(service: AshYamlWriteService): void {
    this.ashYamlWriteService = service;
  }

  /**
   * Returns true if a new panel was created, false if existing panel was revealed.
   */
  private ensurePanel(): boolean {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return false;
    }

    this.panel = vscode.window.createWebviewPanel(
      'ashWorkbench.findingsPanel',
      'ASH Findings',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'webview-dist')],
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri);

    this.panel.webview.onDidReceiveMessage((message: WebviewToExtMessage) => {
      this.handleMessage(message);
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    return true;
  }

  public showDashboard(): void {
    this.currentScanId = '';
    const isNew = this.ensurePanel();
    if (!isNew) {
      this.panel!.webview.postMessage({
        type: 'init',
        payload: { context: 'editorPanel', scanId: '' },
      });
      this.postStateUpdate();
    }
  }

  public showFindings(scanId: string, targetPath?: string): void {
    this.currentScanId = scanId;
    const isNew = this.ensurePanel();

    if (!isNew) {
      this.panel!.webview.postMessage({
        type: 'init',
        payload: { context: 'editorPanel', scanId },
      });
      if (targetPath) {
        this.panel!.webview.postMessage({
          type: 'scanStarted',
          payload: { scanId, targetPath },
        });
      }
      if (scanId && this.findingsService) {
        this.findingsService.getFindings(scanId).then(findings => {
          this.postFindingsUpdate(scanId, findings);
        });
      }
      this.postStateUpdate();
    } else if (targetPath) {
      setTimeout(() => {
        this.panel?.webview.postMessage({
          type: 'scanStarted',
          payload: { scanId, targetPath },
        });
      }, 500);
    }
  }

  public postProgress(scanId: string, elapsed: number, status: string): void {
    this.panel?.webview.postMessage({
      type: 'scanProgress',
      payload: { scanId, elapsed, status },
    });
  }

  public postFindingsUpdate(scanId: string, findings: FindingRow[]): void {
    this.panel?.webview.postMessage({
      type: 'findingsUpdate',
      payload: { scanId, findings },
    });
  }

  async postStateUpdate(): Promise<void> {
    if (!this.findingsService) {
      return;
    }
    const filter = this.scanRootService?.buildPathFilter();
    const scans = await this.findingsService.getScanSummaries(filter);
    const summary = await this.findingsService.getSummary(filter);
    const scanTargets = await this.findingsService.getScanTargets(filter);
    const scanRoot = this.scanRootService?.getEffectiveScanRoot() ?? '';
    this.panel?.webview.postMessage({
      type: 'stateUpdate',
      payload: { scans, summary, scanTargets, scanRoot },
    });
  }

  async postCurrentFindingsUpdate(): Promise<void> {
    if (!this.findingsService || !this.scanRootService || !this.ashYamlService) {
      return;
    }
    const result = await this.findingsService.getCurrentFindings(this.scanRootService, this.ashYamlService);
    if (result) {
      this.panel?.webview.postMessage({
        type: 'currentFindingsUpdate',
        payload: {
          findings: result.findings,
          suppressionSummary: result.summary,
          scanId: result.scanId,
          lastScannedAt: result.lastScannedAt,
        },
      });
    }
  }

  async refreshCurrentFindings(): Promise<void> {
    await this.postCurrentFindingsUpdate();
    // If viewing a historical scan, re-overlay suppression data
    if (this.currentScanId && this.findingsService && this.ashYamlService) {
      const findings = await this.findingsService.getFindingsWithSuppressionOverlay(
        this.currentScanId, this.ashYamlService,
      );
      this.postFindingsUpdate(this.currentScanId, findings);
    }
  }

  public showSuppressionManager(): void {
    const isNew = this.ensurePanel();
    if (!isNew) {
      this.panel!.webview.postMessage({
        type: 'init',
        payload: { context: 'editorPanel', scanId: '' },
      });
    }
    // Defer initial data request to let the panel initialize
    setTimeout(() => {
      this.panel?.webview.postMessage({
        type: 'init',
        payload: { context: 'editorPanel', scanId: '' },
      });
      // The webview will request suppressions after receiving init
    }, isNew ? 500 : 50);
  }

  postAshYamlChanged(config: AshYamlConfigSummary): void {
    this.panel?.webview.postMessage({
      type: 'ashYamlChanged',
      payload: { config },
    });
  }

  public showScanning(scanId: string, targetPath: string): void {
    this.currentScanId = scanId;
    const isNew = this.ensurePanel();
    if (!isNew) {
      this.panel!.webview.postMessage({
        type: 'scanStarted',
        payload: { scanId, targetPath },
      });
    } else {
      setTimeout(() => {
        this.panel?.webview.postMessage({
          type: 'scanStarted',
          payload: { scanId, targetPath },
        });
      }, 500);
    }
  }

  private async handleMessage(message: WebviewToExtMessage): Promise<void> {
    switch (message.type) {
      case 'requestState': {
        this.panel?.webview.postMessage({
          type: 'init',
          payload: { context: 'editorPanel', scanId: this.currentScanId },
        });
        if (this.findingsService) {
          if (this.currentScanId) {
            const findings = await this.findingsService.getFindings(this.currentScanId);
            this.panel?.webview.postMessage({
              type: 'findingsUpdate',
              payload: { scanId: this.currentScanId, findings },
            });
          }
          await this.postStateUpdate();
          await this.postCurrentFindingsUpdate();
        }
        break;
      }
      case 'requestCurrentFindings': {
        await this.postCurrentFindingsUpdate();
        break;
      }
      case 'selectScan': {
        if (this.findingsService) {
          const scanId = message.payload.scanId;
          this.currentScanId = scanId;
          const findings = this.ashYamlService
            ? await this.findingsService.getFindingsWithSuppressionOverlay(scanId, this.ashYamlService)
            : await this.findingsService.getFindings(scanId);
          this.postFindingsUpdate(scanId, findings);
        }
        break;
      }
      case 'selectScanTarget': {
        if (this.findingsService) {
          const findings = await this.findingsService.getFindingsByScanTarget(message.payload.scanTargetId);
          this.panel?.webview.postMessage({
            type: 'findingsUpdate',
            payload: { scanId: '', findings },
          });
        }
        break;
      }
      case 'selectFinding': {
        if (this.findingsService) {
          const detail = await this.findingsService.getFindingDetail(message.payload.findingId);
          if (detail) {
            this.panel?.webview.postMessage({ type: 'findingDetail', payload: detail });
          }
        }
        break;
      }
      case 'setDisposition': {
        if (this.findingsService) {
          try {
            const updated = await this.findingsService.setDisposition(
              message.payload.findingId,
              message.payload.disposition,
            );
            this.panel?.webview.postMessage({
              type: 'dispositionUpdated',
              payload: { findingId: updated.id, disposition: updated.disposition },
            });
            await this.postStateUpdate();
          } catch (err) {
            console.error('[ASH] Failed to update disposition:', err);
          }
        }
        break;
      }
      case 'setNotes': {
        if (this.findingsService) {
          try {
            const updated = await this.findingsService.setNotes(
              message.payload.findingId,
              message.payload.notes,
            );
            this.panel?.webview.postMessage({
              type: 'notesUpdated',
              payload: { findingId: updated.id, notes: updated.notes },
            });
          } catch (err) {
            console.error('[ASH] Failed to update notes:', err);
          }
        }
        break;
      }
      case 'startScan': {
        if (this.scanner) {
          const targetPath = this.scanRootService?.getEffectiveScanRoot()
            ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
          this.panel?.webview.postMessage({
            type: 'scanStarted',
            payload: { scanId: 'pending', targetPath },
          });
          try {
            const result = await this.scanner.startScan({ targetPath }, (progress) => {
              const scanId = this.scanner?.getCurrentScanId() ?? '';
              this.postProgress(scanId, progress.elapsed, progress.statusText);
            });
            this.currentScanId = result.scanId;
            if (this.findingsService) {
              const findings = await this.findingsService.getFindings(result.scanId);
              this.postFindingsUpdate(result.scanId, findings);
            }
            if (result.status === 'FAILED' && result.errorMessage) {
              vscode.window.showErrorMessage(`ASH Scan failed: ${result.errorMessage}`);
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.includes('already in progress')) {
              vscode.window.showWarningMessage(errMsg);
            } else {
              vscode.window.showErrorMessage(`ASH Scan error: ${errMsg}`);
            }
          }
        }
        break;
      }
      case 'applyFilters': {
        if (this.findingsService) {
          const { scanId, filters } = message.payload;
          const findings = this.ashYamlService
            ? await this.findingsService.getFindingsWithSuppressionOverlay(scanId, this.ashYamlService, filters)
            : await this.findingsService.getFindings(scanId, filters);
          this.postFindingsUpdate(scanId, findings);
        }
        break;
      }
      case 'deleteScan': {
        if (this.findingsService) {
          try {
            await this.findingsService.deleteScan(message.payload.scanId);
            await this.postStateUpdate();
            this.scanTreeProvider?.refresh();
          } catch (err) {
            console.error('[ASH] Failed to delete scan:', err);
          }
        }
        break;
      }
      case 'cancelScan': {
        if (this.scanner) {
          await this.scanner.cancelScan(message.payload.scanId);
        }
        break;
      }
      case 'resetApplication': {
        if (this.adminDeps) {
          if (this.scanner?.getCurrentScanId()) {
            vscode.window.showWarningMessage('ASH: Cannot reset while a scan is running. Cancel the scan first.');
            break;
          }
          const confirm = await vscode.window.showWarningMessage(
            'This will permanently delete all scans, findings, and triage data. This cannot be undone.',
            { modal: true },
            'Reset',
          );
          if (confirm === 'Reset') {
            try {
              await AdminService.resetApplication(this.adminDeps.storagePath);
              await vscode.commands.executeCommand('workbench.action.reloadWindow');
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage(`ASH: Reset failed: ${msg}`);
            }
          }
        }
        break;
      }
      case 'requestApplicationInfo': {
        if (this.adminDeps) {
          try {
            const info = await AdminService.getApplicationInfo(
              this.adminDeps.db,
              this.adminDeps.extensionVersion,
            );
            this.panel?.webview.postMessage({ type: 'applicationInfo', payload: info });
          } catch (err) {
            console.error('[ASH] Failed to get application info:', err);
          }
        }
        break;
      }
      case 'openSettings': {
        vscode.commands.executeCommand('workbench.action.openSettings', 'ashWorkbench');
        break;
      }
      case 'suppressFinding': {
        if (this.ashYamlWriteService) {
          const result = await this.ashYamlWriteService.addSuppression(message.payload);
          this.panel?.webview.postMessage({ type: 'suppressionResult', payload: result });
        }
        break;
      }
      case 'unsuppressFinding': {
        if (this.ashYamlWriteService && this.findingsService && this.scanRootService && this.ashYamlService) {
          // Get current findings with suppression overlay to find the matching suppression
          const currentResult = await this.findingsService.getCurrentFindings(this.scanRootService, this.ashYamlService);
          const findings = currentResult?.findings ?? [];
          const result = await this.ashYamlWriteService.removeSuppression(
            message.payload.findingId,
            findings,
          );
          this.panel?.webview.postMessage({ type: 'suppressionResult', payload: result });
        }
        break;
      }
      case 'requestSuppressions': {
        if (this.ashYamlService && this.findingsService && this.scanRootService) {
          const currentResult = await this.findingsService.getCurrentFindings(this.scanRootService, this.ashYamlService);
          const findings = currentResult?.findings ?? [];
          const suppressions = this.ashYamlService.getSuppressionStatuses(findings);
          const config = this.ashYamlService.getConfig();
          const ignorePaths = config.ignorePaths;
          const configInfo: AshYamlConfigSummary = {
            suppressionCount: config.suppressions.length,
            ignorePathCount: config.ignorePaths.length,
            severityThreshold: config.severityThreshold,
            projectName: config.projectName || null,
            enabledScanners: config.scanners.filter(s => s.enabled).map(s => s.name),
          };
          this.panel?.webview.postMessage({
            type: 'suppressionsUpdate',
            payload: { suppressions, ignorePaths, configInfo },
          });
        }
        break;
      }
      case 'editSuppression': {
        if (this.ashYamlWriteService) {
          const result = await this.ashYamlWriteService.updateSuppression(
            message.payload.old,
            message.payload.updated,
          );
          this.panel?.webview.postMessage({ type: 'suppressionWriteResult', payload: result });
        }
        break;
      }
      case 'removeSuppression': {
        if (this.ashYamlWriteService) {
          const result = await this.ashYamlWriteService.removeSuppressionRule(message.payload.suppression);
          this.panel?.webview.postMessage({ type: 'suppressionWriteResult', payload: result });
        }
        break;
      }
      case 'addSuppression': {
        if (this.ashYamlWriteService) {
          const result = await this.ashYamlWriteService.addSuppressionDirect(message.payload.suppression);
          this.panel?.webview.postMessage({ type: 'suppressionWriteResult', payload: result });
        }
        break;
      }
      case 'navigateToCode': {
        const filePath = message.payload.filePath;
        const workspaceRoot = this.scanRootService?.getEffectiveScanRoot()
          ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const absolutePath = workspaceRoot && !filePath.startsWith('/')
          ? path.join(workspaceRoot, filePath)
          : filePath;
        const uri = vscode.Uri.file(absolutePath);
        const range = new vscode.Range(
          message.payload.startLine - 1, 0,
          message.payload.startLine - 1, 0
        );
        vscode.workspace.fs.stat(uri).then(
          () => {
            vscode.window.showTextDocument(uri, { selection: range });
          },
          () => {
            vscode.window.showInformationMessage(`File not found: ${filePath}`);
          }
        );
        break;
      }
    }
  }
}
