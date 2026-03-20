import type { PrismaClient, Disposition as PrismaDisposition } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { FindingRow, ScanSummary, ScanTarget, DispositionSummary, FilterState, Severity, Disposition, SuppressionSummary, AiAnalysis, AnalysisMetadata, StoredAiAnalysis } from '../models/types';
import { mapFindingToRow, mapScanToSummary, mapScanTargetToView } from '../models/mappers';
import type { AshYamlService } from './ashYaml';
import type { ScanRootService } from './scanRoot';

export interface CurrentFindingsResult {
  findings: FindingRow[];
  summary: SuppressionSummary;
  scanId: string;
  lastScannedAt: string;
}

const DISPOSITION_KEYS: Disposition[] = ['PENDING', 'FIX', 'SUPPRESS', 'DEFER'];
const SEVERITY_KEYS: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export class FindingsService {
  constructor(
    private readonly db: PrismaClient,
    private readonly projectId: string,
  ) {}

  async setAiAnalysis(findingId: string, analysis: AiAnalysis, metadata: AnalysisMetadata): Promise<void> {
    const stored: StoredAiAnalysis = { analysis, metadata };
    await this.db.finding.update({
      where: { id: findingId },
      data: { aiAnalysis: stored as unknown as Prisma.InputJsonValue },
    });
  }

  async clearAiAnalysis(findingId: string): Promise<void> {
    await this.db.finding.update({
      where: { id: findingId },
      data: { aiAnalysis: Prisma.JsonNull },
    });
  }

  async deleteScan(scanId: string): Promise<void> {
    const scan = await this.db.scan.findUnique({ where: { id: scanId } });
    if (!scan) {
      throw new Error(`Scan not found: ${scanId}`);
    }
    if (scan.status === 'RUNNING') {
      throw new Error('Cannot delete a running scan');
    }
    await this.db.scan.delete({ where: { id: scanId } });
  }

  async setDisposition(findingId: string, disposition: Disposition): Promise<FindingRow> {
    const updated = await this.db.finding.update({
      where: { id: findingId },
      data: { disposition: disposition as PrismaDisposition },
    });
    return mapFindingToRow(updated);
  }

  async setNotes(findingId: string, notes: string): Promise<FindingRow> {
    const updated = await this.db.finding.update({
      where: { id: findingId },
      data: { notes },
    });
    return mapFindingToRow(updated);
  }

  async getFindingDetail(findingId: string): Promise<FindingRow | null> {
    const finding = await this.db.finding.findUnique({
      where: { id: findingId },
    });
    if (!finding) {
      return null;
    }
    return mapFindingToRow(finding);
  }

  async getFindingsByScanTarget(scanTargetId: string): Promise<FindingRow[]> {
    const findings = await this.db.finding.findMany({
      where: { scanTargetId },
    });
    return findings.map(f => mapFindingToRow(f));
  }

  async getFindings(scanId: string, filters?: FilterState): Promise<FindingRow[]> {
    const where: Record<string, unknown> = { scanId };

    if (filters) {
      if (filters.severity && filters.severity.length > 0) {
        where.severity = { in: filters.severity };
      }
      if (filters.scanner) {
        where.scanner = { equals: filters.scanner };
      }
      if (filters.disposition && filters.disposition.length > 0) {
        where.disposition = { in: filters.disposition };
      }
      if (filters.filePattern) {
        where.file = { contains: filters.filePattern };
      }
    }

    const findings = await this.db.finding.findMany({ where });
    return findings.map(f => mapFindingToRow(f));
  }

  async getSummary(scanRootFilter?: { OR: Array<Record<string, unknown>> }): Promise<DispositionSummary> {
    const where: Record<string, unknown> = { projectId: this.projectId };
    if (scanRootFilter) {
      where.scanTarget = scanRootFilter;
    }

    const groups = await this.db.finding.groupBy({
      by: ['disposition'],
      where,
      _count: true,
    });

    const counts = {} as Record<Disposition, number>;
    let total = 0;
    for (const key of DISPOSITION_KEYS) {
      counts[key] = 0;
    }
    for (const group of groups) {
      const disposition = group.disposition as Disposition;
      counts[disposition] = group._count;
      total += group._count;
    }

    return { total, counts };
  }

  async getScanSummaries(scanRootFilter?: { OR: Array<Record<string, unknown>> }): Promise<ScanSummary[]> {
    const where: Record<string, unknown> = { projectId: this.projectId };
    if (scanRootFilter) {
      where.scanTarget = scanRootFilter;
    }

    const scans = await this.db.scan.findMany({
      where,
      orderBy: { startedAt: 'desc' },
    });
    return scans.map(mapScanToSummary);
  }

  async getScanTargets(scanRootFilter?: { OR: Array<Record<string, unknown>> }): Promise<ScanTarget[]> {
    const where: Record<string, unknown> = { projectId: this.projectId };
    if (scanRootFilter) {
      Object.assign(where, scanRootFilter);
    }

    const targets = await this.db.scanTarget.findMany({
      where,
    });

    const result: ScanTarget[] = [];
    for (const target of targets) {
      const scanCount = await this.db.scan.count({
        where: { scanTargetId: target.id },
      });

      const latestScan = await this.db.scan.findFirst({
        where: { scanTargetId: target.id },
        orderBy: { startedAt: 'desc' },
      });

      const severityGroups = await this.db.finding.groupBy({
        by: ['severity'],
        where: { scanTargetId: target.id },
        _count: true,
      });

      const severityCounts = {} as Record<Severity, number>;
      let findingCount = 0;
      for (const key of SEVERITY_KEYS) {
        severityCounts[key] = 0;
      }
      for (const group of severityGroups) {
        const severity = group.severity as Severity;
        severityCounts[severity] = group._count;
        findingCount += group._count;
      }

      const dispositionGroups = await this.db.finding.groupBy({
        by: ['disposition'],
        where: { scanTargetId: target.id },
        _count: true,
      });

      const dispositionCounts = {} as Record<Disposition, number>;
      for (const key of DISPOSITION_KEYS) {
        dispositionCounts[key] = 0;
      }
      for (const group of dispositionGroups) {
        const disposition = group.disposition as Disposition;
        dispositionCounts[disposition] = group._count;
      }

      result.push(mapScanTargetToView(target, {
        scanCount,
        findingCount,
        lastScannedAt: latestScan?.startedAt.toISOString(),
        severityCounts,
        triageSummary: { total: findingCount, counts: dispositionCounts },
      }));
    }

    return result;
  }

  async getCurrentFindings(
    scanRootService: ScanRootService,
    ashYamlService: AshYamlService,
  ): Promise<CurrentFindingsResult | null> {
    const scanRoot = scanRootService.getEffectiveScanRoot();

    // Find latest completed scan for the scan root
    const latestScan = await this.db.scan.findFirst({
      where: {
        projectId: this.projectId,
        status: 'COMPLETED',
        scanTarget: {
          OR: [
            { path: scanRoot },
            { path: { startsWith: scanRoot } },
          ],
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!latestScan) {
      return null;
    }

    // Fetch all findings for the latest scan
    const findings = await this.db.finding.findMany({
      where: { scanId: latestScan.id },
    });

    // Map findings to rows first (without suppression)
    const rows = findings.map(f => mapFindingToRow(f));

    // Batch match suppressions
    const suppressionMap = ashYamlService.getMatchingSuppressions(rows);

    // Re-map with suppression data
    const enrichedRows = findings.map(f => {
      const row = mapFindingToRow(f);
      const match = suppressionMap.get(row.id);
      if (match) {
        return mapFindingToRow(f, match);
      }
      return row;
    });

    const suppressed = enrichedRows.filter(r => r.isCurrentlySuppressed).length;
    const total = enrichedRows.length;

    return {
      findings: enrichedRows,
      summary: { total, suppressed, active: total - suppressed },
      scanId: latestScan.id,
      lastScannedAt: latestScan.completedAt?.toISOString() ?? latestScan.startedAt.toISOString(),
    };
  }

  async getFindingsWithSuppressionOverlay(
    scanId: string,
    ashYamlService: AshYamlService,
    filters?: FilterState,
  ): Promise<FindingRow[]> {
    const findings = await this.getFindings(scanId, filters);
    const suppressionMap = ashYamlService.getMatchingSuppressions(findings);

    return findings.map(row => {
      const match = suppressionMap.get(row.id);
      if (match) {
        return { ...row, isCurrentlySuppressed: true, suppressionSource: 'ash_yaml' as const, suppression: {
          justification: match.reason,
          yamlEntry: `- path: "${match.path}"\n  reason: "${match.reason}"`,
          expiresAt: match.expiration,
          createdAt: '',
        }};
      }
      return row;
    });
  }
}
