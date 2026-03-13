import * as vscode from 'vscode';
import type { ScanSummary } from '../models/types';
import { getMockScans } from '../mock/data';

export class ScanTreeProvider implements vscode.TreeDataProvider<ScanTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ScanTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private selectedScanId: string | undefined;

  getTreeItem(element: ScanTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ScanTreeItem[] {
    const scans = getMockScans();
    return scans.map(scan => new ScanTreeItem(scan));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  selectScan(scanId: string): void {
    this.selectedScanId = scanId;
    console.log(`[ASH] Selected scan: ${scanId}`);
  }

  getSelectedScanId(): string | undefined {
    return this.selectedScanId;
  }
}

const statusIcons: Record<string, vscode.ThemeIcon> = {
  COMPLETED: new vscode.ThemeIcon('check'),
  FAILED: new vscode.ThemeIcon('error'),
  CANCELLED: new vscode.ThemeIcon('circle-slash'),
  RUNNING: new vscode.ThemeIcon('sync~spin'),
};

class ScanTreeItem extends vscode.TreeItem {
  constructor(public readonly scan: ScanSummary) {
    const date = new Date(scan.startedAt);
    const label = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = scan.status === 'COMPLETED'
      ? `${scan.findingCount} findings - ${scan.sourceDirectory}`
      : scan.status.toLowerCase();
    this.iconPath = statusIcons[scan.status];
    this.contextValue = `scan.${scan.status.toLowerCase()}`;
    this.command = {
      command: 'ashWorkbench.selectScan',
      title: 'Select Scan',
      arguments: [scan.id],
    };
  }
}
