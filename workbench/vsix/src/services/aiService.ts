import * as vscode from 'vscode';
import type { AiProvider, ConnectionTestResult, AnalysisEvent } from './aiProvider';
import type { FindingsService } from './findings';

const MAX_CONCURRENT_ANALYSES = 5;

export interface AiServiceConfig {
  provider: string;
  region: string;
  modelId: string;
  useClaudeSettings: boolean;
  maxBudgetUsd: number;
  maxTurns: number;
  toolMode: 'read-only' | 'full';
}

export class AiService implements vscode.Disposable {
  private provider: AiProvider | undefined;
  private activeAnalyses = new Map<string, AbortController>();

  constructor(
    private readonly findingsService: FindingsService,
    private readonly workspaceRoot: string,
    private readonly outputChannel?: vscode.OutputChannel,
  ) {}

  private getConfig(): AiServiceConfig {
    const config = vscode.workspace.getConfiguration('ashWorkbench.llm');
    return {
      provider: config.get<string>('provider', ''),
      region: config.get<string>('region', ''),
      modelId: config.get<string>('modelId', ''),
      useClaudeSettings: config.get<boolean>('useClaudeSettings', true),
      maxBudgetUsd: config.get<number>('maxBudgetUsd', 1.0),
      maxTurns: config.get<number>('maxTurns', 15),
      toolMode: config.get<string>('toolMode', 'read-only') as 'read-only' | 'full',
    };
  }

  private async ensureProvider(): Promise<AiProvider> {
    if (this.provider) {
      return this.provider;
    }
    const config = this.getConfig();
    // Lazy import to avoid loading SDK until needed
    const { ClaudeAgentProvider } = await import('./claudeAgentProvider.js');
    const provider = new ClaudeAgentProvider(config);
    this.provider = provider;
    this.log('AI provider initialized');
    return provider;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    this.log('Testing AI connection...');
    const provider = await this.ensureProvider();
    const result = await provider.testConnection();
    if (result.success) {
      this.log(`Connection test passed: model=${result.model}, latency=${result.latencyMs}ms`);
    } else {
      this.log(`Connection test failed: ${result.error?.message ?? 'unknown error'}`);
    }
    return result;
  }

  async analyzeFinding(
    findingId: string,
    onEvent: (event: AnalysisEvent) => void,
  ): Promise<void> {
    // Check concurrency limit
    if (this.activeAnalyses.size >= MAX_CONCURRENT_ANALYSES) {
      onEvent({
        type: 'error',
        errorType: 'unknown',
        message: `Too many analyses in progress (max ${MAX_CONCURRENT_ANALYSES}). Please wait for one to complete.`,
      });
      return;
    }

    // Reject duplicate analysis for the same finding
    if (this.activeAnalyses.has(findingId)) {
      onEvent({
        type: 'error',
        errorType: 'unknown',
        message: 'Analysis already in progress for this finding.',
      });
      return;
    }

    const abortController = new AbortController();
    this.activeAnalyses.set(findingId, abortController);
    this.log(`Starting analysis for finding ${findingId} (active: ${this.activeAnalyses.size})`);

    try {
      const provider = await this.ensureProvider();
      const config = this.getConfig();

      // Load finding detail
      const finding = await this.findingsService.getFindingDetail(findingId);
      if (!finding) {
        onEvent({
          type: 'error',
          errorType: 'unknown',
          message: `Finding not found: ${findingId}`,
        });
        return;
      }

      const params = {
        finding,
        workspaceRoot: this.workspaceRoot,
        maxBudgetUsd: config.maxBudgetUsd,
        maxTurns: config.maxTurns,
        toolMode: config.toolMode,
        abortSignal: abortController.signal,
      };

      // Iterate the provider's async generator
      for await (const event of provider.analyzeFinding(params)) {
        onEvent(event);

        if (event.type === 'result') {
          // Persist to database (overwrite on success, per FR-016)
          await this.findingsService.setAiAnalysis(
            findingId,
            event.analysis,
            event.metadata,
          );
          this.log(`Analysis complete for ${findingId}: cost=$${event.metadata.costUsd.toFixed(4)}, tools=[${event.metadata.toolsUsed.join(', ')}]`);
        }

        if (event.type === 'error') {
          this.log(`Analysis error for ${findingId}: [${event.errorType}] ${event.message}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Analysis exception for ${findingId}: ${message}`);
      onEvent({
        type: 'error',
        errorType: 'unknown',
        message: `Analysis failed: ${message}`,
      });
    } finally {
      this.activeAnalyses.delete(findingId);
      this.log(`Analysis removed for ${findingId} (active: ${this.activeAnalyses.size})`);
    }
  }

  cancelAnalysis(findingId: string): void {
    const controller = this.activeAnalyses.get(findingId);
    if (controller) {
      this.log(`Cancelling analysis for ${findingId}`);
      controller.abort();
    }
  }

  private log(message: string): void {
    const line = `[ASH AI] ${message}`;
    console.log(line);
    this.outputChannel?.appendLine(line);
  }

  dispose(): void {
    // Abort all active analyses on extension shutdown
    for (const [findingId, controller] of this.activeAnalyses) {
      this.log(`Disposing: aborting analysis for ${findingId}`);
      controller.abort();
    }
    this.activeAnalyses.clear();
  }
}
