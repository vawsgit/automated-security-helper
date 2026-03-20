import type { FindingRow, AiAnalysis, AnalysisMetadata } from '../models/types';

// --- Parameter Types ---

export interface AnalyzeParams {
  finding: FindingRow;
  workspaceRoot: string;
  maxBudgetUsd: number;
  maxTurns: number;
  toolMode: 'read-only' | 'full';
  abortSignal: AbortSignal;
  /** Optional MCP servers to attach to the agent query (e.g., finding-analysis tools). */
  mcpServers?: Record<string, Record<string, unknown>>;
}

// --- Event Types ---

export type AnalysisErrorType =
  | 'credentials_missing'
  | 'auth_failed'
  | 'model_unavailable'
  | 'budget_exceeded'
  | 'max_turns_exceeded'
  | 'format_error'
  | 'network_error'
  | 'cancelled'
  | 'unknown';

export interface AnalysisProgressEvent {
  type: 'progress';
  message: string;
  toolName?: string;
}

export interface AnalysisResultEvent {
  type: 'result';
  analysis: AiAnalysis;
  metadata: AnalysisMetadata;
}

export interface AnalysisErrorEvent {
  type: 'error';
  errorType: AnalysisErrorType;
  message: string;
}

export type AnalysisEvent =
  | AnalysisProgressEvent
  | AnalysisResultEvent
  | AnalysisErrorEvent;

// --- Result Types ---

export interface ConnectionTestResult {
  success: boolean;
  model?: string;
  latencyMs: number;
  error?: {
    type: AnalysisErrorType;
    message: string;
  };
}

export interface ProviderCapabilities {
  structuredOutput: boolean;
  toolUse: boolean;
  codeEditing: boolean;
  webSearch: boolean;
  sessionPersistence: boolean;
}

// --- Provider Interface ---

export interface AiProvider {
  analyzeFinding(params: AnalyzeParams): AsyncGenerator<AnalysisEvent, void, undefined>;
  testConnection(): Promise<ConnectionTestResult>;
  getCapabilities(): ProviderCapabilities;
}
