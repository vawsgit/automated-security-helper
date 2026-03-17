import type { PrismaClient } from '@prisma/client';
import type { FindingRow, ScanSummary, ScanTarget, DispositionSummary, FilterState, Severity, Disposition } from '../models/types';
import { mapFindingToRow, mapScanToSummary, mapScanTargetToView } from '../models/mappers';

const DISPOSITION_KEYS: Disposition[] = ['PENDING', 'FIX', 'SUPPRESS', 'DEFER'];
const SEVERITY_KEYS: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export class FindingsService {
  constructor(
    private readonly db: PrismaClient,
    private readonly projectId: string,
  ) {}

  async getFindingDetail(findingId: string): Promise<FindingRow | null> {
    const finding = await this.db.finding.findUnique({
      where: { id: findingId },
    });
    if (!finding) {
      return null;
    }
    return mapFindingToRow(finding);
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
    return findings.map(mapFindingToRow);
  }

  async getSummary(): Promise<DispositionSummary> {
    const groups = await this.db.finding.groupBy({
      by: ['disposition'],
      where: { projectId: this.projectId },
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

  async getScanSummaries(): Promise<ScanSummary[]> {
    const scans = await this.db.scan.findMany({
      where: { projectId: this.projectId },
      orderBy: { startedAt: 'desc' },
    });
    return scans.map(mapScanToSummary);
  }

  async getScanTargets(): Promise<ScanTarget[]> {
    const targets = await this.db.scanTarget.findMany({
      where: { projectId: this.projectId },
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
}
