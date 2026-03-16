import * as vscode from 'vscode';
import { registerAllCommands } from './commands/index';
import { setFindingsPanelManagerRef } from './commands/scanCommands';
import { ScanTreeProvider } from './providers/scanTreeProvider';
import { SidebarWebviewProvider } from './providers/sidebarWebviewProvider';
import { FindingsPanelManager } from './providers/findingsPanelManager';
import { SinkPanelManager } from './providers/sinkPanelManager';

export function activate(context: vscode.ExtensionContext) {
  console.log('[ASH] Activating ASH Workbench extension');

  // Register commands
  registerAllCommands(context);

  // Tree view
  const scanTreeProvider = new ScanTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('ashWorkbench.scanHistory', scanTreeProvider),
  );

  // Findings editor panel manager
  const findingsPanelManager = new FindingsPanelManager(context.extensionUri);
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
  const sidebarProvider = new SidebarWebviewProvider(context.extensionUri);
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
