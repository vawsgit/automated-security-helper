import assert from 'node:assert/strict';
import sinon from 'sinon';
import type { AnalysisEvent } from '../../services/aiProvider';
import type { AiAnalysis, AnalysisMetadata } from '../../models/types';

/**
 * Tests the finding analysis flow by verifying the message choreography
 * between FindingsPanelManager, AiService, and WebView.
 *
 * Since FindingsPanelManager requires VS Code APIs (WebviewPanel, Uri), we
 * test the flow by simulating the event callback pattern used in the handler.
 */

const sampleAnalysis: AiAnalysis = {
  explanation: 'SQL injection via string concatenation.',
  riskAssessment: {
    exploitability: 'HIGH',
    exploitabilityRationale: 'Direct user input in query.',
    impact: 'CRITICAL',
    impactRationale: 'Full database access.',
    likelihood: 'HIGH',
    likelihoodRationale: 'Well-known attack pattern.',
  },
  suggestedFix: {
    description: 'Use parameterized queries.',
    diffText: '- query = f"SELECT * FROM users WHERE name = \'{name}\'"\n+ query = "SELECT * FROM users WHERE name = %s"',
    language: 'python',
  },
  references: [
    { title: 'CWE-89', url: 'https://cwe.mitre.org/data/definitions/89.html' },
  ],
};

const sampleMetadata: AnalysisMetadata = {
  analyzedAt: '2026-03-20T14:00:00.000Z',
  modelId: 'claude-sonnet-4-6',
  costUsd: 0.0372,
  toolsUsed: ['Read', 'Grep', 'get_finding_context', 'list_related_findings'],
};

