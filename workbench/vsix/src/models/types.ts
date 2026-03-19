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

export interface FilterState {
  severity?: Severity[];
  scanner?: string;
  disposition?: Disposition[];
  filePattern?: string;
}

export interface ApplicationInfo {
  extensionVersion: string;
  schemaVersion: string;
  stats: {
    projectCount: number;
    scanCount: number;
    findingCount: number;
  };
}

export interface AshSuppression {
  path: string;
  reason: string;
  rule_id: string | null;
  line_start: number | null;
  line_end: number | null;
  expiration: string | null;
}

export interface AshIgnorePath {
  path: string;
  reason: string;
  expiration: string | null;
}

export interface AshScannerEntry {
  name: string;
  enabled: boolean;
}

export interface AshYamlConfig {
  suppressions: AshSuppression[];
  ignorePaths: AshIgnorePath[];
  severityThreshold: 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  projectName: string;
  scanners: AshScannerEntry[];
  failOnFindings: boolean;
  configFilePath: string | null;
}
