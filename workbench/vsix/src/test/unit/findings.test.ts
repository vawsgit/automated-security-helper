import assert from 'node:assert/strict';
import { DatabaseService } from '../../services/database';
import { FindingsService } from '../../services/findings';

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
});
