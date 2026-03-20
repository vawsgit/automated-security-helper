import assert from 'node:assert/strict';
import { DatabaseService } from '../../services/database';
import { FindingsService } from '../../services/findings';
import type { AiAnalysis, AnalysisMetadata } from '../../models/types';

describe('FindingsService', () => {
  let service: FindingsService;
  let projectId: string;
  let scanId: string;
  let scanTargetId: string;

  before(async () => {
    await DatabaseService.initialize();
    const db = DatabaseService.client;

    const project = await db.project.create({
      data: { name: 'Findings Test', rootPath: '/test/findings' },
    });
    projectId = project.id;

    const target = await db.scanTarget.create({
      data: { projectId, path: '/src', displayName: 'Source' },
    });
    scanTargetId = target.id;

    const scan = await db.scan.create({
      data: {
        projectId,
        scanTargetId,
        sourceDir: '/src',
        status: 'COMPLETED',
      },
    });
    scanId = scan.id;

    service = new FindingsService(db, projectId);
  });

  after(async () => {
    await DatabaseService.close();
  });

  describe('getFindingDetail', () => {
    it('returns mapped FindingRow for an existing finding', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'B101',
          scanner: 'bandit',
          severity: 'HIGH',
          file: '/src/app.py',
          startLine: 42,
          title: 'Hardcoded password',
          description: 'Use of hardcoded password detected',
          snippet: 'password = "secret123"',
        },
      });

      const detail = await service.getFindingDetail(finding.id);

      assert.ok(detail, 'Expected a FindingRow, got null');
      assert.equal(detail.id, finding.id);
      assert.equal(detail.scanId, scanId);
      assert.equal(detail.scanTargetId, scanTargetId);
      assert.equal(detail.ruleId, 'B101');
      assert.equal(detail.scanner, 'bandit');
      assert.equal(detail.severity, 'HIGH');
      assert.equal(detail.filePath, '/src/app.py');
      assert.equal(detail.startLine, 42);
      assert.equal(detail.title, 'Hardcoded password');
      assert.equal(detail.description, 'Use of hardcoded password detected');
      assert.equal(detail.codeSnippet, 'password = "secret123"');
      assert.equal(detail.disposition, 'PENDING');
    });

    it('returns null for a non-existent finding ID', async () => {
      const detail = await service.getFindingDetail('non-existent-id-12345');
      assert.equal(detail, null);
    });
  });

  describe('setDisposition', () => {
    it('updates and returns the correct disposition', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'B102',
          scanner: 'bandit',
          severity: 'MEDIUM',
          file: '/src/config.py',
          startLine: 10,
          title: 'Exec used',
          description: 'Use of exec detected',
        },
      });

      const updated = await service.setDisposition(finding.id, 'FIX');

      assert.equal(updated.id, finding.id);
      assert.equal(updated.disposition, 'FIX');
    });

    it('throws for a non-existent finding ID', async () => {
      await assert.rejects(
        () => service.setDisposition('non-existent-id-99999', 'SUPPRESS'),
      );
    });
  });

  describe('setNotes', () => {
    it('updates and returns the correct notes', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'B103',
          scanner: 'bandit',
          severity: 'LOW',
          file: '/src/util.py',
          startLine: 5,
          title: 'Assert used',
          description: 'Use of assert detected',
        },
      });

      const updated = await service.setNotes(finding.id, 'Accepted risk per security review');

      assert.equal(updated.id, finding.id);
      assert.equal(updated.notes, 'Accepted risk per security review');
    });
  });

  describe('deleteScan', () => {
    it('removes scan and cascade-deletes findings', async () => {
      const db = DatabaseService.client;
      const scan = await db.scan.create({
        data: {
          projectId,
          scanTargetId,
          sourceDir: '/src',
          status: 'COMPLETED',
        },
      });
      await db.finding.create({
        data: {
          scanId: scan.id,
          projectId,
          scanTargetId,
          ruleId: 'DEL1',
          scanner: 'bandit',
          severity: 'HIGH',
          file: '/src/del.py',
          startLine: 1,
          title: 'To be deleted',
          description: 'This finding should be cascade-deleted',
        },
      });

      await service.deleteScan(scan.id);

      const deletedScan = await db.scan.findUnique({ where: { id: scan.id } });
      assert.equal(deletedScan, null);
      const orphanedFindings = await db.finding.findMany({ where: { scanId: scan.id } });
      assert.equal(orphanedFindings.length, 0);
    });

    it('throws for a non-existent scan ID', async () => {
      await assert.rejects(
        () => service.deleteScan('non-existent-scan-99999'),
        /Scan not found/,
      );
    });

    it('throws for a RUNNING scan', async () => {
      const db = DatabaseService.client;
      const scan = await db.scan.create({
        data: {
          projectId,
          scanTargetId,
          sourceDir: '/src',
          status: 'RUNNING',
        },
      });

      await assert.rejects(
        () => service.deleteScan(scan.id),
        /Cannot delete a running scan/,
      );

      // Clean up
      await db.scan.update({ where: { id: scan.id }, data: { status: 'CANCELLED' } });
      await db.scan.delete({ where: { id: scan.id } });
    });
  });

  describe('notes mapping from database', () => {
    it('maps notes from DB through getFindingDetail', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'B104',
          scanner: 'bandit',
          severity: 'INFO',
          file: '/src/readme.py',
          startLine: 1,
          title: 'Info finding',
          description: 'Informational',
          notes: 'Pre-existing note from DB',
        },
      });

      const detail = await service.getFindingDetail(finding.id);

      assert.ok(detail);
      assert.equal(detail.notes, 'Pre-existing note from DB');
    });
  });

  // T001, T002: setAiAnalysis persistence round-trip and overwrite
  describe('setAiAnalysis', () => {
    const sampleAnalysis: AiAnalysis = {
      explanation: 'This is a hardcoded password vulnerability.',
      riskAssessment: {
        exploitability: 'HIGH',
        exploitabilityRationale: 'Credentials are visible in source code.',
        impact: 'CRITICAL',
        impactRationale: 'Full system compromise if credentials are leaked.',
        likelihood: 'HIGH',
        likelihoodRationale: 'Source code is often shared or leaked.',
      },
      suggestedFix: {
        description: 'Use environment variables instead.',
        diffText: '- password = "secret123"\n+ password = os.environ["DB_PASSWORD"]',
        language: 'python',
      },
      references: [
        { title: 'CWE-798', url: 'https://cwe.mitre.org/data/definitions/798.html' },
      ],
    };

    const sampleMetadata: AnalysisMetadata = {
      analyzedAt: '2026-03-20T10:00:00.000Z',
      modelId: 'claude-sonnet-4-6',
      costUsd: 0.0042,
      toolsUsed: ['read_file', 'grep'],
    };

    it('persists analysis and retrieves it via getFindingDetail (T001)', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'AI001',
          scanner: 'bandit',
          severity: 'HIGH',
          file: '/src/creds.py',
          startLine: 10,
          title: 'Hardcoded creds',
          description: 'Hardcoded credentials detected',
        },
      });

      await service.setAiAnalysis(finding.id, sampleAnalysis, sampleMetadata);

      const detail = await service.getFindingDetail(finding.id);
      assert.ok(detail, 'Expected a FindingRow, got null');
      assert.ok(detail.aiAnalysis, 'Expected aiAnalysis to be populated');
      assert.equal(detail.aiAnalysis.explanation, sampleAnalysis.explanation);
      assert.equal(detail.aiAnalysis.riskAssessment.exploitability, 'HIGH');
      assert.equal(detail.aiAnalysis.riskAssessment.impact, 'CRITICAL');
      assert.ok(detail.aiAnalysis.suggestedFix);
      assert.equal(detail.aiAnalysis.suggestedFix.language, 'python');
      assert.equal(detail.aiAnalysis.references.length, 1);
      assert.equal(detail.aiAnalysis.references[0].title, 'CWE-798');
    });

    it('overwrites previous analysis on re-analysis (T002)', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'AI002',
          scanner: 'bandit',
          severity: 'MEDIUM',
          file: '/src/overwrite.py',
          startLine: 20,
          title: 'Overwrite test',
          description: 'Finding for overwrite test',
        },
      });

      // First analysis
      await service.setAiAnalysis(finding.id, sampleAnalysis, sampleMetadata);

      // Second analysis with different data
      const updatedAnalysis: AiAnalysis = {
        explanation: 'Updated explanation after re-analysis.',
        riskAssessment: {
          exploitability: 'LOW',
          exploitabilityRationale: 'Updated rationale.',
          impact: 'MEDIUM',
          impactRationale: 'Updated impact.',
          likelihood: 'LOW',
          likelihoodRationale: 'Updated likelihood.',
        },
        suggestedFix: null,
        references: [],
      };
      const updatedMetadata: AnalysisMetadata = {
        analyzedAt: '2026-03-20T11:00:00.000Z',
        modelId: 'claude-opus-4-6',
        costUsd: 0.015,
        toolsUsed: ['read_file'],
      };

      await service.setAiAnalysis(finding.id, updatedAnalysis, updatedMetadata);

      const detail = await service.getFindingDetail(finding.id);
      assert.ok(detail?.aiAnalysis);
      assert.equal(detail.aiAnalysis.explanation, 'Updated explanation after re-analysis.');
      assert.equal(detail.aiAnalysis.riskAssessment.exploitability, 'LOW');
      assert.equal(detail.aiAnalysis.suggestedFix, null);
      assert.equal(detail.aiAnalysis.references.length, 0);
    });
  });

  // T003: parseStoredAiAnalysis with malformed input (tested indirectly through DB round-trip)
  describe('parseStoredAiAnalysis (malformed input)', () => {
    it('returns null for finding with no aiAnalysis (default null)', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'MAL001',
          scanner: 'bandit',
          severity: 'LOW',
          file: '/src/mal1.py',
          startLine: 1,
          title: 'Malformed test 1',
          description: 'Default null aiAnalysis',
        },
      });

      const detail = await service.getFindingDetail(finding.id);
      assert.ok(detail);
      assert.equal(detail.aiAnalysis, null);
    });

    it('returns null for empty object {}', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'MAL002',
          scanner: 'bandit',
          severity: 'LOW',
          file: '/src/mal2.py',
          startLine: 1,
          title: 'Malformed test 2',
          description: 'Empty object aiAnalysis',
          aiAnalysis: {},
        },
      });

      const detail = await service.getFindingDetail(finding.id);
      assert.ok(detail);
      assert.equal(detail.aiAnalysis, null);
    });

    it('returns null for object missing analysis key', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'MAL003',
          scanner: 'bandit',
          severity: 'LOW',
          file: '/src/mal3.py',
          startLine: 1,
          title: 'Malformed test 3',
          description: 'Missing analysis key',
          aiAnalysis: { metadata: { analyzedAt: '2026-01-01' } },
        },
      });

      const detail = await service.getFindingDetail(finding.id);
      assert.ok(detail);
      assert.equal(detail.aiAnalysis, null);
    });

    it('returns null for object with non-object analysis value', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'MAL004',
          scanner: 'bandit',
          severity: 'LOW',
          file: '/src/mal4.py',
          startLine: 1,
          title: 'Malformed test 4',
          description: 'Non-object analysis value',
          aiAnalysis: { analysis: 'not-an-object' },
        },
      });

      const detail = await service.getFindingDetail(finding.id);
      assert.ok(detail);
      assert.equal(detail.aiAnalysis, null);
    });

    it('returns null for a plain string JSON value', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'MAL005',
          scanner: 'bandit',
          severity: 'LOW',
          file: '/src/mal5.py',
          startLine: 1,
          title: 'Malformed test 5',
          description: 'Plain string JSON',
          aiAnalysis: 'just a string',
        },
      });

      const detail = await service.getFindingDetail(finding.id);
      assert.ok(detail);
      assert.equal(detail.aiAnalysis, null);
    });
  });

  // T004, T005: clearAiAnalysis round-trip and idempotency
  describe('clearAiAnalysis', () => {
    const analysisForClear: AiAnalysis = {
      explanation: 'Analysis to be cleared.',
      riskAssessment: {
        exploitability: 'MEDIUM',
        exploitabilityRationale: 'Moderate.',
        impact: 'MEDIUM',
        impactRationale: 'Moderate.',
        likelihood: 'MEDIUM',
        likelihoodRationale: 'Moderate.',
      },
      suggestedFix: null,
      references: [],
    };
    const metadataForClear: AnalysisMetadata = {
      analyzedAt: '2026-03-20T12:00:00.000Z',
      modelId: 'claude-sonnet-4-6',
      costUsd: 0.003,
      toolsUsed: [],
    };

    it('clears a previously persisted analysis (T004)', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'CLR001',
          scanner: 'bandit',
          severity: 'HIGH',
          file: '/src/clear.py',
          startLine: 1,
          title: 'Clear test',
          description: 'Finding for clear test',
        },
      });

      // Persist analysis first
      await service.setAiAnalysis(finding.id, analysisForClear, metadataForClear);
      const before = await service.getFindingDetail(finding.id);
      assert.ok(before?.aiAnalysis, 'Analysis should be set before clearing');

      // Clear it
      await service.clearAiAnalysis(finding.id);
      const after = await service.getFindingDetail(finding.id);
      assert.ok(after);
      assert.equal(after.aiAnalysis, null, 'Analysis should be null after clearing');
    });

    it('completes without error when clearing a finding with no analysis (T005)', async () => {
      const db = DatabaseService.client;
      const finding = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'CLR002',
          scanner: 'bandit',
          severity: 'LOW',
          file: '/src/clear-noop.py',
          startLine: 1,
          title: 'Clear noop test',
          description: 'Finding with no analysis',
        },
      });

      // Should not throw
      await service.clearAiAnalysis(finding.id);

      const detail = await service.getFindingDetail(finding.id);
      assert.ok(detail);
      assert.equal(detail.aiAnalysis, null);
    });
  });

  // T006: Cascade-delete with AI analysis
  describe('deleteScan with AI analysis', () => {
    it('cascade-deletes findings and their AI analysis data (T006)', async () => {
      const db = DatabaseService.client;
      const scan = await db.scan.create({
        data: {
          projectId,
          scanTargetId,
          sourceDir: '/src',
          status: 'COMPLETED',
        },
      });
      const finding = await db.finding.create({
        data: {
          scanId: scan.id,
          projectId,
          scanTargetId,
          ruleId: 'CASCADE001',
          scanner: 'bandit',
          severity: 'CRITICAL',
          file: '/src/cascade.py',
          startLine: 1,
          title: 'Cascade test',
          description: 'Finding with AI analysis for cascade test',
        },
      });

      // Persist AI analysis on the finding
      await service.setAiAnalysis(finding.id, {
        explanation: 'This will be cascade-deleted.',
        riskAssessment: {
          exploitability: 'HIGH',
          exploitabilityRationale: 'Test.',
          impact: 'HIGH',
          impactRationale: 'Test.',
          likelihood: 'HIGH',
          likelihoodRationale: 'Test.',
        },
        suggestedFix: null,
        references: [],
      }, {
        analyzedAt: '2026-03-20T13:00:00.000Z',
        modelId: 'claude-sonnet-4-6',
        costUsd: 0.001,
        toolsUsed: [],
      });

      // Verify analysis was set
      const beforeDelete = await service.getFindingDetail(finding.id);
      assert.ok(beforeDelete?.aiAnalysis, 'Analysis should exist before cascade delete');

      // Delete the scan — should cascade-delete findings and their analysis
      await service.deleteScan(scan.id);

      const deletedScan = await db.scan.findUnique({ where: { id: scan.id } });
      assert.equal(deletedScan, null, 'Scan should be deleted');
      const orphanedFindings = await db.finding.findMany({ where: { scanId: scan.id } });
      assert.equal(orphanedFindings.length, 0, 'All findings should be cascade-deleted');
    });
  });
});
