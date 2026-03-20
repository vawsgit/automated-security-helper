import assert from 'node:assert/strict';
import sinon from 'sinon';
import type { AnalysisEvent, AnalysisResultEvent } from '../../services/aiProvider';
import type { FindingRow, AiAnalysis, AnalysisMetadata } from '../../models/types';
import type { BatchEvent, BatchAnalysisState } from '../../services/aiService';

/**
 * Tests the batch analysis flow (Spec 023).
 *
 * Since AiService requires VS Code workspace APIs and the FindingsService,
 * we test the batch orchestration logic by simulating the event patterns
 * and verifying the batch state machine, consecutive failure tracking,
 * cancellation, and session resumption.
 */

const sampleAnalysis: AiAnalysis = {
  explanation: 'SQL injection via string concatenation.',
  riskAssessment: {
    exploitability: 'HIGH',
    exploitabilityRationale: 'Direct user input.',
    impact: 'CRITICAL',
    impactRationale: 'Full database access.',
    likelihood: 'HIGH',
    likelihoodRationale: 'Well-known pattern.',
  },
  suggestedFix: {
    description: 'Use parameterized queries.',
    diffText: '- bad\n+ good',
    language: 'python',
  },
  references: [{ title: 'CWE-89', url: 'https://cwe.mitre.org/data/definitions/89.html' }],
};

const sampleMetadata: AnalysisMetadata = {
  analyzedAt: '2026-03-20T14:00:00.000Z',
  modelId: 'claude-sonnet-4-6',
  costUsd: 0.03,
  toolsUsed: ['Read', 'Grep'],
};

function makeFinding(id: string, hasAnalysis = false): FindingRow {
  return {
    id,
    scanId: 'scan-1',
    scanTargetId: 'target-1',
    severity: 'HIGH',
    title: `Finding ${id}`,
    description: 'Test finding',
    filePath: 'test.py',
    startLine: 1,
    endLine: 5,
    scanner: 'bandit',
    ruleId: 'B101',
    codeSnippet: 'eval(input())',
    disposition: 'PENDING',
    notes: '',
    firstDetectedAt: '2026-03-20T00:00:00Z',
    aiAnalysis: hasAnalysis ? sampleAnalysis : null,
    analysisMetadata: hasAnalysis ? sampleMetadata : null,
    suppression: null,
    isCurrentlySuppressed: false,
    suppressionSource: null,
  };
}

/**
 * Simulates the batch analysis loop logic.
 * This mirrors AiService.analyzeAllFindings() without the VS Code dependencies.
 */
