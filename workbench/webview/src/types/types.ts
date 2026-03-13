export type ScanStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type Disposition = 'PENDING' | 'FIX' | 'SUPPRESS' | 'DEFER';

export interface Project {
  id: string;
  name: string;
  rootPath: string;
}

export interface ScanSummary {
  id: string;
  projectId: string;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;
  sourceDirectory: string;
  findingCount: number;
  severityCounts: Record<Severity, number>;
}

export interface FindingRow {
  id: string;
  scanId: string;
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
}

export interface DispositionSummary {
  total: number;
  counts: Record<Disposition, number>;
}
