import * as vscode from 'vscode';
import { registerAllCommands } from './commands/index';
import { DatabaseService } from './services/database';
import { ensureProject } from './services/project';
import { ScannerService } from './services/scanner';
import { ScanTreeProvider } from './providers/scanTreeProvider';
import { SidebarWebviewProvider } from './providers/sidebarWebviewProvider';
import { FindingsPanelManager } from './providers/findingsPanelManager';
import { SinkPanelManager } from './providers/sinkPanelManager';
import { FindingsService } from './services/findings';
import { ScanRootService } from './services/scanRoot';
import { AshYamlService } from './services/ashYaml';
import { AdminService } from './services/admin';

export async function activate(context: vscode.ExtensionContext) {
  console.log('[ASH] Activating ASH Workbench extension');

  // FR-005 / FR-009: Check workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showInformationMessage(
      'ASH Workbench requires a workspace folder. Please open a folder to get started.',
    );
    return;
  }

  // FR-001: Initialize database with migration error handling (FR-011, FR-012)
  let db;
  try {
    db = await DatabaseService.initialize(context.globalStorageUri.fsPath);
  } catch (err) {
    console.error('[ASH] Database initialization failed:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    const choice = await vscode.window.showErrorMessage(
      `ASH Workbench: Database initialization failed. ${errMsg}`,
      'Retry',
      'Reset Application',
    );
    if (choice === 'Retry') {
      try {
        db = await DatabaseService.initialize(context.globalStorageUri.fsPath);
      } catch (retryErr) {
        console.error('[ASH] Database retry failed:', retryErr);
        vscode.window.showErrorMessage('ASH Workbench: Database initialization failed after retry.');
        return;
      }
    } else if (choice === 'Reset Application') {
      try {
        await AdminService.resetApplication(context.globalStorageUri.fsPath);
      } catch {
        // Best-effort reset
      }
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
      return;
    } else {
      return;
    }
  }

  // FR-002 / FR-003 / FR-004: Ensure project record
  let project;
  try {
    project = await ensureProject(db, workspaceFolders);
  } catch (err) {
    console.error('[ASH] Project initialization failed:', err);
    vscode.window.showErrorMessage('ASH Workbench: Failed to set up project.');
    await DatabaseService.close();
    return;
  }

  // Create ASH Output Channel for real-time CLI output streaming
  const ashChannel = vscode.window.createOutputChannel('ASH');
  context.subscriptions.push(ashChannel);

  // Initialize scanner service and recover stale scans (FR-017)
  const scanner = new ScannerService(db, project.id, undefined, ashChannel);
  try {
    const recovered = await scanner.recoverStaleScans();
    if (recovered > 0) {
      console.log(`[ASH] Recovered ${recovered} stale scan(s) from previous session`);
    }
  } catch (err) {
    console.error('[ASH] Stale scan recovery failed:', err);
  }

  // FR-007: Register database cleanup disposable
  context.subscriptions.push(
    new vscode.Disposable(() => {
      DatabaseService.close();
    }),
  );

  // Scan root service
  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const scanRootService = new ScanRootService(workspaceRoot);
  scanRootService.refresh();

  // Findings service
  const findingsService = new FindingsService(db, project.id);

  // ASH YAML config service (reads .ash.yaml, provides suppression matching)
  const ashYamlService = new AshYamlService(scanRootService.getEffectiveScanRoot());
  context.subscriptions.push(ashYamlService);

  // Tree view
  const scanTreeProvider = new ScanTreeProvider();
  scanTreeProvider.setFindingsService(findingsService);
  scanTreeProvider.setScanRootService(scanRootService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('ashWorkbench.scanHistory', scanTreeProvider),
  );

  // Findings editor panel manager
  const findingsPanelManager = new FindingsPanelManager(context.extensionUri);
  findingsPanelManager.setScanner(scanner);
  findingsPanelManager.setFindingsService(findingsService);
  findingsPanelManager.setScanTreeProvider(scanTreeProvider);
  findingsPanelManager.setScanRootService(scanRootService);
  // Admin dependencies for application info and reset
  const extensionVersion = context.extension?.packageJSON?.version ?? '0.0.0';
  const adminDeps = { db, extensionVersion, storagePath: context.globalStorageUri.fsPath };
  findingsPanelManager.setAdminDeps(adminDeps);

  // Kitchen Sink panel manager (dev only)
  const sinkPanelManager = new SinkPanelManager(context.extensionUri);
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    context.subscriptions.push(
      vscode.commands.registerCommand('ashWorkbench.openKitchenSink', () => {
        sinkPanelManager.show();
      }),
    );
  }

  // Sidebar webview provider
  const sidebarProvider = new SidebarWebviewProvider(context.extensionUri);
  sidebarProvider.setFindingsPanelManager(findingsPanelManager);
  sidebarProvider.setSinkPanelManager(sinkPanelManager);
  sidebarProvider.setScanner(scanner);
  sidebarProvider.setScanTreeProvider(scanTreeProvider);
  sidebarProvider.setFindingsService(findingsService);
  sidebarProvider.setScanRootService(scanRootService);
  sidebarProvider.setAdminDeps(adminDeps);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarWebviewProvider.viewType, sidebarProvider),
  );

  // Listen for scan root setting changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ashWorkbench.scanRoot')) {
        scanRootService.refresh();
        ashYamlService.setScanRoot(scanRootService.getEffectiveScanRoot());
        findingsPanelManager.postStateUpdate();
        sidebarProvider.queryStateAndPost();
        scanTreeProvider.refresh();
      }
    }),
  );

  // Refresh UI when .ash.yaml config changes
  context.subscriptions.push(
    ashYamlService.onDidChangeConfig(() => {
      findingsPanelManager.postStateUpdate();
      sidebarProvider.queryStateAndPost();
    }),
  );

  // Register scan commands with all dependencies
  registerAllCommands(context, scanner, findingsService, findingsPanelManager, sidebarProvider, scanTreeProvider);

  // Select scan command — wired to tree item clicks and opens the findings panel
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.selectScan', (scanId: string) => {
      scanTreeProvider.selectScan(scanId);
      findingsPanelManager.showFindings(scanId);
    }),
  );

  // Delete scan command — deletes a scan with confirmation
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.deleteScan', async (item: unknown) => {
      const scanId = item && typeof item === 'object' && 'scan' in item
        ? (item as { scan: { id: string } }).scan.id
        : scanTreeProvider.getSelectedScanId();
      if (!scanId) {
        vscode.window.showWarningMessage('ASH: No scan selected to delete.');
        return;
      }
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to delete this scan and all its findings?',
        { modal: true },
        'Delete',
      );
      if (confirm !== 'Delete') {
        return;
      }
      try {
        await findingsService.deleteScan(scanId);
        scanTreeProvider.refresh();
        vscode.window.showInformationMessage('ASH: Scan deleted.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`ASH: Failed to delete scan: ${msg}`);
      }
    }),
  );

  // Reset application command — deletes all data and reinitializes
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.resetApplication', async () => {
      if (scanner.getCurrentScanId()) {
        vscode.window.showWarningMessage('ASH: Cannot reset while a scan is running. Cancel the scan first.');
        return;
      }
      const confirm = await vscode.window.showWarningMessage(
        'This will permanently delete all scans, findings, and triage data. This cannot be undone.',
        { modal: true },
        'Reset',
      );
      if (confirm !== 'Reset') {
        return;
      }
      try {
        await AdminService.resetApplication(context.globalStorageUri.fsPath);
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`ASH: Reset failed: ${msg}`);
      }
    }),
  );

  // Open workbench command — opens findings for the first completed scan
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.openWorkbench', async () => {
      const latestScan = await db.scan.findFirst({
        where: { projectId: project.id, status: 'COMPLETED' },
        orderBy: { startedAt: 'desc' },
      });
      if (latestScan) {
        findingsPanelManager.showFindings(latestScan.id);
      } else {
        vscode.window.showInformationMessage('ASH: No completed scans found. Run a scan first.');
      }
    }),
  );

  console.log('[ASH] ASH Workbench extension activated');
}

export function deactivate() {}
