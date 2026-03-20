import assert from 'node:assert/strict';
import { DatabaseService } from '../../services/database';
import { FindingsService } from '../../services/findings';
import type { AiAnalysis, AnalysisMetadata, StoredAiAnalysis } from '../../models/types';

describe('mapFindingToRow — metadata extraction (T026)', () => {
  let service: FindingsService;
  let projectId: string;
  let scanId: string;
  let scanTargetId: string;

  const sampleAnalysis: AiAnalysis = {
    explanation: 'Hardcoded credentials detected in source code.',
    riskAssessment: {
      exploitability: 'HIGH',
      exploitabilityRationale: 'Credentials are visible in source.',
      impact: 'CRITICAL',
      impactRationale: 'Full compromise possible.',
      likelihood: 'HIGH',
      likelihoodRationale: 'Source code is commonly leaked.',
    },
    suggestedFix: {
      description: 'Use environment variables.',
      diffText: '- password = "secret"\n+ password = os.environ["PASSWORD"]',
      language: 'python',
    },
    references: [
      { title: 'CWE-798', url: 'https://cwe.mitre.org/data/definitions/798.html' },
    ],
  };

  const sampleMetadata: AnalysisMetadata = {
    analyzedAt: '2026-03-20T10:00:00.000Z',
    modelId: 'claude-sonnet-4-6',
    costUsd: 0.0123,
    toolsUsed: ['Read', 'Grep', 'get_finding_context'],
  };

  before(async function () {
    this.timeout(30_000);
    await DatabaseService.initialize();
    const db = DatabaseService.client;

    const project = await db.project.create({
      data: { name: 'Mapper Metadata Test', rootPath: '/test/mappers' },
    });
    projectId = project.id;

    const target = await db.scanTarget.create({
      data: { projectId, path: '/src', displayName: 'Source' },
    });
    scanTargetId = target.id;

    const scan = await db.scan.create({
      data: { projectId, scanTargetId, sourceDir: '/src', status: 'COMPLETED' },
    });
    scanId = scan.id;

    service = new FindingsService(db, projectId);
  });

  after(async () => {
    await DatabaseService.close();
  });

  it('extracts both aiAnalysis and analysisMetadata from StoredAiAnalysis JSON', async () => {
    const db = DatabaseService.client;
    const stored: StoredAiAnalysis = { analysis: sampleAnalysis, metadata: sampleMetadata };
    const finding = await db.finding.create({
      data: {
        scanId,
        projectId,
        scanTargetId,
        ruleId: 'MAP001',
        scanner: 'bandit',
        severity: 'HIGH',
        file: '/src/creds.py',
        startLine: 10,
        title: 'Mapper test',
        description: 'Test metadata extraction',
        aiAnalysis: stored as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    const detail = await service.getFindingDetail(finding.id);
    assert.ok(detail, 'Expected FindingRow, got null');

    // Verify aiAnalysis
    assert.ok(detail.aiAnalysis, 'aiAnalysis should be non-null');
    assert.equal(detail.aiAnalysis.explanation, sampleAnalysis.explanation);
    assert.equal(detail.aiAnalysis.riskAssessment.exploitability, 'HIGH');
    assert.equal(detail.aiAnalysis.riskAssessment.impact, 'CRITICAL');
    assert.ok(detail.aiAnalysis.suggestedFix);
    assert.equal(detail.aiAnalysis.suggestedFix.language, 'python');
    assert.equal(detail.aiAnalysis.references.length, 1);

    // Verify analysisMetadata
    assert.ok(detail.analysisMetadata, 'analysisMetadata should be non-null');
    assert.equal(detail.analysisMetadata.analyzedAt, '2026-03-20T10:00:00.000Z');
    assert.equal(detail.analysisMetadata.modelId, 'claude-sonnet-4-6');
    assert.equal(detail.analysisMetadata.costUsd, 0.0123);
    assert.deepStrictEqual(detail.analysisMetadata.toolsUsed, ['Read', 'Grep', 'get_finding_context']);
  });

  it('returns null for both when aiAnalysis column is null', async () => {
    const db = DatabaseService.client;
    const finding = await db.finding.create({
      data: {
        scanId,
        projectId,
        scanTargetId,
        ruleId: 'MAP002',
        scanner: 'bandit',
        severity: 'LOW',
        file: '/src/null.py',
        startLine: 1,
        title: 'Null metadata test',
        description: 'No AI analysis stored',
      },
    });

    const detail = await service.getFindingDetail(finding.id);
    assert.ok(detail, 'Expected FindingRow, got null');
    assert.equal(detail.aiAnalysis, null, 'aiAnalysis should be null');
    assert.equal(detail.analysisMetadata, null, 'analysisMetadata should be null');
  });

  it('returns null metadata when stored JSON has analysis but no metadata key', async () => {
    const db = DatabaseService.client;
    const finding = await db.finding.create({
      data: {
        scanId,
        projectId,
        scanTargetId,
        ruleId: 'MAP003',
        scanner: 'bandit',
        severity: 'MEDIUM',
        file: '/src/partial.py',
        startLine: 5,
        title: 'Partial metadata test',
        description: 'Analysis without metadata key',
        aiAnalysis: { analysis: sampleAnalysis } as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    const detail = await service.getFindingDetail(finding.id);
    assert.ok(detail);
    assert.ok(detail.aiAnalysis, 'aiAnalysis should be non-null');
    assert.equal(detail.analysisMetadata, null, 'analysisMetadata should be null when metadata key is missing');
  });

  it('returns null analysis when stored JSON has metadata but no analysis key', async () => {
    const db = DatabaseService.client;
    const finding = await db.finding.create({
      data: {
        scanId,
        projectId,
        scanTargetId,
        ruleId: 'MAP004',
        scanner: 'bandit',
        severity: 'LOW',
        file: '/src/meta-only.py',
        startLine: 1,
        title: 'Metadata-only test',
        description: 'Metadata without analysis key',
        aiAnalysis: { metadata: sampleMetadata } as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    const detail = await service.getFindingDetail(finding.id);
    assert.ok(detail);
    assert.equal(detail.aiAnalysis, null, 'aiAnalysis should be null when analysis key is missing');
    assert.ok(detail.analysisMetadata, 'analysisMetadata should be non-null');
    assert.equal(detail.analysisMetadata.modelId, 'claude-sonnet-4-6');
  });
});
