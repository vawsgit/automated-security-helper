import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import type { WebviewToExtMessage } from '../models/messages';
import type { FindingRow } from '../models/types';
import type { ScannerService } from '../services/scanner';
import type { FindingsService } from '../services/findings';

export class FindingsPanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private scanner: ScannerService | undefined;
  private findingsService: FindingsService | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
  ) {}

  setScanner(scanner: ScannerService): void {
    this.scanner = scanner;
  }

  setFindingsService(service: FindingsService): void {
    this.findingsService = service;
  }

  public showFindings(scanId: string, targetPath?: string): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.webview.postMessage({
        type: 'init',
        payload: { context: 'editorPanel', scanId },
      });
      if (targetPath) {
        this.panel.webview.postMessage({
          type: 'scanStarted',
          payload: { scanId, targetPath },
        });
      }
      return;
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
      this.handleMessage(message, scanId);
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    if (targetPath) {
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

  private async postStateUpdate(): Promise<void> {
    if (!this.findingsService) {
      return;
    }
    const scans = await this.findingsService.getScanSummaries();
    const summary = await this.findingsService.getSummary();
    const scanTargets = await this.findingsService.getScanTargets();
    this.panel?.webview.postMessage({
      type: 'stateUpdate',
      payload: { scans, summary, scanTargets },
    });
  }

  public showScanning(scanId: string, targetPath: string): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.webview.postMessage({
        type: 'scanStarted',
        payload: { scanId, targetPath },
      });
      return;
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
      this.handleMessage(message, scanId);
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    setTimeout(() => {
      this.panel?.webview.postMessage({
        type: 'scanStarted',
        payload: { scanId, targetPath },
      });
    }, 500);
  }

  private async handleMessage(message: WebviewToExtMessage, currentScanId: string): Promise<void> {
    switch (message.type) {
      case 'requestState': {
        this.panel?.webview.postMessage({
          type: 'init',
          payload: { context: 'editorPanel', scanId: currentScanId },
        });
        if (this.findingsService) {
          const findings = await this.findingsService.getFindings(currentScanId);
          this.panel?.webview.postMessage({
            type: 'findingsUpdate',
            payload: { scanId: currentScanId, findings },
          });
          await this.postStateUpdate();
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
          const targetPath = message.payload.targetPath;
          this.panel?.webview.postMessage({
            type: 'scanStarted',
            payload: { scanId: 'pending', targetPath },
          });
          try {
            const result = await this.scanner.startScan({ targetPath }, (progress) => {
              const scanId = this.scanner?.getCurrentScanId() ?? '';
              this.postProgress(scanId, progress.elapsed, progress.statusText);
            });
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
          const findings = await this.findingsService.getFindings(scanId, filters);
          this.postFindingsUpdate(scanId, findings);
        }
        break;
      }
      case 'cancelScan': {
        if (this.scanner) {
          await this.scanner.cancelScan(message.payload.scanId);
        }
        break;
      }
      case 'navigateToCode': {
        const filePath = message.payload.filePath;
        const uri = vscode.Uri.file(filePath);
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
