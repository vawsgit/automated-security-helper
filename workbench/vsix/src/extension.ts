import * as vscode from 'vscode';
import { registerAllCommands } from './commands/index';
import { setFindingsPanelManagerRef } from './commands/scanCommands';
import { DatabaseService } from './services/database';
import { ensureProject } from './services/project';
import { ScanTreeProvider } from './providers/scanTreeProvider';
import { SidebarWebviewProvider } from './providers/sidebarWebviewProvider';
import { FindingsPanelManager } from './providers/findingsPanelManager';
import { SinkPanelManager } from './providers/sinkPanelManager';

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

  // FR-001: Initialize database
  let db;
  try {
    db = await DatabaseService.initialize(context.globalStorageUri.fsPath);
  } catch (err) {
    console.error('[ASH] Database initialization failed:', err);
    vscode.window.showErrorMessage('ASH Workbench: Failed to initialize database.');
    return;
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

  // FR-007: Register database cleanup disposable
  context.subscriptions.push(
    new vscode.Disposable(() => {
      DatabaseService.close();
    }),
  );

  // Register commands
  registerAllCommands(context);

  // Tree view
  const scanTreeProvider = new ScanTreeProvider(db, project);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('ashWorkbench.scanHistory', scanTreeProvider),
  );

  // Findings editor panel manager
  const findingsPanelManager = new FindingsPanelManager(context.extensionUri, db, project);
  setFindingsPanelManagerRef(findingsPanelManager);

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
  const sidebarProvider = new SidebarWebviewProvider(context.extensionUri, db, project);
  sidebarProvider.setFindingsPanelManager(findingsPanelManager);
  sidebarProvider.setSinkPanelManager(sinkPanelManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarWebviewProvider.viewType, sidebarProvider),
  );

  // Select scan command — wired to tree item clicks and opens the findings panel
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.selectScan', (scanId: string) => {
      scanTreeProvider.selectScan(scanId);
      findingsPanelManager.showFindings(scanId);
    }),
  );

  // Open workbench command — opens findings for the first completed scan
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.openWorkbench', () => {
      findingsPanelManager.showFindings('scan-001');
    }),
  );

  console.log('[ASH] ASH Workbench extension activated');
}

export function deactivate() {}
