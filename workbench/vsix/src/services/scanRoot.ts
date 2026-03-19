import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ScanRootService {
  private effectiveScanRoot: string;

  constructor(private readonly workspaceRoot: string) {
    this.effectiveScanRoot = workspaceRoot;
  }

  /** Resolve and cache the effective scan root from settings */
  refresh(): void {
    const config = vscode.workspace.getConfiguration('ashWorkbench');
    const configuredRoot = config.get<string>('scanRoot', '');

    if (!configuredRoot) {
      this.effectiveScanRoot = this.workspaceRoot;
      return;
    }

    // Validate: must be absolute path
    if (!path.isAbsolute(configuredRoot)) {
      vscode.window.showWarningMessage(
        `ASH Workbench: scanRoot "${configuredRoot}" is not an absolute path. Falling back to workspace root.`,
      );
      this.effectiveScanRoot = this.workspaceRoot;
      return;
    }

    // Validate: must exist and be a directory
    try {
      const stat = fs.statSync(configuredRoot);
      if (!stat.isDirectory()) {
        vscode.window.showWarningMessage(
          `ASH Workbench: scanRoot "${configuredRoot}" is not a directory. Falling back to workspace root.`,
        );
        this.effectiveScanRoot = this.workspaceRoot;
        return;
      }
    } catch {
      vscode.window.showWarningMessage(
        `ASH Workbench: scanRoot "${configuredRoot}" does not exist. Falling back to workspace root.`,
      );
      this.effectiveScanRoot = this.workspaceRoot;
      return;
    }

    this.effectiveScanRoot = configuredRoot;
  }

  /** Get the current effective scan root (cached) */
  getEffectiveScanRoot(): string {
    return this.effectiveScanRoot;
  }

  /** Check if a path is within the current scan root scope */
  isInScope(targetPath: string): boolean {
    return targetPath === this.effectiveScanRoot || targetPath.startsWith(this.effectiveScanRoot + path.sep);
  }

  /** Build a Prisma where-clause fragment for ScanTarget.path filtering */
  buildPathFilter(): { OR: Array<{ path: string } | { path: { startsWith: string } }> } {
    return {
      OR: [{ path: this.effectiveScanRoot }, { path: { startsWith: this.effectiveScanRoot + path.sep } }],
    };
  }
}
