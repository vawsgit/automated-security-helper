import * as vscode from 'vscode';
import type { FindingsPanelManager } from '../providers/findingsPanelManager';

let findingsPanelManager: FindingsPanelManager | undefined;

export function setFindingsPanelManagerRef(manager: FindingsPanelManager): void {
  findingsPanelManager = manager;
}

export function registerScanCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.startScan', () => {
      vscode.window.showInformationMessage('ASH: Scan started (mock)');
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
