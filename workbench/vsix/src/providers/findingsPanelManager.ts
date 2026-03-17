import * as vscode from 'vscode';
import type { PrismaClient } from '@prisma/client';
import { getWebviewHtml } from './webviewHtml';
import type { WebviewToExtMessage } from '../models/messages';
import type { FindingRow } from '../models/types';
import { mapFindingToRow } from '../models/mappers';
import type { ScannerService } from '../services/scanner';

export class FindingsPanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private scanner: ScannerService | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly db: PrismaClient,
  ) {}

  setScanner(scanner: ScannerService): void {
    this.scanner = scanner;
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
        const findings = await this.db.finding.findMany({
          where: { scanId: currentScanId },
        });
        this.panel?.webview.postMessage({
          type: 'findingsUpdate',
          payload: { scanId: currentScanId, findings: findings.map(mapFindingToRow) },
        });
        break;
      }
      case 'selectFinding': {
        const finding = await this.db.finding.findUnique({
          where: { id: message.payload.findingId },
        });
        if (finding) {
          this.panel?.webview.postMessage({ type: 'findingDetail', payload: mapFindingToRow(finding) });
        }
        break;
      }
      case 'setDisposition': {
        try {
          const updated = await this.db.finding.update({
            where: { id: message.payload.findingId },
            data: { disposition: message.payload.disposition },
          });
          this.panel?.webview.postMessage({
            type: 'dispositionUpdated',
            payload: { findingId: updated.id, disposition: updated.disposition },
          });
        } catch (err) {
          console.error('[ASH] Failed to update disposition:', err);
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
            const findings = await this.db.finding.findMany({ where: { scanId: result.scanId } });
            this.postFindingsUpdate(result.scanId, findings.map(mapFindingToRow));
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
