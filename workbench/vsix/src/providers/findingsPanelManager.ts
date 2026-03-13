import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import type { WebviewToExtMessage } from '../models/messages';
import { getMockFindings, getMockFindingDetail, updateDisposition } from '../mock/data';

export class FindingsPanelManager {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public showFindings(scanId: string): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.webview.postMessage({
        type: 'init',
        payload: { context: 'editorPanel', scanId },
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

    // Small delay to ensure the webview is ready
    setTimeout(() => {
      this.panel?.webview.postMessage({
        type: 'init',
        payload: { context: 'editorPanel', scanId },
      });
    }, 100);

    this.panel.webview.onDidReceiveMessage((message: WebviewToExtMessage) => {
      this.handleMessage(message, scanId);
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private handleMessage(message: WebviewToExtMessage, currentScanId: string): void {
    switch (message.type) {
      case 'requestState': {
        const findings = getMockFindings(currentScanId);
        this.panel?.webview.postMessage({
          type: 'findingsUpdate',
          payload: { scanId: currentScanId, findings },
        });
        break;
      }
      case 'selectFinding': {
        const finding = getMockFindingDetail(message.payload.findingId);
        if (finding) {
          this.panel?.webview.postMessage({ type: 'findingDetail', payload: finding });
        }
        break;
      }
      case 'setDisposition': {
        const updated = updateDisposition(message.payload.findingId, message.payload.disposition);
        if (updated) {
          this.panel?.webview.postMessage({
            type: 'dispositionUpdated',
            payload: { findingId: updated.id, disposition: updated.disposition },
          });
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
            vscode.window.showInformationMessage(
              `File not found: ${filePath} (mock data — file does not exist)`
            );
          }
        );
        break;
      }
    }
  }
}
