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
  analysisMetadata: AnalysisMetadata | null;
  suppression: SuppressionData | null;
  isCurrentlySuppressed: boolean;
  suppressionSource: 'ash_yaml' | null;
  // Triage classification (Spec 026)
  triageAnalysis: TriageClassification | null;
  triageMetadata: TriageMetadata | null;
  triageFingerprint: string | null;
  isTriageStale: boolean;
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

export interface SuppressionSummary {
  total: number;
  suppressed: number;
  active: number;
}

export interface AshYamlConfigSummary {
  suppressionCount: number;
  ignorePathCount: number;
  severityThreshold: string;
  projectName: string | null;
  enabledScanners: string[];
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

export type SuppressionScope = 'file_rule' | 'rule_everywhere' | 'file_all_rules';

// Repairability Triage (Spec 026)

export type TriageCategory = 'suppress' | 'easy_fix' | 'systemic';

export interface TriageClassificationBase {
  category: TriageCategory;
  explanation: string;
  risk: string;
}

export interface TriageSuppressClassification extends TriageClassificationBase {
  category: 'suppress';
  suppressionRationale: string;
  suggestedScope: SuppressionScope;
  suggestedJustification: string;
}

export interface TriageEasyFixClassification extends TriageClassificationBase {
  category: 'easy_fix';
  fixDescription: string;
  codeBefore: string;
  codeAfter: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface RepairGuidance {
  affectedAreas: string[];
  vulnerabilityNature: string;
  remediationApproach: string;
  sideEffects: string[];
  testingRecommendations: string;
}

export interface TriageSystemicClassification extends TriageClassificationBase {
  category: 'systemic';
  complexityRationale: string;
  repairGuidance: RepairGuidance;
}

export type TriageClassification =
  | TriageSuppressClassification
  | TriageEasyFixClassification
  | TriageSystemicClassification;

export interface TriageMetadata {
  classifiedAt: string;
  modelId: string;
  costUsd: number;
}

export interface StoredTriageAnalysis {
  analysis: TriageClassification;
  metadata: TriageMetadata;
  fingerprint: string;
}

export interface TriageSeverityBreakdown {
  total: number;
  suppress: number;
  easyFix: number;
  systemic: number;
  unanalyzed: number;
  addressed: number;
}

export interface TriageSummary {
  bySeverity: Record<Severity, TriageSeverityBreakdown>;
  totalFindings: number;
  totalAnalyzed: number;
  totalUnanalyzed: number;
}

export interface SuppressionInput {
  findingId: string;
  filePath: string;
  ruleId: string;
  scope: SuppressionScope;
  justification: string;
  includeLineRange: boolean;
  startLine: number | null;
  endLine: number | null;
  expiration: string | null;
}

export interface SuppressionResult {
  success: boolean;
  findingId: string;
  action: 'suppress' | 'unsuppress';
  error?: string;
}

// Suppression Management View (Spec 017)

export type SuppressionStatus = 'active' | 'unused' | 'expired';

export interface MatchedFindingRef {
  id: string;
  severity: string;
  title: string;
  file: string;
  line: number | null;
}

export interface SuppressionEntry extends AshSuppression {
  status: SuppressionStatus;
  matchCount: number;
  matchedFindings: MatchedFindingRef[];
}

export interface SuppressionWriteResult {
  success: boolean;
  error?: string;
}

// AI Analysis (Spec 018)

export interface AnalysisMetadata {
  analyzedAt: string;
  modelId: string;
  costUsd: number;
  toolsUsed: string[];
}

export interface StoredAiAnalysis {
  analysis: AiAnalysis;
  metadata: AnalysisMetadata;
}

// Suppression Message Generation (Spec 025)

export type GenerationMode = 'generate' | 'regenerate' | 'refine';

export interface StructuredJustification {
  finding: string;
  riskAssessment: string;
  rationale: string;
  scope: string;
}

export interface SuppressionMessageResult {
  findingId: string;
  message: string;
  sections: StructuredJustification;
}
