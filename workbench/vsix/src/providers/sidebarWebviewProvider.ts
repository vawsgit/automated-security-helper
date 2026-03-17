import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import type { WebviewToExtMessage } from '../models/messages';
import type { ScannerService } from '../services/scanner';
import type { FindingsService } from '../services/findings';
import type { FindingsPanelManager } from './findingsPanelManager';
import type { SinkPanelManager } from './sinkPanelManager';
import type { ScanTreeProvider } from './scanTreeProvider';

export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ashWorkbench.mainView';
  private view?: vscode.WebviewView;
  private findingsPanelManager?: FindingsPanelManager;
  private sinkPanelManager?: SinkPanelManager;
  private scanner?: ScannerService;
  private scanTreeProvider?: ScanTreeProvider;
  private findingsService?: FindingsService;

  constructor(
    private readonly extensionUri: vscode.Uri,
  ) {}

  setFindingsPanelManager(manager: FindingsPanelManager): void {
    this.findingsPanelManager = manager;
  }

  setSinkPanelManager(manager: SinkPanelManager): void {
    this.sinkPanelManager = manager;
  }

  setScanner(scanner: ScannerService): void {
    this.scanner = scanner;
  }

  setScanTreeProvider(provider: ScanTreeProvider): void {
    this.scanTreeProvider = provider;
  }

  setFindingsService(service: FindingsService): void {
    this.findingsService = service;
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

  postProgress(scanId: string, elapsed: number, status: string): void {
    this.view?.webview.postMessage({
      type: 'scanProgress',
      payload: { scanId, elapsed, status },
    });
  }

  private async queryStateAndPost(): Promise<void> {
    if (!this.findingsService) {
      return;
    }
    const scans = await this.findingsService.getScanSummaries();
    const summary = await this.findingsService.getSummary();
    const scanTargets = await this.findingsService.getScanTargets();
    this.view?.webview.postMessage({
      type: 'stateUpdate',
      payload: { scans, summary, scanTargets },
    });
  }

  private handleMessage(message: WebviewToExtMessage): void {
    switch (message.type) {
      case 'requestState': {
        this.view?.webview.postMessage({ type: 'init', payload: { context: 'sidebar' } });
        this.queryStateAndPost();
        break;
      }
      case 'startScan':
        this.handleStartScan();
        break;
      case 'openFindings':
        if (this.findingsPanelManager) {
          this.findingsPanelManager.showFindings(message.payload.scanId);
        }
        break;
      case 'openSink':
        if (this.sinkPanelManager) {
          this.sinkPanelManager.show();
        }
        break;
      case 'deleteScan':
        this.handleDeleteScan(message.payload.scanId);
        break;
    }
  }

  private async handleDeleteScan(scanId: string): Promise<void> {
    if (this.findingsService) {
      try {
        await this.findingsService.deleteScan(scanId);
        await this.queryStateAndPost();
        this.scanTreeProvider?.refresh();
      } catch (err) {
        console.error('[ASH] Failed to delete scan:', err);
      }
    }
  }

  private async handleStartScan(): Promise<void> {
    if (!this.scanner) {
      vscode.window.showWarningMessage('ASH: Scanner not available');
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showWarningMessage('ASH: No workspace folder open');
      return;
    }

    // Open findings panel immediately
    if (this.findingsPanelManager) {
      this.findingsPanelManager.showScanning('pending', workspaceRoot);
    }

    try {
      const result = await this.scanner.startScan({ targetPath: workspaceRoot }, (progress) => {
        const scanId = this.scanner?.getCurrentScanId() ?? '';
        this.postProgress(scanId, progress.elapsed, progress.statusText);
        if (this.findingsPanelManager) {
          this.findingsPanelManager.postProgress(scanId, progress.elapsed, progress.statusText);
        }
      });

      // On completion, push updated findings to panel
      if (this.findingsPanelManager && this.findingsService) {
        const findings = await this.findingsService.getFindings(result.scanId);
        this.findingsPanelManager.postFindingsUpdate(result.scanId, findings);
      }

      // Refresh sidebar and tree
      await this.queryStateAndPost();
      this.scanTreeProvider?.refresh();

      if (result.status === 'FAILED' && result.errorMessage) {
        vscode.window.showErrorMessage(`ASH Scan failed: ${result.errorMessage}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already in progress')) {
        vscode.window.showWarningMessage(message);
      } else {
        vscode.window.showErrorMessage(`ASH Scan error: ${message}`);
      }
    }
  }
}
