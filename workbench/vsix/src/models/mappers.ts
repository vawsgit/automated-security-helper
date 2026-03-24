import { createHash } from 'crypto';
import type { Scan, Finding, ScanTarget as PrismaScanTarget } from '@prisma/client';
import type { ScanSummary, FindingRow, ScanTarget, Severity, Disposition, DispositionSummary, AshSuppression, AiAnalysis, AnalysisMetadata, StoredAiAnalysis } from './types';
import type { StoredTriageAnalysis } from './triageTypes.js';

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

export function generateYamlEntry(s: AshSuppression): string {
  const lines: string[] = [`- path: "${s.path}"`];
  if (s.rule_id) { lines.push(`  rule_id: "${s.rule_id}"`); }
  lines.push(`  reason: "${s.reason}"`);
  if (s.line_start !== null && s.line_start !== undefined) { lines.push(`  line_start: ${s.line_start}`); }
  if (s.line_end !== null && s.line_end !== undefined) { lines.push(`  line_end: ${s.line_end}`); }
  if (s.expiration) { lines.push(`  expiration: "${s.expiration}"`); }
  return lines.join('\n');
}

function parseStoredAiAnalysis(json: unknown): { analysis: AiAnalysis | null; metadata: AnalysisMetadata | null } {
  if (!json || typeof json !== 'object') {
    return { analysis: null, metadata: null };
  }
  const stored = json as StoredAiAnalysis;
  const analysis = stored.analysis && typeof stored.analysis === 'object' ? stored.analysis : null;
  const metadata = stored.metadata && typeof stored.metadata === 'object' ? stored.metadata : null;
  return { analysis, metadata };
}

export function parseStoredTriageAnalysis(json: unknown): StoredTriageAnalysis | null {
  if (!json || typeof json !== 'object') { return null; }
  const obj = json as Record<string, unknown>;
  if (!obj.analysis || !obj.metadata || !obj.fingerprint) { return null; }
  return obj as unknown as StoredTriageAnalysis;
}

export function computeTriageFingerprint(finding: {
  ruleId: string;
  file: string;
  snippet: string | null;
  severity: string;
  description: string;
}): string {
  const input = [
    finding.ruleId,
    finding.file,
    finding.snippet ?? '',
    finding.severity,
    finding.description,
  ].join('|');
  return createHash('sha256').update(input).digest('hex');
}

export function mapFindingToRow(finding: Finding, suppression?: AshSuppression): FindingRow {
  const { analysis: aiAnalysis, metadata: analysisMetadata } = parseStoredAiAnalysis(finding.aiAnalysis);
  const storedTriage = parseStoredTriageAnalysis((finding as Record<string, unknown>).triageAnalysis);
  const currentFingerprint = computeTriageFingerprint(finding);
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
    aiAnalysis,
    analysisMetadata,
    suppression: suppression ? {
      justification: suppression.reason,
      yamlEntry: generateYamlEntry(suppression),
      expiresAt: suppression.expiration,
      createdAt: '',
    } : null,
    isCurrentlySuppressed: !!suppression,
    suppressionSource: suppression ? 'ash_yaml' : null,
    triageAnalysis: storedTriage?.analysis ?? null,
    triageMetadata: storedTriage?.metadata ?? null,
    triageFingerprint: storedTriage?.fingerprint ?? null,
    isTriageStale: storedTriage
      ? currentFingerprint !== storedTriage.fingerprint
      : false,
  };
}
