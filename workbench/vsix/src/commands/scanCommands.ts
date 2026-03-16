import * as vscode from 'vscode';
import type { FindingsPanelManager } from '../providers/findingsPanelManager';

let findingsPanelManager: FindingsPanelManager | undefined;

export function setFindingsPanelManagerRef(manager: FindingsPanelManager): void {
  findingsPanelManager = manager;
}

export function registerScanCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.startScan', () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showWarningMessage('ASH: No workspace folder open');
        return;
      }
      vscode.window.showInformationMessage(`ASH: Scanning workspace root ${workspaceRoot} (mock)`);
      if (findingsPanelManager) {
        findingsPanelManager.showFindings('scan-001', workspaceRoot);
      }
    }),
    vscode.commands.registerCommand('ashWorkbench.cancelScan', () => {
      vscode.window.showInformationMessage('ASH: Scan cancelled (mock)');
    }),
    vscode.commands.registerCommand('ashWorkbench.scanFolder', (folderUri: vscode.Uri) => {
      const targetPath = folderUri.fsPath;
      vscode.window.showInformationMessage(`ASH: Scanning folder ${targetPath} (mock)`);
      if (findingsPanelManager) {
        findingsPanelManager.showFindings('scan-001', targetPath);
      }
    }),
  );
}