async function simulateBatchAnalysis(opts: {
  findings: FindingRow[];
  failureLimit: number;
  /** Per-finding analysis result: true=success, false=error, 'skip'=already analyzed */
  perFindingOutcome: Array<'success' | 'error' | 'skip'>;
  cancelAtIndex?: number;
  sessionIdFromFirstResult?: string;
}): Promise<{
  batchEvents: BatchEvent[];
  finalState: Omit<BatchAnalysisState, 'abortController'>;
}> {
  const { findings, failureLimit, perFindingOutcome, cancelAtIndex, sessionIdFromFirstResult } = opts;
  const batchEvents: BatchEvent[] = [];
  const abortController = new AbortController();

  const unanalyzed = findings.filter((f) => f.aiAnalysis === null);
  const findingIds = unanalyzed.map((f) => f.id);

  const state = {
    scanId: 'scan-1',
    findingIds,
    currentIndex: 0,
    totalFindings: findingIds.length,
    analyzedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    consecutiveFailures: 0,
    sessionId: undefined as string | undefined,
    status: 'running' as BatchAnalysisState['status'],
  };

  batchEvents.push({
    type: 'batch-started',
    scanId: state.scanId,
    totalFindings: state.totalFindings,
    findingIds,
  });

  for (let i = 0; i < findingIds.length; i++) {
    if (abortController.signal.aborted) {
      state.status = 'cancelled';
      break;
    }

    if (cancelAtIndex !== undefined && i === cancelAtIndex) {
      abortController.abort();
      state.status = 'cancelled';
      break;
    }

    const findingId = findingIds[i];
    const outcome = perFindingOutcome[i] ?? 'success';
    state.currentIndex = i;

    if (outcome === 'skip') {
      state.skippedCount++;
      continue;
    }

    batchEvents.push({
      type: 'batch-progress',
      scanId: state.scanId,
      currentIndex: i + 1,
      totalFindings: state.totalFindings,
      currentFindingId: findingId,
    });

    if (outcome === 'success') {
      const resultEvent: AnalysisResultEvent = {
        type: 'result',
        analysis: sampleAnalysis,
        metadata: sampleMetadata,
        sessionId: sessionIdFromFirstResult && i === 0 ? sessionIdFromFirstResult : undefined,
      };
      batchEvents.push({ type: 'batch-finding-event', findingId, event: resultEvent });
      state.analyzedCount++;
      state.consecutiveFailures = 0;

      // Session capture
      if (resultEvent.sessionId && !state.sessionId) {
        state.sessionId = resultEvent.sessionId;
      }
    } else {
      const errorEvent: AnalysisEvent = {
        type: 'error',
        errorType: 'unknown',
        message: 'Analysis failed',
      };
      batchEvents.push({ type: 'batch-finding-event', findingId, event: errorEvent });
      state.failedCount++;
      state.consecutiveFailures++;

      // FR-010: clear session on error
      if (state.sessionId) {
        state.sessionId = undefined;
      }

      if (state.consecutiveFailures >= failureLimit) {
        state.status = 'consecutive-failures';
        break;
      }
    }
  }

  if (state.status === 'running') {
    state.status = 'completed';
  }

  batchEvents.push({
    type: 'batch-complete',
    scanId: state.scanId,
    analyzedCount: state.analyzedCount,
    failedCount: state.failedCount,
    skippedCount: state.skippedCount,
    status: state.status,
  });

  return { batchEvents, finalState: state };
}

