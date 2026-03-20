/**
 * Reducer state transition tests for AI analysis messages (T028).
 *
 * NOTE: This file requires a test runner (e.g., vitest) to execute.
 * The reducer is a pure function — no React DOM or VS Code API needed.
 * Install vitest with: npm install -D vitest && add "test": "vitest run" to scripts.
 *
 * For now, this file serves as executable documentation of the expected
 * state transitions and will type-check during the webview build.
 */
import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../App';
import type { AppAction, AnalysisUIState } from '../App';
import type { FindingRow, AiAnalysis, AnalysisMetadata } from '../types/types';

const sampleFinding: FindingRow = {
  id: 'f-001',
  scanId: 's-001',
  scanTargetId: 'st-001',
  title: 'SQL Injection',
  description: 'SQL injection via string concatenation',
  severity: 'HIGH',
  disposition: 'PENDING',
  scanner: 'semgrep',
  ruleId: 'sql-injection-001',
  filePath: '/src/db.py',
  startLine: 42,
  endLine: 42,
  codeSnippet: 'query = f"SELECT * FROM users WHERE name = \'{name}\'"',
  notes: '',
  firstDetectedAt: '2026-03-20T10:00:00.000Z',
  aiAnalysis: null,
  analysisMetadata: null,
  suppression: null,
  isCurrentlySuppressed: false,
  suppressionSource: null,
};

const sampleAnalysis: AiAnalysis = {
  explanation: 'SQL injection vulnerability.',
  riskAssessment: {
    exploitability: 'HIGH',
    exploitabilityRationale: 'Direct input.',
    impact: 'CRITICAL',
    impactRationale: 'Full DB access.',
    likelihood: 'HIGH',
    likelihoodRationale: 'Common pattern.',
  },
  suggestedFix: {
    description: 'Parameterized queries.',
    diffText: '- query = f"..."\n+ query = "SELECT * FROM users WHERE name = %s"',
    language: 'python',
  },
  references: [{ title: 'CWE-89', url: 'https://cwe.mitre.org/data/definitions/89.html' }],
};

const sampleMetadata: AnalysisMetadata = {
  analyzedAt: '2026-03-20T14:00:00.000Z',
  modelId: 'claude-sonnet-4-6',
  costUsd: 0.0372,
  toolsUsed: ['Read', 'Grep'],
};

function stateWithFinding(finding: FindingRow = sampleFinding) {
  return {
    ...initialState,
    context: 'editorPanel' as const,
    view: 'findingDetail' as const,
    findings: [finding],
    currentFindings: [finding],
    selectedFinding: finding,
  };
}

