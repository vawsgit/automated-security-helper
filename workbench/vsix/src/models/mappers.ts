import type { Scan, Finding, ScanTarget as PrismaScanTarget } from '@prisma/client';
import type { ScanSummary, FindingRow, ScanTarget, Severity, Disposition, DispositionSummary } from './types';

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

export interface ScanTargetAggregates {
  scanCount: number;
  findingCount: number;
  lastScannedAt: string | undefined;
  severityCounts: Record<Severity, number>;
  triageSummary: DispositionSummary;
}

export function mapScanTargetToView(target: PrismaScanTarget, aggregates: ScanTargetAggregates): ScanTarget {
  return {
    id: target.id,
    path: target.path,
    displayName: target.displayName,
    lastScannedAt: aggregates.lastScannedAt,
    scanCount: aggregates.scanCount,
    findingCount: aggregates.findingCount,
    severityCounts: aggregates.severityCounts,
    triageSummary: aggregates.triageSummary,
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
    notes: finding.notes ?? '',
    firstDetectedAt: new Date().toISOString(),
    aiAnalysis: null,
    suppression: null,
  };
}
