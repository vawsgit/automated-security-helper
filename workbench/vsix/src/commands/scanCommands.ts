import * as vscode from 'vscode';
import type { ScannerService } from '../services/scanner';
import type { FindingsPanelManager } from '../providers/findingsPanelManager';
import type { SidebarWebviewProvider } from '../providers/sidebarWebviewProvider';
import type { ScanTreeProvider } from '../providers/scanTreeProvider';
import type { FindingsService } from '../services/findings';

async function executeScan(
  targetPath: string,
  scanner: ScannerService,
  findingsService: FindingsService,
  findingsPanelManager: FindingsPanelManager,
  sidebarWebviewProvider: SidebarWebviewProvider,
  scanTreeProvider: ScanTreeProvider,
): Promise<void> {
  try {
    const result = await scanner.startScan({ targetPath }, (progress) => {
      const scanId = scanner.getCurrentScanId() ?? '';
      findingsPanelManager.postProgress(scanId, progress.elapsed, progress.statusText);
      sidebarWebviewProvider.postProgress(scanId, progress.elapsed, progress.statusText);
    });

    // On completion, push updated findings to panel
    const findings = await findingsService.getFindings(result.scanId);
    findingsPanelManager.postFindingsUpdate(result.scanId, findings);
    scanTreeProvider.refresh();

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

export function registerScanCommands(
  context: vscode.ExtensionContext,
  scanner: ScannerService,
  findingsService: FindingsService,
  findingsPanelManager: FindingsPanelManager,
  sidebarWebviewProvider: SidebarWebviewProvider,
  scanTreeProvider: ScanTreeProvider,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('ashWorkbench.startScan', async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showWarningMessage('ASH: No workspace folder open');
        return;
      }

      // Build target picker items
      const items: vscode.QuickPickItem[] = [];

      // Workspace root always first
      items.push({
        label: '$(folder) Workspace Root',
        description: workspaceRoot,
        detail: workspaceRoot,
      });

      // Existing scan targets from service
      try {
        const targets = await findingsService.getScanTargets();
        for (const target of targets) {
          if (target.path !== workspaceRoot) {
            items.push({
              label: `$(folder) ${target.displayName}`,
              description: target.path,
              detail: target.path,
            });
          }
        }
      } catch {
        // If query fails, continue with just workspace root
      }

      // Browse option
      items.push({
        label: '$(file-directory) Browse...',
        description: 'Select a folder to scan',
        detail: '__browse__',
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a folder to scan',
        title: 'ASH: Start Scan',
      });

      if (!selected) {
        return;
      }

      let targetPath = selected.detail!;
      if (targetPath === '__browse__') {
        const result = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'Select Folder to Scan',
        });
        if (!result || result.length === 0) {
          return;
        }
        targetPath = result[0].fsPath;
      }

      // Open findings panel immediately with scanning state
      findingsPanelManager.showScanning('pending', targetPath);

      await executeScan(targetPath, scanner, findingsService, findingsPanelManager, sidebarWebviewProvider, scanTreeProvider);
    }),

    vscode.commands.registerCommand('ashWorkbench.cancelScan', async () => {
      const scanId = scanner.getCurrentScanId();
      if (scanId) {
        await scanner.cancelScan(scanId);
        vscode.window.showInformationMessage('ASH: Scan cancelled');
      }
    }),

  );
}
