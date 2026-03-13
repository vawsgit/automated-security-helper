import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import type { WebviewToExtMessage } from '../models/messages';
import { getMockScans, getMockSummary } from '../mock/data';
import type { FindingsPanelManager } from './findingsPanelManager';

export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ashWorkbench.mainView';
  private view?: vscode.WebviewView;
  private findingsPanelManager?: FindingsPanelManager;

  constructor(private readonly extensionUri: vscode.Uri) {}

  setFindingsPanelManager(manager: FindingsPanelManager): void {
    this.findingsPanelManager = manager;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'webview-dist')],
    };

    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage((message: WebviewToExtMessage) => {
      this.handleMessage(message);
    });
  }

  private handleMessage(message: WebviewToExtMessage): void {
    switch (message.type) {
      case 'requestState': {
        // Send init first so the webview knows its context, then send state
        this.view?.webview.postMessage({ type: 'init', payload: { context: 'sidebar' } });
        const scans = getMockScans();
        const summary = getMockSummary();
        this.view?.webview.postMessage({ type: 'stateUpdate', payload: { scans, summary } });
        break;
      }
      case 'startScan':
        vscode.window.showInformationMessage('ASH: Scan started (mock)');
        break;
      case 'openFindings':
        if (this.findingsPanelManager) {
          this.findingsPanelManager.showFindings(message.payload.scanId);
        }
        break;
    }
  }
}
