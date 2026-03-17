import * as vscode from 'vscode';
import type { PrismaClient } from '@prisma/client';
import { registerScanCommands } from './scanCommands';
import type { ScannerService } from '../services/scanner';
import type { FindingsPanelManager } from '../providers/findingsPanelManager';
import type { SidebarWebviewProvider } from '../providers/sidebarWebviewProvider';
import type { ScanTreeProvider } from '../providers/scanTreeProvider';

export function registerAllCommands(
  context: vscode.ExtensionContext,
  scanner: ScannerService,
  db: PrismaClient,
  projectId: string,
  findingsPanelManager: FindingsPanelManager,
  sidebarWebviewProvider: SidebarWebviewProvider,
  scanTreeProvider: ScanTreeProvider,
): void {
  registerScanCommands(context, scanner, db, projectId, findingsPanelManager, sidebarWebviewProvider, scanTreeProvider);
}
