import * as vscode from 'vscode';
import type { AiProvider, ConnectionTestResult, AnalysisEvent } from './aiProvider';
import type { FindingsService } from './findings';
import { createFindingMcpServer } from './mcpTools';

const MAX_CONCURRENT_ANALYSES = 5;

// --- Batch Analysis Types (Spec 023) ---

export type BatchStatus = 'running' | 'completed' | 'cancelled' | 'consecutive-failures' | 'error';

export interface BatchAnalysisState {
  scanId: string;
  findingIds: string[];
  currentIndex: number;
  totalFindings: number;
  analyzedCount: number;
  failedCount: number;
  skippedCount: number;
  consecutiveFailures: number;
  sessionId?: string;
  abortController: AbortController;
  status: BatchStatus;
}

export interface BatchStartedEvent {
  type: 'batch-started';
  scanId: string;
  totalFindings: number;
  findingIds: string[];
}

export interface BatchProgressEvent {
  type: 'batch-progress';
  scanId: string;
  currentIndex: number;
  totalFindings: number;
  currentFindingId: string;
}

export interface BatchFindingEvent {
  type: 'batch-finding-event';
  findingId: string;
  event: AnalysisEvent;
}

export interface BatchCompleteEvent {
  type: 'batch-complete';
  scanId: string;
  analyzedCount: number;
  failedCount: number;
  skippedCount: number;
  status: BatchStatus;
}

export type BatchEvent =
  | BatchStartedEvent
  | BatchProgressEvent
  | BatchFindingEvent
  | BatchCompleteEvent;

export interface AiServiceConfig {
  provider: string;
  region: string;
  modelId: string;
  awsProfile: string;
  awsAuthRefresh: string;
  useClaudeSettings: boolean;
  maxBudgetUsd: number;
  maxTurns: number;
  toolMode: 'read-only' | 'full';
  batchConsecutiveFailureLimit: number;
}

export class AiService implements vscode.Disposable {
  private provider: AiProvider | undefined;
  private activeAnalyses = new Map<string, AbortController>();
  private activeBatches = new Map<string, BatchAnalysisState>();

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
      awsProfile: config.get<string>('awsProfile', ''),
      awsAuthRefresh: config.get<string>('awsAuthRefresh', ''),
      useClaudeSettings: config.get<boolean>('useClaudeSettings', true),
      maxBudgetUsd: config.get<number>('maxBudgetUsd', 1.0),
      maxTurns: config.get<number>('maxTurns', 15),
      toolMode: config.get<string>('toolMode', 'read-only') as 'read-only' | 'full',
      batchConsecutiveFailureLimit: config.get<number>('batchConsecutiveFailureLimit', 3),
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

      // Create MCP server with finding-analysis tools
      let mcpServers: Record<string, Record<string, unknown>> | undefined;
      try {
        const server = await createFindingMcpServer(this.findingsService, findingId, this.workspaceRoot);
        mcpServers = { 'ash-finding-tools': server };
      } catch (err) {
        this.log(`Failed to create MCP server for finding tools: ${err instanceof Error ? err.message : String(err)}`);
        // Continue without MCP tools — analysis can still use built-in tools
      }

