import * as vscode from 'vscode';

export function registerScanCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.startScan', () => {
      vscode.window.showInformationMessage('ASH: Scan started (mock)');
    }),
    vscode.commands.registerCommand('ashWorkbench.cancelScan', () => {
      vscode.window.showInformationMessage('ASH: Scan cancelled (mock)');
    }),
  );
}