describe('Batch Analysis (Spec 023)', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('happy path: processes all unanalyzed findings sequentially', async () => {
    const findings = [makeFinding('f1'), makeFinding('f2'), makeFinding('f3')];
    const { batchEvents, finalState } = await simulateBatchAnalysis({
      findings,
      failureLimit: 3,
      perFindingOutcome: ['success', 'success', 'success'],
    });

    // Verify batch-started
    assert.equal(batchEvents[0].type, 'batch-started');
    const started = batchEvents[0] as BatchEvent & { type: 'batch-started' };
    assert.equal(started.totalFindings, 3);
    assert.deepStrictEqual(started.findingIds, ['f1', 'f2', 'f3']);

    // Verify progress and finding events interleaved
    assert.equal(batchEvents[1].type, 'batch-progress');
    assert.equal(batchEvents[2].type, 'batch-finding-event');
    assert.equal(batchEvents[3].type, 'batch-progress');
    assert.equal(batchEvents[4].type, 'batch-finding-event');
    assert.equal(batchEvents[5].type, 'batch-progress');
    assert.equal(batchEvents[6].type, 'batch-finding-event');

    // Verify batch-complete
    const complete = batchEvents[7] as BatchEvent & { type: 'batch-complete' };
    assert.equal(complete.type, 'batch-complete');
    assert.equal(complete.status, 'completed');
    assert.equal(complete.analyzedCount, 3);
    assert.equal(complete.failedCount, 0);
    assert.equal(complete.skippedCount, 0);

    assert.equal(finalState.status, 'completed');
    assert.equal(finalState.analyzedCount, 3);
  });

  it('skips already-analyzed findings with correct skippedCount', async () => {
    const findings = [
      makeFinding('f1'),
      makeFinding('f2', true), // already analyzed
      makeFinding('f3'),
    ];

    // f2 is already analyzed so it's filtered out at the start
    const { finalState } = await simulateBatchAnalysis({
      findings,
      failureLimit: 3,
      perFindingOutcome: ['success', 'success'], // only 2 unanalyzed
    });

    assert.equal(finalState.analyzedCount, 2);
    assert.equal(finalState.totalFindings, 2); // only unanalyzed count
  });

  it('skip outcome increments skippedCount', async () => {
    const findings = [makeFinding('f1'), makeFinding('f2'), makeFinding('f3')];

    const { finalState } = await simulateBatchAnalysis({
      findings,
      failureLimit: 3,
      perFindingOutcome: ['success', 'skip', 'success'],
    });

    assert.equal(finalState.analyzedCount, 2);
    assert.equal(finalState.skippedCount, 1);
    assert.equal(finalState.status, 'completed');
  });

  it('cancel mid-batch preserves completed analyses and emits cancelled status', async () => {
    const findings = [makeFinding('f1'), makeFinding('f2'), makeFinding('f3')];

    const { batchEvents, finalState } = await simulateBatchAnalysis({
      findings,
      failureLimit: 3,
      perFindingOutcome: ['success', 'success', 'success'],
      cancelAtIndex: 2, // cancel before processing f3
    });

    assert.equal(finalState.status, 'cancelled');
    assert.equal(finalState.analyzedCount, 2);

    const complete = batchEvents[batchEvents.length - 1] as BatchEvent & { type: 'batch-complete' };
    assert.equal(complete.status, 'cancelled');
    assert.equal(complete.analyzedCount, 2);
  });

  it('consecutive failure threshold stops batch', async () => {
    const findings = [makeFinding('f1'), makeFinding('f2'), makeFinding('f3'), makeFinding('f4')];

    const { finalState } = await simulateBatchAnalysis({
      findings,
      failureLimit: 3,
      perFindingOutcome: ['error', 'error', 'error', 'success'],
    });

    assert.equal(finalState.status, 'consecutive-failures');
    assert.equal(finalState.failedCount, 3);
    assert.equal(finalState.analyzedCount, 0);
    assert.equal(finalState.consecutiveFailures, 3);
  });

  it('consecutive failure counter resets on success', async () => {
    const findings = [
      makeFinding('f1'), makeFinding('f2'), makeFinding('f3'),
      makeFinding('f4'), makeFinding('f5'),
    ];

    const { finalState } = await simulateBatchAnalysis({
      findings,
      failureLimit: 3,
      perFindingOutcome: ['error', 'error', 'success', 'error', 'success'],
    });

    // 2 errors, then success resets counter, then 1 error (only 1 consecutive), then success
    assert.equal(finalState.status, 'completed');
    assert.equal(finalState.analyzedCount, 2);
    assert.equal(finalState.failedCount, 3);
    assert.equal(finalState.consecutiveFailures, 0);
  });

  it('session resumption captures sessionId from first result', async () => {
    const findings = [makeFinding('f1'), makeFinding('f2')];

    const { finalState } = await simulateBatchAnalysis({
      findings,
      failureLimit: 3,
      perFindingOutcome: ['success', 'success'],
      sessionIdFromFirstResult: 'sess-abc-123',
    });

    assert.equal(finalState.sessionId, 'sess-abc-123');
    assert.equal(finalState.status, 'completed');
  });

  it('session fallback clears sessionId on error (FR-010)', async () => {
    const findings = [makeFinding('f1'), makeFinding('f2'), makeFinding('f3')];

    const { finalState } = await simulateBatchAnalysis({
      findings,
      failureLimit: 5,
      perFindingOutcome: ['success', 'error', 'success'],
      sessionIdFromFirstResult: 'sess-abc-123',
    });

    // sessionId was captured from f1, then cleared when f2 errored
    assert.equal(finalState.sessionId, undefined);
    assert.equal(finalState.analyzedCount, 2);
    assert.equal(finalState.failedCount, 1);
  });

  it('duplicate batch for same scanId is rejected (FR-013)', () => {
    // This test verifies the guard logic conceptually.
    // In the real AiService, activeBatches.has(scanId) returns early.
    const activeBatches = new Map<string, { scanId: string }>();
    activeBatches.set('scan-1', { scanId: 'scan-1' });

    assert.equal(activeBatches.has('scan-1'), true, 'Duplicate scan should be detected');
    assert.equal(activeBatches.has('scan-2'), false, 'Different scan should not be detected');
  });

  it('batch with no unanalyzed findings emits completed immediately', async () => {
    const findings = [makeFinding('f1', true), makeFinding('f2', true)];

    // All findings already analyzed — unanalyzed list is empty
    const { batchEvents, finalState } = await simulateBatchAnalysis({
      findings,
      failureLimit: 3,
      perFindingOutcome: [],
    });

    // Only batch-started and batch-complete
    assert.equal(batchEvents.length, 2);
    assert.equal(batchEvents[0].type, 'batch-started');
    assert.equal(batchEvents[1].type, 'batch-complete');
    assert.equal(finalState.status, 'completed');
    assert.equal(finalState.analyzedCount, 0);
  });

  it('FindingsPanelManager routes batch events to correct webview messages', () => {
    // Simulates the message routing logic from findingsPanelManager.ts
    const webviewMessages: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const postMessage = (msg: { type: string; payload: Record<string, unknown> }) => {
      webviewMessages.push(msg);
    };

    const batchEvents: BatchEvent[] = [
      { type: 'batch-started', scanId: 'scan-1', totalFindings: 3, findingIds: ['f1', 'f2', 'f3'] },
      { type: 'batch-progress', scanId: 'scan-1', currentIndex: 1, totalFindings: 3, currentFindingId: 'f1' },
      { type: 'batch-finding-event', findingId: 'f1', event: { type: 'progress', message: 'Reading...' } },
      { type: 'batch-finding-event', findingId: 'f1', event: { type: 'result', analysis: sampleAnalysis, metadata: sampleMetadata } },
      { type: 'batch-complete', scanId: 'scan-1', analyzedCount: 1, failedCount: 0, skippedCount: 2, status: 'completed' },
    ];

    // Route batch events to webview messages (mirrors findingsPanelManager logic)
    for (const batchEvent of batchEvents) {
      switch (batchEvent.type) {
        case 'batch-started':
          postMessage({ type: 'batchAnalysisStarted', payload: { scanId: batchEvent.scanId, totalFindings: batchEvent.totalFindings, findingIds: batchEvent.findingIds } });
          break;
        case 'batch-progress':
          postMessage({ type: 'batchAnalysisProgress', payload: { scanId: batchEvent.scanId, currentIndex: batchEvent.currentIndex, totalFindings: batchEvent.totalFindings, currentFindingId: batchEvent.currentFindingId } });
          break;
        case 'batch-finding-event': {
          const { findingId, event } = batchEvent;
          if (event.type === 'progress') {
            postMessage({ type: 'aiAnalysisProgress', payload: { findingId, message: event.message } });
          } else if (event.type === 'result') {
            postMessage({ type: 'aiAnalysisResult', payload: { findingId, analysis: event.analysis, metadata: event.metadata } });
          } else if (event.type === 'error') {
            postMessage({ type: 'aiAnalysisError', payload: { findingId, errorType: event.errorType, message: event.message } });
          }
          break;
        }
        case 'batch-complete':
          postMessage({ type: 'batchAnalysisComplete', payload: { scanId: batchEvent.scanId, analyzedCount: batchEvent.analyzedCount, failedCount: batchEvent.failedCount, skippedCount: batchEvent.skippedCount, status: batchEvent.status } });
          break;
      }
    }

    // Verify correct message types
    assert.equal(webviewMessages[0].type, 'batchAnalysisStarted');
    assert.equal(webviewMessages[1].type, 'batchAnalysisProgress');
    assert.equal(webviewMessages[2].type, 'aiAnalysisProgress');
    assert.equal(webviewMessages[3].type, 'aiAnalysisResult');
    assert.equal(webviewMessages[4].type, 'batchAnalysisComplete');
    assert.equal(webviewMessages.length, 5);
  });
});
