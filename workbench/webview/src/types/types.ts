export type ScanStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type Disposition = 'PENDING' | 'FIX' | 'SUPPRESS' | 'DEFER';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface Project {
  id: string;
  name: string;
  rootPath: string;
}

export interface ScanSummary {
  id: string;
  projectId: string;
  scanTargetId: string;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;
  sourceDirectory: string;
  findingCount: number;
  severityCounts: Record<Severity, number>;
}

export interface AiReference {
  title: string;
  url: string;
}

export interface SuggestedFix {
  description: string;
  diffText: string;
  language: string;
}

export interface RiskAssessment {
  exploitability: RiskLevel;
  exploitabilityRationale: string;
  impact: RiskLevel;
  impactRationale: string;
  likelihood: RiskLevel;
  likelihoodRationale: string;
}

export interface AiAnalysis {
  explanation: string;
  riskAssessment: RiskAssessment;
  suggestedFix: SuggestedFix | null;
  references: AiReference[];
}

export interface SuppressionData {
  justification: string;
  yamlEntry: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface FindingRow {
  id: string;
  scanId: string;
  scanTargetId: string;
  title: string;
  description: string;
  severity: Severity;
  disposition: Disposition;
  scanner: string;
  ruleId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  notes: string;
  firstDetectedAt: string;
  aiAnalysis: AiAnalysis | null;
  suppression: SuppressionData | null;
}

export interface ScanTarget {
  id: string;
  path: string;
  displayName: string;
  lastScannedAt?: string;
  scanCount: number;
  findingCount: number;
  severityCounts: Record<Severity, number>;
  triageSummary: DispositionSummary;
}

export interface DispositionSummary {
  total: number;
  counts: Record<Disposition, number>;
}
