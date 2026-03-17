import type { Scan, Finding } from '@prisma/client';
import type { ScanSummary, FindingRow, Severity, Disposition } from './types';

const SEVERITY_KEYS: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function mapScanToSummary(scan: Scan): ScanSummary {
  const breakdown = (scan.severityBreakdown ?? {}) as Record<string, number>;
  const severityCounts = {} as Record<Severity, number>;
  for (const key of SEVERITY_KEYS) {
    severityCounts[key] = breakdown[key] ?? 0;
  }

  return {
    id: scan.id,
    projectId: scan.projectId,
    scanTargetId: scan.scanTargetId,
    status: scan.status,
    startedAt: scan.startedAt.toISOString(),
    completedAt: scan.completedAt?.toISOString(),
    sourceDirectory: scan.sourceDir,
    findingCount: scan.findingsCount,
    severityCounts,
  };
}

export function mapFindingToRow(finding: Finding): FindingRow {
  return {
    id: finding.id,
    scanId: finding.scanId,
    scanTargetId: finding.scanTargetId,
    title: finding.title,
    description: finding.description,
    severity: finding.severity as Severity,
    disposition: (finding.disposition ?? 'PENDING') as Disposition,
    scanner: finding.scanner,
    ruleId: finding.ruleId,
    filePath: finding.file,
    startLine: finding.startLine,
    endLine: finding.endLine ?? finding.startLine,
    codeSnippet: finding.snippet ?? '',
    notes: '',
    firstDetectedAt: new Date().toISOString(),
    aiAnalysis: null,
    suppression: null,
  };
}
