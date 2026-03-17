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
});
