import * as vscode from 'vscode';
import type {
  AshSuppression,
  AshYamlConfig,
  FindingRow,
  SuppressionEntry,
  MatchedFindingRef,
} from '../models/types';
import {
  DEFAULT_CONFIG,
  DEBOUNCE_MS,
  discoverConfigFile,
  parseConfigFile,
  findMatchingSuppression,
  batchMatchSuppressions,
  isExpired,
  matchesRuleId,
  matchesFilePath,
  matchesLineRange,
} from './ashYamlCore';

// Re-export pure functions for consumers that import from this module
export {
  discoverConfigFile,
  parseConfigFile,
  parseRawConfig,
  parseSuppressions,
  parseIgnorePaths,
  parseScanners,
  isExpired,
  matchesRuleId,
  matchesFilePath,
  matchesLineRange,
  findMatchingSuppression,
  batchMatchSuppressions,
} from './ashYamlCore';

// --- Service ---

export class AshYamlService implements vscode.Disposable {
  private config: AshYamlConfig = { ...DEFAULT_CONFIG };
  private scanRoot: string;
  private watchers: vscode.Disposable[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly _onDidChangeConfig = new vscode.EventEmitter<AshYamlConfig>();
  readonly onDidChangeConfig: vscode.Event<AshYamlConfig> = this._onDidChangeConfig.event;

  constructor(scanRoot: string) {
    this.scanRoot = scanRoot;
    this.loadConfig();
    this.createFileWatchers(scanRoot);
  }

  getConfig(): AshYamlConfig {
    return this.config;
  }

  getSuppressions(): AshSuppression[] {
    return this.config.suppressions;
  }

  matchesSuppression(finding: FindingRow): AshSuppression | null {
    return findMatchingSuppression(finding, this.config.suppressions);
  }

  getMatchingSuppressions(findings: FindingRow[]): Map<string, AshSuppression> {
    return batchMatchSuppressions(findings, this.config.suppressions);
  }

  getSuppressionStatuses(findings: FindingRow[]): SuppressionEntry[] {
    const suppressions = this.config.suppressions;
    return suppressions.map((suppression) => {
      const expired = isExpired(suppression.expiration);
      const matchedFindings: MatchedFindingRef[] = [];

      if (!expired) {
        for (const finding of findings) {
          if (
            matchesRuleId(finding.ruleId, suppression.rule_id) &&
            matchesFilePath(finding.filePath, suppression.path) &&
            matchesLineRange(finding, suppression)
          ) {
            matchedFindings.push({
              id: finding.id,
              severity: finding.severity,
              title: finding.title,
              file: finding.filePath,
              line: finding.startLine > 0 ? finding.startLine : null,
            });
          }
        }
      }

      let status: 'active' | 'unused' | 'expired';
      if (expired) {
        status = 'expired';
      } else if (matchedFindings.length > 0) {
        status = 'active';
      } else {
        status = 'unused';
      }

      return {
        ...suppression,
        status,
        matchCount: matchedFindings.length,
        matchedFindings,
      };
    });
  }

  setScanRoot(newRoot: string): void {
    this.scanRoot = newRoot;
    this.disposeWatchers();
    this.loadConfig();
    this.createFileWatchers(newRoot);
    this._onDidChangeConfig.fire(this.config);
  }

  dispose(): void {
    this.disposeWatchers();
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
    }
    this._onDidChangeConfig.dispose();
  }

  // --- Private ---

  private loadConfig(): void {
    const filePath = discoverConfigFile(this.scanRoot);
    if (filePath) {
      this.config = parseConfigFile(filePath);
    } else {
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private createFileWatchers(scanRoot: string): void {
    const globPattern = '{.ash.yml,.ash.yaml,.ash.json,ash.yml,ash.yaml,ash.json}';

    try {
      const rootUri = vscode.Uri.file(scanRoot);

      // Watch root directory
      const rootWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(rootUri, globPattern),
      );
      rootWatcher.onDidCreate(() => this.debouncedReload());
      rootWatcher.onDidChange(() => this.debouncedReload());
      rootWatcher.onDidDelete(() => this.debouncedReload());
      this.watchers.push(rootWatcher);

      // Watch .ash/ subdirectory
      const ashSubdirWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(rootUri, `.ash/${globPattern}`),
      );
      ashSubdirWatcher.onDidCreate(() => this.debouncedReload());
      ashSubdirWatcher.onDidChange(() => this.debouncedReload());
      ashSubdirWatcher.onDidDelete(() => this.debouncedReload());
      this.watchers.push(ashSubdirWatcher);
    } catch (err) {
      console.warn('[ASH Config] Failed to create file watchers:', err);
    }
  }

  private debouncedReload(): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.loadConfig();
      this._onDidChangeConfig.fire(this.config);
    }, DEBOUNCE_MS);
  }

  private disposeWatchers(): void {
    for (const w of this.watchers) {
      w.dispose();
    }
    this.watchers = [];
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }
}