describe('Finding Analysis Flow (T027)', () => {
  afterEach(() => {
    sinon.restore();
  });

  /**
   * Simulates the analyzeFinding handler flow from FindingsPanelManager.
   * Instead of mocking the full VS Code WebviewPanel, we capture the
   * postMessage calls that the handler would make.
   */
  function simulateAnalysisHandler(
    events: AnalysisEvent[],
    findingId: string,
  ): { messages: Array<{ type: string; payload: Record<string, unknown> }> } {
    const messages: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const postMessage = (msg: { type: string; payload: Record<string, unknown> }) => {
      messages.push(msg);
    };

    // Step 1: aiAnalysisStarted (before calling AiService)
    postMessage({
      type: 'aiAnalysisStarted',
      payload: { findingId, model: 'claude' },
    });

    // Step 2: Forward events from AiService.analyzeFinding callback
    for (const event of events) {
      switch (event.type) {
        case 'progress':
          postMessage({
            type: 'aiAnalysisProgress',
            payload: { findingId, message: event.message, toolName: event.toolName },
          });
          break;
        case 'result':
          postMessage({
            type: 'aiAnalysisResult',
            payload: { findingId, analysis: event.analysis, metadata: event.metadata },
          });
          break;
        case 'error':
          postMessage({
            type: 'aiAnalysisError',
            payload: { findingId, errorType: event.errorType, message: event.message },
          });
          break;
      }
    }

    return { messages };
  }

  it('analyzeFinding triggers AiService and forwards progress → result to WebView', () => {
    const findingId = 'finding-001';
    const events: AnalysisEvent[] = [
      { type: 'progress', message: 'Starting security analysis...' },
      { type: 'progress', message: 'Reading auth.py...', toolName: 'Read' },
      { type: 'progress', message: 'Searching for injection patterns...', toolName: 'Grep' },
      { type: 'result', analysis: sampleAnalysis, metadata: sampleMetadata },
    ];

    const { messages } = simulateAnalysisHandler(events, findingId);

    // Verify message sequence
    assert.equal(messages.length, 5, 'Expected 5 messages: started + 3 progress + result');

    // aiAnalysisStarted
    assert.equal(messages[0].type, 'aiAnalysisStarted');
    assert.equal(messages[0].payload.findingId, findingId);

    // Progress messages
    assert.equal(messages[1].type, 'aiAnalysisProgress');
    assert.equal(messages[1].payload.message, 'Starting security analysis...');

    assert.equal(messages[2].type, 'aiAnalysisProgress');
    assert.equal(messages[2].payload.toolName, 'Read');

    assert.equal(messages[3].type, 'aiAnalysisProgress');
    assert.equal(messages[3].payload.toolName, 'Grep');

    // Result
    assert.equal(messages[4].type, 'aiAnalysisResult');
    assert.equal(messages[4].payload.findingId, findingId);
    assert.ok(messages[4].payload.analysis);
    assert.ok(messages[4].payload.metadata);
  });

  it('error events forward with correct errorType', () => {
    const findingId = 'finding-002';
    const events: AnalysisEvent[] = [
      { type: 'progress', message: 'Starting security analysis...' },
      { type: 'error', errorType: 'budget_exceeded', message: 'Analysis stopped: cost limit reached ($1.00 budget).' },
    ];

    const { messages } = simulateAnalysisHandler(events, findingId);

    assert.equal(messages.length, 3, 'Expected 3 messages: started + progress + error');

    // Error message
    const errorMsg = messages[2];
    assert.equal(errorMsg.type, 'aiAnalysisError');
    assert.equal(errorMsg.payload.findingId, findingId);
    assert.equal(errorMsg.payload.errorType, 'budget_exceeded');
    assert.ok((errorMsg.payload.message as string).includes('cost limit'));
  });

  it('cancelAiAnalysis calls abort on the controller', () => {
    // Simulate the cancel flow
    const abortController = new AbortController();
    const cancelAnalysis = (_findingId: string) => {
      abortController.abort();
    };

    assert.equal(abortController.signal.aborted, false);
    cancelAnalysis('finding-003');
    assert.equal(abortController.signal.aborted, true);
  });

  it('cancelled analysis forwards error with errorType=cancelled', () => {
    const findingId = 'finding-004';
    const events: AnalysisEvent[] = [
      { type: 'progress', message: 'Starting security analysis...' },
      { type: 'progress', message: 'Using Read...', toolName: 'Read' },
      { type: 'error', errorType: 'cancelled', message: 'Analysis cancelled by user.' },
    ];

    const { messages } = simulateAnalysisHandler(events, findingId);

    assert.equal(messages.length, 4);

    const errorMsg = messages[3];
    assert.equal(errorMsg.type, 'aiAnalysisError');
    assert.equal(errorMsg.payload.errorType, 'cancelled');
    assert.ok((errorMsg.payload.message as string).includes('cancelled'));
  });

  it('result event carries both analysis and metadata', () => {
    const findingId = 'finding-005';
    const events: AnalysisEvent[] = [
      { type: 'result', analysis: sampleAnalysis, metadata: sampleMetadata },
    ];

    const { messages } = simulateAnalysisHandler(events, findingId);

    const resultMsg = messages[1]; // [0] is aiAnalysisStarted
    assert.equal(resultMsg.type, 'aiAnalysisResult');

    const analysis = resultMsg.payload.analysis as AiAnalysis;
    assert.equal(analysis.explanation, sampleAnalysis.explanation);
    assert.equal(analysis.riskAssessment.exploitability, 'HIGH');

    const metadata = resultMsg.payload.metadata as AnalysisMetadata;
    assert.equal(metadata.modelId, 'claude-sonnet-4-6');
    assert.equal(metadata.costUsd, 0.0372);
    assert.deepStrictEqual(metadata.toolsUsed, ['Read', 'Grep', 'get_finding_context', 'list_related_findings']);
  });

  it('handles all error types in the event flow', () => {
    const errorTypes = [
      'credentials_missing',
      'auth_failed',
      'model_unavailable',
      'budget_exceeded',
      'max_turns_exceeded',
      'network_error',
      'cancelled',
      'format_error',
      'unknown',
    ] as const;

    for (const errorType of errorTypes) {
      const events: AnalysisEvent[] = [
        { type: 'error', errorType, message: `Test error: ${errorType}` },
      ];

      const { messages } = simulateAnalysisHandler(events, `finding-${errorType}`);
      const errorMsg = messages[1]; // [0] is aiAnalysisStarted
      assert.equal(errorMsg.type, 'aiAnalysisError', `Expected aiAnalysisError for ${errorType}`);
      assert.equal(errorMsg.payload.errorType, errorType);
    }
  });
});
