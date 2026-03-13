import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';

export class SinkPanelManager {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.webview.postMessage({ type: 'init', payload: { context: 'sink' } });
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'ashWorkbench.kitchenSink',
      'ASH Kitchen Sink',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'webview-dist')],
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri);
    this.panel.webview.onDidReceiveMessage(() => {
      this.panel?.webview.postMessage({ type: 'init', payload: { context: 'sink' } });
    });
    this.panel.onDidDispose(() => { this.panel = undefined; });
  }
}
