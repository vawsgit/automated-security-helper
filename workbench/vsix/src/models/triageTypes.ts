import type { SuppressionScope } from './types';

// Triage Categories
export type TriageCategory = 'suppress' | 'easy_fix' | 'systemic';

// Base classification fields shared by all categories
export interface TriageClassificationBase {
  category: TriageCategory;
  explanation: string;
  risk: string;
}

// Suppress: finding should be suppressed (false positive, acceptable risk)
export interface TriageSuppressClassification extends TriageClassificationBase {
  category: 'suppress';
  suppressionRationale: string;
  suggestedScope: SuppressionScope;
  suggestedJustification: string;
}

// Easy Fix: non-risky, single-file code change
export interface TriageEasyFixClassification extends TriageClassificationBase {
  category: 'easy_fix';
  fixDescription: string;
  codeBefore: string;
  codeAfter: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

// Systemic: complex, multi-file, or high-risk fix
export interface TriageSystemicClassification extends TriageClassificationBase {
  category: 'systemic';
  complexityRationale: string;
  repairGuidance: RepairGuidance;
}

export interface RepairGuidance {
  affectedAreas: string[];
  vulnerabilityNature: string;
  remediationApproach: string;
  sideEffects: string[];
  testingRecommendations: string;
}

// Discriminated union of all classification types
export type TriageClassification =
  | TriageSuppressClassification
  | TriageEasyFixClassification
  | TriageSystemicClassification;

// Metadata about the classification (AI model, cost, timestamp)
export interface TriageMetadata {
  classifiedAt: string;
  modelId: string;
  costUsd: number;
}

// Stored in Finding.triageAnalysis JSON field
export interface StoredTriageAnalysis {
  analysis: TriageClassification;
  metadata: TriageMetadata;
  fingerprint: string;
}

// Severity-level breakdown for the triage dashboard
export interface TriageSeverityBreakdown {
  total: number;
  suppress: number;
  easyFix: number;
  systemic: number;
  unanalyzed: number;
  addressed: number;
}

// Computed summary for the triage dashboard
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface TriageSummary {
  bySeverity: Record<Severity, TriageSeverityBreakdown>;
  totalFindings: number;
  totalAnalyzed: number;
  totalUnanalyzed: number;
}
