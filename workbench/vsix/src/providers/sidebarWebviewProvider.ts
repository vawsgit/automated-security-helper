import * as vscode from 'vscode';
import type { PrismaClient, Project } from '@prisma/client';
import { getWebviewHtml } from './webviewHtml';
import type { WebviewToExtMessage } from '../models/messages';
import type { ScanSummary, DispositionSummary } from '../models/types';
import { mapScanToSummary } from '../models/mappers';
import { mapFindingToRow } from '../models/mappers';
import type { ScannerService } from '../services/scanner';
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

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly db: PrismaClient,
    private readonly project: Project,
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

  postStateUpdate(scans: ScanSummary[], summary: DispositionSummary): void {
    this.view?.webview.postMessage({ type: 'stateUpdate', payload: { scans, summary } });
  }

  private async queryStateAndPost(): Promise<void> {
    const scans = await this.db.scan.findMany({
      where: { projectId: this.project.id },
      orderBy: { startedAt: 'desc' },
    });
    const totalFindings = await this.db.finding.count({
      where: { projectId: this.project.id },
    });
    const summary: DispositionSummary = {
      total: totalFindings,
      counts: { PENDING: totalFindings, FIX: 0, SUPPRESS: 0, DEFER: 0 },
    };
    this.view?.webview.postMessage({
      type: 'stateUpdate',
      payload: { scans: scans.map(mapScanToSummary), summary },
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
      if (this.findingsPanelManager) {
        const findings = await this.db.finding.findMany({ where: { scanId: result.scanId } });
        this.findingsPanelManager.postFindingsUpdate(result.scanId, findings.map(mapFindingToRow));
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
