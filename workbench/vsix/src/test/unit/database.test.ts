import assert from 'node:assert/strict';
import { DatabaseService } from '../../services/database';

describe('DatabaseService', () => {
  // Each top-level describe gets its own fresh in-memory database

  // ─── US1: Extension Activates with Initialized Database ───

  describe('US1: Initialization & CRUD', () => {
    before(async () => {
      await DatabaseService.initialize();
    });

    after(async () => {
      await DatabaseService.close();
    });

    it('T010: initializes fresh database with all tables', async () => {
      const client = DatabaseService.client;
      const projects = await client.project.findMany();
      const scanTargets = await client.scanTarget.findMany();
      const scans = await client.scan.findMany();
      const findings = await client.finding.findMany();

      assert.ok(Array.isArray(projects));
      assert.ok(Array.isArray(scanTargets));
      assert.ok(Array.isArray(scans));
      assert.ok(Array.isArray(findings));
    });

    it('T011: idempotent initialization returns same client', async () => {
      const client1 = await DatabaseService.initialize();
      const client2 = await DatabaseService.initialize();
      assert.strictEqual(client1, client2);
    });

    it('T012: CRUD Project', async () => {
      const client = DatabaseService.client;

      // Create
      const project = await client.project.create({
        data: { name: 'Test Project', rootPath: '/test/crud-project' },
      });
      assert.ok(project.id);
      assert.equal(project.name, 'Test Project');

      // Read
      const found = await client.project.findUnique({ where: { id: project.id } });
      assert.equal(found?.rootPath, '/test/crud-project');

      // Update
      const updated = await client.project.update({
        where: { id: project.id },
        data: { name: 'Updated Project' },
      });
      assert.equal(updated.name, 'Updated Project');

      // Delete
      await client.project.delete({ where: { id: project.id } });
      const deleted = await client.project.findUnique({ where: { id: project.id } });
      assert.equal(deleted, null);
    });

    it('T013: CRUD ScanTarget', async () => {
      const client = DatabaseService.client;

      const project = await client.project.create({
        data: { name: 'ST Project', rootPath: '/test/scan-target-crud' },
      });

      // Create
      const target = await client.scanTarget.create({
        data: {
          projectId: project.id,
          path: '/src/app',
          displayName: 'App Source',
        },
      });
      assert.ok(target.id);

      // Read
      const found = await client.scanTarget.findUnique({ where: { id: target.id } });
      assert.equal(found?.displayName, 'App Source');

      // Update
      const updated = await client.scanTarget.update({
        where: { id: target.id },
        data: { displayName: 'Updated Source' },
      });
      assert.equal(updated.displayName, 'Updated Source');

      // Delete
      await client.scanTarget.delete({ where: { id: target.id } });
      const deleted = await client.scanTarget.findUnique({ where: { id: target.id } });
      assert.equal(deleted, null);

      // Cleanup
      await client.project.delete({ where: { id: project.id } });
    });

    it('T014: CRUD Scan', async () => {
      const client = DatabaseService.client;

      const project = await client.project.create({
        data: { name: 'Scan Project', rootPath: '/test/scan-crud' },
      });
      const target = await client.scanTarget.create({
        data: { projectId: project.id, path: '/src', displayName: 'Source' },
      });

      // Create
      const scan = await client.scan.create({
        data: {
          projectId: project.id,
          scanTargetId: target.id,
          sourceDir: '/src',
          status: 'RUNNING',
        },
      });
      assert.ok(scan.id);
      assert.equal(scan.status, 'RUNNING');

      // Read
      const found = await client.scan.findUnique({ where: { id: scan.id } });
      assert.equal(found?.status, 'RUNNING');

      // Update
      const updated = await client.scan.update({
        where: { id: scan.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      assert.equal(updated.status, 'COMPLETED');
      assert.ok(updated.completedAt);

      // Delete
      await client.scan.delete({ where: { id: scan.id } });
      const deleted = await client.scan.findUnique({ where: { id: scan.id } });
      assert.equal(deleted, null);

      // Cleanup
      await client.scanTarget.delete({ where: { id: target.id } });
      await client.project.delete({ where: { id: project.id } });
    });

    it('T015: CRUD Finding', async () => {
      const client = DatabaseService.client;

      const project = await client.project.create({
        data: { name: 'Finding Project', rootPath: '/test/finding-crud' },
      });
      const target = await client.scanTarget.create({
        data: { projectId: project.id, path: '/src', displayName: 'Source' },
      });
      const scan = await client.scan.create({
        data: {
          projectId: project.id,
          scanTargetId: target.id,
          sourceDir: '/src',
          status: 'COMPLETED',
        },
      });

      // Create
      const finding = await client.finding.create({
        data: {
          scanId: scan.id,
          projectId: project.id,
          scanTargetId: target.id,
          ruleId: 'B101',
          scanner: 'bandit',
          severity: 'HIGH',
          file: 'app.py',
          startLine: 42,
          title: 'Hardcoded password',
          description: 'Use of hardcoded password detected',
        },
      });
      assert.ok(finding.id);
      assert.equal(finding.disposition, 'PENDING');

      // Read
      const found = await client.finding.findUnique({ where: { id: finding.id } });
      assert.equal(found?.ruleId, 'B101');

      // Update
      const updated = await client.finding.update({
        where: { id: finding.id },
        data: { disposition: 'FIX' },
      });
      assert.equal(updated.disposition, 'FIX');

      // Delete
      await client.finding.delete({ where: { id: finding.id } });
      const deleted = await client.finding.findUnique({ where: { id: finding.id } });
      assert.equal(deleted, null);

      // Cleanup
      await client.scan.delete({ where: { id: scan.id } });
      await client.scanTarget.delete({ where: { id: target.id } });
      await client.project.delete({ where: { id: project.id } });
    });

    it('T016: clean shutdown', async () => {
      // Initialize a separate instance, create data, close without error
      // Since we share the static instance, just verify close works
      // The after() hook calls close() — this test verifies it doesn't throw
      const client = DatabaseService.client;
      await client.project.create({
        data: { name: 'Shutdown Test', rootPath: '/test/shutdown' },
      });
      // close() is called in after() hook — if it throws, the test suite fails
    });
  });

  // ─── US2: Query Patterns ───

  describe('US2: Query Patterns', () => {
    before(async () => {
      await DatabaseService.initialize();
    });

    after(async () => {
      await DatabaseService.close();
    });

    it('T017: query findings by composite key (scanTargetId, ruleId, file)', async () => {
      const client = DatabaseService.client;

      const project = await client.project.create({
        data: { name: 'Query Project', rootPath: '/test/query-composite' },
      });
      const target = await client.scanTarget.create({
        data: { projectId: project.id, path: '/src', displayName: 'Source' },
      });
      const scan = await client.scan.create({
        data: {
          projectId: project.id,
          scanTargetId: target.id,
          sourceDir: '/src',
          status: 'COMPLETED',
        },
      });

      // Create findings with different composite keys
      await client.finding.createMany({
        data: [
          {
            scanId: scan.id, projectId: project.id, scanTargetId: target.id,
            ruleId: 'B101', scanner: 'bandit', severity: 'HIGH',
            file: 'app.py', startLine: 10, title: 'F1', description: 'D1',
          },
          {
            scanId: scan.id, projectId: project.id, scanTargetId: target.id,
            ruleId: 'B102', scanner: 'bandit', severity: 'MEDIUM',
            file: 'app.py', startLine: 20, title: 'F2', description: 'D2',
          },
          {
            scanId: scan.id, projectId: project.id, scanTargetId: target.id,
            ruleId: 'B101', scanner: 'bandit', severity: 'HIGH',
            file: 'utils.py', startLine: 5, title: 'F3', description: 'D3',
          },
        ],
      });

      // Query by composite key
      const results = await client.finding.findMany({
        where: {
          scanTargetId: target.id,
          ruleId: 'B101',
          file: 'app.py',
        },
      });

      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'F1');
    });

    it('T018: scan history ordering', async () => {
      const client = DatabaseService.client;

      const project = await client.project.create({
        data: { name: 'Order Project', rootPath: '/test/scan-order' },
      });
      const target = await client.scanTarget.create({
        data: { projectId: project.id, path: '/src', displayName: 'Source' },
      });

      // Create 3 scans with different startedAt values
      const now = new Date();
      const scan1 = await client.scan.create({
        data: {
          projectId: project.id, scanTargetId: target.id,
          sourceDir: '/src', status: 'COMPLETED',
          startedAt: new Date(now.getTime() - 3000),
        },
      });
      const scan2 = await client.scan.create({
        data: {
          projectId: project.id, scanTargetId: target.id,
          sourceDir: '/src', status: 'COMPLETED',
          startedAt: new Date(now.getTime() - 1000),
        },
      });
      const scan3 = await client.scan.create({
        data: {
          projectId: project.id, scanTargetId: target.id,
          sourceDir: '/src', status: 'COMPLETED',
          startedAt: new Date(now.getTime() - 2000),
        },
      });

      // Query with orderBy startedAt desc
      const scans = await client.scan.findMany({
        where: { projectId: project.id },
        orderBy: { startedAt: 'desc' },
      });

      assert.equal(scans.length, 3);
      assert.equal(scans[0].id, scan2.id); // most recent
      assert.equal(scans[1].id, scan3.id);
      assert.equal(scans[2].id, scan1.id); // oldest
    });

    it('T019: finding filter by scanId and severity', async () => {
      const client = DatabaseService.client;

      const project = await client.project.create({
        data: { name: 'Filter Project', rootPath: '/test/finding-filter' },
      });
      const target = await client.scanTarget.create({
        data: { projectId: project.id, path: '/src', displayName: 'Source' },
      });

      const scan1 = await client.scan.create({
        data: {
          projectId: project.id, scanTargetId: target.id,
          sourceDir: '/src', status: 'COMPLETED',
        },
      });
      const scan2 = await client.scan.create({
        data: {
          projectId: project.id, scanTargetId: target.id,
          sourceDir: '/src', status: 'COMPLETED',
        },
      });

      // Create findings across 2 scans with mixed severities
      await client.finding.createMany({
        data: [
          {
            scanId: scan1.id, projectId: project.id, scanTargetId: target.id,
            ruleId: 'R1', scanner: 'semgrep', severity: 'HIGH',
            file: 'a.py', startLine: 1, title: 'S1-High', description: 'D',
          },
          {
            scanId: scan1.id, projectId: project.id, scanTargetId: target.id,
            ruleId: 'R2', scanner: 'semgrep', severity: 'LOW',
            file: 'b.py', startLine: 1, title: 'S1-Low', description: 'D',
          },
          {
            scanId: scan2.id, projectId: project.id, scanTargetId: target.id,
            ruleId: 'R3', scanner: 'semgrep', severity: 'HIGH',
            file: 'c.py', startLine: 1, title: 'S2-High', description: 'D',
          },
        ],
      });

      // Query scan1 HIGH findings only
      const results = await client.finding.findMany({
        where: { scanId: scan1.id, severity: 'HIGH' },
      });

      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'S1-High');
    });
  });

  // ─── US3: Schema Migrations Run Automatically ───

  describe('US3: Migration Robustness', () => {
    it('T020: migration idempotency — running twice produces no errors', async () => {
      // First init
      await DatabaseService.initialize();
      const client1 = DatabaseService.client;
      await client1.project.create({
        data: { name: 'Idempotent Project', rootPath: '/test/idempotent' },
      });
      await DatabaseService.close();

      // Second init — re-runs migration check
      await DatabaseService.initialize();
      const client2 = DatabaseService.client;
      // Data should not be present (in-memory DB resets on close)
      // But initialization itself should not error
      const projects = await client2.project.findMany();
      assert.ok(Array.isArray(projects));
      await DatabaseService.close();
    });

    it('T021: Project rootPath unique constraint', async () => {
      await DatabaseService.initialize();
      const client = DatabaseService.client;

      await client.project.create({
        data: { name: 'First', rootPath: '/test/unique-path' },
      });

      await assert.rejects(
        () => client.project.create({
          data: { name: 'Second', rootPath: '/test/unique-path' },
        }),
        (err: Error) => {
          assert.ok(err.message.includes('unique constraint'));
          return true;
        },
      );

      await DatabaseService.close();
    });

    it('T022: ScanTarget composite unique constraint', async () => {
      await DatabaseService.initialize();
      const client = DatabaseService.client;

      const project = await client.project.create({
        data: { name: 'Composite Project', rootPath: '/test/composite-unique' },
      });

      await client.scanTarget.create({
        data: { projectId: project.id, path: '/src/app', displayName: 'App' },
      });

      await assert.rejects(
        () => client.scanTarget.create({
          data: { projectId: project.id, path: '/src/app', displayName: 'App Dupe' },
        }),
        (err: Error) => {
          assert.ok(err.message.includes('unique constraint'));
          return true;
        },
      );

      await DatabaseService.close();
    });
  });

  // ─── US4: Cascade Deletion of Scan Data ───

  describe('US4: Cascade Delete', () => {
    before(async () => {
      await DatabaseService.initialize();
    });

    after(async () => {
      await DatabaseService.close();
    });

    it('T023: cascade delete Scan removes all associated Findings', async () => {
      const client = DatabaseService.client;

      const project = await client.project.create({
        data: { name: 'Cascade Project', rootPath: '/test/cascade-delete' },
      });
      const target = await client.scanTarget.create({
        data: { projectId: project.id, path: '/src', displayName: 'Source' },
      });
      const scan = await client.scan.create({
        data: {
          projectId: project.id, scanTargetId: target.id,
          sourceDir: '/src', status: 'COMPLETED',
        },
      });

      // Create 5 findings
      for (let i = 0; i < 5; i++) {
        await client.finding.create({
          data: {
            scanId: scan.id, projectId: project.id, scanTargetId: target.id,
            ruleId: `RULE-${i}`, scanner: 'test', severity: 'MEDIUM',
            file: `file${i}.py`, startLine: i + 1,
            title: `Finding ${i}`, description: `Description ${i}`,
          },
        });
      }

      // Verify 5 findings exist
      const beforeDelete = await client.finding.findMany({ where: { scanId: scan.id } });
      assert.equal(beforeDelete.length, 5);

      // Delete the scan — should cascade to findings
      await client.scan.delete({ where: { id: scan.id } });

      // Verify all findings are gone
      const afterDelete = await client.finding.findMany({ where: { scanId: scan.id } });
      assert.equal(afterDelete.length, 0);
    });

    it('T024: cascade delete is isolated to deleted scan', async () => {
      const client = DatabaseService.client;

      const project = await client.project.create({
        data: { name: 'Isolated Project', rootPath: '/test/cascade-isolated' },
      });
      const target = await client.scanTarget.create({
        data: { projectId: project.id, path: '/src', displayName: 'Source' },
      });

      const scan1 = await client.scan.create({
        data: {
          projectId: project.id, scanTargetId: target.id,
          sourceDir: '/src', status: 'COMPLETED',
        },
      });
      const scan2 = await client.scan.create({
        data: {
          projectId: project.id, scanTargetId: target.id,
          sourceDir: '/src', status: 'COMPLETED',
        },
      });

      // Create 3 findings per scan
      for (const scan of [scan1, scan2]) {
        for (let i = 0; i < 3; i++) {
          await client.finding.create({
            data: {
              scanId: scan.id, projectId: project.id, scanTargetId: target.id,
              ruleId: `ISO-${i}`, scanner: 'test', severity: 'LOW',
              file: `file${i}.py`, startLine: i + 1,
              title: `Finding ${i}`, description: `Description ${i}`,
            },
          });
        }
      }

      // Delete scan1 only
      await client.scan.delete({ where: { id: scan1.id } });

      // Scan1 findings should be gone
      const scan1Findings = await client.finding.findMany({ where: { scanId: scan1.id } });
      assert.equal(scan1Findings.length, 0);

      // Scan2 findings should be intact
      const scan2Findings = await client.finding.findMany({ where: { scanId: scan2.id } });
      assert.equal(scan2Findings.length, 3);
    });
  });
});
