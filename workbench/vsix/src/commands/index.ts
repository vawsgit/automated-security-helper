import * as vscode from 'vscode';
import { registerScanCommands } from './scanCommands';
import type { ScannerService } from '../services/scanner';
import type { FindingsPanelManager } from '../providers/findingsPanelManager';
import type { SidebarWebviewProvider } from '../providers/sidebarWebviewProvider';
import type { ScanTreeProvider } from '../providers/scanTreeProvider';
import type { FindingsService } from '../services/findings';

export function registerAllCommands(
  context: vscode.ExtensionContext,
  scanner: ScannerService,
  findingsService: FindingsService,
  findingsPanelManager: FindingsPanelManager,
  sidebarWebviewProvider: SidebarWebviewProvider,
  scanTreeProvider: ScanTreeProvider,
): void {
  registerScanCommands(context, scanner, findingsService, findingsPanelManager, sidebarWebviewProvider, scanTreeProvider);
}