describe('AI Analysis reducer state transitions (T028)', () => {
  describe('aiAnalysisStarted', () => {
    it('creates analysisStates entry with status=analyzing', () => {
      const state = stateWithFinding();
      const action: AppAction = {
        type: 'MESSAGE',
        payload: {
          type: 'aiAnalysisStarted',
          payload: { findingId: 'f-001', model: 'claude' },
        },
      };

      const next = reducer(state, action);

      expect(next.analysisStates['f-001']).toBeDefined();
      expect(next.analysisStates['f-001'].status).toBe('analyzing');
      expect(next.analysisStates['f-001'].message).toBe('Starting analysis\u2026');
    });

    it('does not affect other existing analysisStates entries', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-other': { status: 'analyzing' as const, message: 'Running...' },
        },
      };
      const action: AppAction = {
        type: 'MESSAGE',
        payload: {
          type: 'aiAnalysisStarted',
          payload: { findingId: 'f-001', model: 'claude' },
        },
      };

      const next = reducer(state, action);

      expect(next.analysisStates['f-other']).toBeDefined();
      expect(next.analysisStates['f-001']).toBeDefined();
    });
  });

  describe('aiAnalysisProgress', () => {
    it('updates message and toolName on existing entry', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-001': { status: 'analyzing' as const, message: 'Starting...' },
        },
      };
      const action: AppAction = {
        type: 'MESSAGE',
        payload: {
          type: 'aiAnalysisProgress',
          payload: { findingId: 'f-001', message: 'Reading auth.py...', toolName: 'Read' },
        },
      };

      const next = reducer(state, action);

      expect(next.analysisStates['f-001'].message).toBe('Reading auth.py...');
      expect(next.analysisStates['f-001'].toolName).toBe('Read');
      expect(next.analysisStates['f-001'].status).toBe('analyzing');
    });
  });

  describe('aiAnalysisResult', () => {
    it('removes analysisStates entry', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-001': { status: 'analyzing' as const, message: 'Running...' },
        },
      };
      const action: AppAction = {
        type: 'MESSAGE',
        payload: {
          type: 'aiAnalysisResult',
          payload: { findingId: 'f-001', analysis: sampleAnalysis, metadata: sampleMetadata },
        },
      };

      const next = reducer(state, action);

      expect(next.analysisStates['f-001']).toBeUndefined();
    });

    it('updates finding aiAnalysis in findings array', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-001': { status: 'analyzing' as const, message: 'Running...' },
        },
      };
      const action: AppAction = {
        type: 'MESSAGE',
        payload: {
          type: 'aiAnalysisResult',
          payload: { findingId: 'f-001', analysis: sampleAnalysis, metadata: sampleMetadata },
        },
      };

      const next = reducer(state, action);

      const updatedFinding = next.findings.find(f => f.id === 'f-001');
      expect(updatedFinding?.aiAnalysis).toEqual(sampleAnalysis);
    });

    it('updates finding analysisMetadata alongside aiAnalysis', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-001': { status: 'analyzing' as const, message: 'Running...' },
        },
      };
      const action: AppAction = {
        type: 'MESSAGE',
        payload: {
          type: 'aiAnalysisResult',
          payload: { findingId: 'f-001', analysis: sampleAnalysis, metadata: sampleMetadata },
        },
      };

      const next = reducer(state, action);

      const updatedFinding = next.findings.find(f => f.id === 'f-001');
      expect(updatedFinding?.analysisMetadata).toEqual(sampleMetadata);
    });

    it('updates selectedFinding when it matches the result findingId', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-001': { status: 'analyzing' as const, message: 'Running...' },
        },
      };
      const action: AppAction = {
        type: 'MESSAGE',
        payload: {
          type: 'aiAnalysisResult',
          payload: { findingId: 'f-001', analysis: sampleAnalysis, metadata: sampleMetadata },
        },
      };

      const next = reducer(state, action);

      expect(next.selectedFinding?.aiAnalysis).toEqual(sampleAnalysis);
      expect(next.selectedFinding?.analysisMetadata).toEqual(sampleMetadata);
    });

    it('updates currentFindings alongside findings', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-001': { status: 'analyzing' as const, message: 'Running...' },
        },
      };
      const action: AppAction = {
        type: 'MESSAGE',
        payload: {
          type: 'aiAnalysisResult',
          payload: { findingId: 'f-001', analysis: sampleAnalysis, metadata: sampleMetadata },
        },
      };

      const next = reducer(state, action);

      const current = next.currentFindings.find(f => f.id === 'f-001');
      expect(current?.aiAnalysis).toEqual(sampleAnalysis);
    });
  });

  describe('aiAnalysisError', () => {
    it('sets error status with message and errorType', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-001': { status: 'analyzing' as const, message: 'Running...' },
        },
      };
      const action: AppAction = {
        type: 'MESSAGE',
        payload: {
          type: 'aiAnalysisError',
          payload: { findingId: 'f-001', errorType: 'budget_exceeded', message: 'Cost limit reached.' },
        },
      };

      const next = reducer(state, action);

      expect(next.analysisStates['f-001'].status).toBe('error');
      expect(next.analysisStates['f-001'].message).toBe('Cost limit reached.');
      expect(next.analysisStates['f-001'].errorType).toBe('budget_exceeded');
    });
  });

  describe('DISMISS_ANALYSIS_ERROR', () => {
    it('clears the error entry from analysisStates', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-001': { status: 'error' as const, message: 'Failed.', errorType: 'network_error' },
        },
      };
      const action: AppAction = {
        type: 'DISMISS_ANALYSIS_ERROR',
        findingId: 'f-001',
      };

      const next = reducer(state, action);

      expect(next.analysisStates['f-001']).toBeUndefined();
    });

    it('does not affect other entries in analysisStates', () => {
      const state = {
        ...stateWithFinding(),
        analysisStates: {
          'f-001': { status: 'error' as const, message: 'Failed.', errorType: 'unknown' },
          'f-002': { status: 'analyzing' as const, message: 'Still running...' },
        },
      };
      const action: AppAction = {
        type: 'DISMISS_ANALYSIS_ERROR',
        findingId: 'f-001',
      };

      const next = reducer(state, action);

      expect(next.analysisStates['f-001']).toBeUndefined();
      expect(next.analysisStates['f-002']).toBeDefined();
      expect(next.analysisStates['f-002'].status).toBe('analyzing');
    });
  });
});