      const params = {
        finding,
        workspaceRoot: this.workspaceRoot,
        maxBudgetUsd: config.maxBudgetUsd,
        maxTurns: config.maxTurns,
        toolMode: config.toolMode,
        abortSignal: abortController.signal,
        mcpServers,
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

  async analyzeAllFindings(
    scanId: string,
    onBatchEvent: (event: BatchEvent) => void,
  ): Promise<void> {
    // FR-013: Guard against duplicate batch for same scanId
    if (this.activeBatches.has(scanId)) {
      this.log(`Batch analysis already in progress for scan ${scanId}`);
      return;
    }

    const config = this.getConfig();

    // Query unanalyzed findings for this scan
    const allFindings = await this.findingsService.getFindings(scanId);
    const unanalyzedFindings = allFindings.filter((f) => f.aiAnalysis === null);

    if (unanalyzedFindings.length === 0) {
      this.log(`No unanalyzed findings for scan ${scanId}`);
      onBatchEvent({
        type: 'batch-complete',
        scanId,
        analyzedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        status: 'completed',
      });
      return;
    }

    const findingIds = unanalyzedFindings.map((f) => f.id);
    const abortController = new AbortController();

    const batchState: BatchAnalysisState = {
      scanId,
      findingIds,
      currentIndex: 0,
      totalFindings: findingIds.length,
      analyzedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      consecutiveFailures: 0,
      abortController,
      status: 'running',
    };

    this.activeBatches.set(scanId, batchState);
    this.log(`Starting batch analysis for scan ${scanId}: ${findingIds.length} findings`);

    onBatchEvent({
      type: 'batch-started',
      scanId,
      totalFindings: findingIds.length,
      findingIds,
    });

    try {
      for (let i = 0; i < findingIds.length; i++) {
        // Check for cancellation
        if (abortController.signal.aborted) {
          batchState.status = 'cancelled';
          break;
        }

        const findingId = findingIds[i];
        batchState.currentIndex = i;

        // Skip if already being analyzed individually
        if (this.activeAnalyses.has(findingId)) {
          batchState.skippedCount++;
          this.log(`Batch: skipping ${findingId} (already in-progress)`);
          continue;
        }

        // Re-check if finding was analyzed since batch started
        const currentFinding = await this.findingsService.getFindingDetail(findingId);
        if (currentFinding?.aiAnalysis !== null && currentFinding?.aiAnalysis !== undefined) {
          batchState.skippedCount++;
          this.log(`Batch: skipping ${findingId} (already analyzed)`);
          continue;
        }

        // Emit progress
        onBatchEvent({
          type: 'batch-progress',
          scanId,
          currentIndex: i + 1, // 1-based for display
          totalFindings: findingIds.length,
          currentFindingId: findingId,
        });

        // Analyze this finding using the existing single-finding flow
        let findingSucceeded = false;
        await this.analyzeFindingForBatch(findingId, batchState, (event) => {
          onBatchEvent({
            type: 'batch-finding-event',
            findingId,
            event,
          });

          if (event.type === 'result') {
            findingSucceeded = true;
            // Capture sessionId for session resumption (T013)
            if (event.sessionId && !batchState.sessionId) {
              batchState.sessionId = event.sessionId;
              this.log(`Batch: captured session ${event.sessionId} for resume`);
            }
          }

          // FR-010 fallback: if a finding errors after resume, clear sessionId
          if (event.type === 'error' && batchState.sessionId) {
            this.log(`Batch: clearing session after error (FR-010 fallback)`);
            batchState.sessionId = undefined;
          }
        });

        if (findingSucceeded) {
          batchState.analyzedCount++;
          batchState.consecutiveFailures = 0;
        } else if (!abortController.signal.aborted) {
          batchState.failedCount++;
          batchState.consecutiveFailures++;

          // Check consecutive failure threshold
          if (batchState.consecutiveFailures >= config.batchConsecutiveFailureLimit) {
            batchState.status = 'consecutive-failures';
            this.log(`Batch: consecutive failure limit reached (${batchState.consecutiveFailures}/${config.batchConsecutiveFailureLimit})`);
            break;
          }
        }
      }

      // Set terminal status if not already set by cancellation or failure threshold
      if (batchState.status === 'running') {
        batchState.status = 'completed';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Batch analysis error for scan ${scanId}: ${message}`);
      batchState.status = 'error';
    } finally {
      this.activeBatches.delete(scanId);
      this.log(`Batch analysis finished for scan ${scanId}: status=${batchState.status}, analyzed=${batchState.analyzedCount}, failed=${batchState.failedCount}, skipped=${batchState.skippedCount}`);

      onBatchEvent({
        type: 'batch-complete',
        scanId,
        analyzedCount: batchState.analyzedCount,
        failedCount: batchState.failedCount,
        skippedCount: batchState.skippedCount,
        status: batchState.status,
      });
    }
  }

  /**
   * Internal: analyze a single finding within a batch context.
   * Uses the batch's AbortController so cancellation propagates.
   */
  private async analyzeFindingForBatch(
    findingId: string,
    batchState: BatchAnalysisState,
    onEvent: (event: AnalysisEvent) => void,
  ): Promise<void> {
    const abortController = batchState.abortController;
    this.activeAnalyses.set(findingId, abortController);
    this.log(`Batch: analyzing finding ${findingId} (${batchState.currentIndex + 1}/${batchState.totalFindings})`);

    try {
      const provider = await this.ensureProvider();
      const config = this.getConfig();

      const finding = await this.findingsService.getFindingDetail(findingId);
      if (!finding) {
        onEvent({ type: 'error', errorType: 'unknown', message: `Finding not found: ${findingId}` });
        return;
      }

      let mcpServers: Record<string, Record<string, unknown>> | undefined;
      try {
        const server = await createFindingMcpServer(this.findingsService, findingId, this.workspaceRoot);
        mcpServers = { 'ash-finding-tools': server };
      } catch (err) {
        this.log(`Failed to create MCP server for finding tools: ${err instanceof Error ? err.message : String(err)}`);
      }

      const params = {
        finding,
        workspaceRoot: this.workspaceRoot,
        maxBudgetUsd: config.maxBudgetUsd,
        maxTurns: config.maxTurns,
        toolMode: config.toolMode,
        abortSignal: abortController.signal,
        mcpServers,
        resume: batchState.sessionId,
      };

      for await (const event of provider.analyzeFinding(params)) {
        onEvent(event);

        if (event.type === 'result') {
          await this.findingsService.setAiAnalysis(findingId, event.analysis, event.metadata);
          this.log(`Batch: analysis complete for ${findingId}: cost=$${event.metadata.costUsd.toFixed(4)}`);
        }

        if (event.type === 'error') {
          this.log(`Batch: analysis error for ${findingId}: [${event.errorType}] ${event.message}`);
        }
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        this.log(`Batch: analysis cancelled for ${findingId}`);
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Batch: analysis exception for ${findingId}: ${message}`);
      onEvent({ type: 'error', errorType: 'unknown', message: `Analysis failed: ${message}` });
    } finally {
      this.activeAnalyses.delete(findingId);
    }
  }

  cancelBatchAnalysis(scanId: string): void {
    const batch = this.activeBatches.get(scanId);
    if (batch) {
      this.log(`Cancelling batch analysis for scan ${scanId}`);
      batch.abortController.abort();
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
    // Abort all active batches on extension shutdown
    for (const [scanId, batch] of this.activeBatches) {
      this.log(`Disposing: aborting batch for scan ${scanId}`);
      batch.abortController.abort();
    }
    this.activeBatches.clear();

    // Abort all active individual analyses
    for (const [findingId, controller] of this.activeAnalyses) {
      this.log(`Disposing: aborting analysis for ${findingId}`);
      controller.abort();
    }
    this.activeAnalyses.clear();
  }
}
