import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseService } from '../../services/database';
import { AdminService } from '../../services/admin';

describe('AdminService', () => {
  describe('getApplicationInfo', () => {
    before(async () => {
      await DatabaseService.initialize();
    });

    after(async () => {
      await DatabaseService.close();
    });

    it('returns correct counts for an empty database', async () => {
      const info = await AdminService.getApplicationInfo(DatabaseService.client, '1.0.0');
      assert.equal(info.extensionVersion, '1.0.0');
      assert.equal(info.stats.projectCount, 0);
      assert.equal(info.stats.scanCount, 0);
      assert.equal(info.stats.findingCount, 0);
    });

    it('returns schema version from DatabaseService.getSchemaVersion()', async () => {
      const info = await AdminService.getApplicationInfo(DatabaseService.client, '2.0.0');
      assert.notEqual(info.schemaVersion, 'none');
      assert.ok(info.schemaVersion.length > 0);
    });

    it('returns accurate counts after data is created', async () => {
      const db = DatabaseService.client;
      const project = await db.project.create({
        data: { name: 'Admin Test', rootPath: '/test/admin-info' },
      });
      const target = await db.scanTarget.create({
        data: { projectId: project.id, path: '/src', displayName: 'Source' },
      });
      const scan = await db.scan.create({
        data: {
          projectId: project.id,
          scanTargetId: target.id,
          sourceDir: '/src',
          status: 'COMPLETED',
        },
      });
      await db.finding.create({
        data: {
          scanId: scan.id,
          projectId: project.id,
          scanTargetId: target.id,
          ruleId: 'TEST-001',
          scanner: 'test',
          severity: 'HIGH',
          file: 'test.py',
          startLine: 1,
          title: 'Test finding',
          description: 'Test',
        },
      });

      const info = await AdminService.getApplicationInfo(db, '1.0.0');
      assert.equal(info.stats.projectCount, 1);
      assert.equal(info.stats.scanCount, 1);
      assert.equal(info.stats.findingCount, 1);
    });
  });

  describe('resetApplication', () => {
    it('deletes the data directory', async () => {
      // Create a temp directory to simulate storagePath
      const tempStorage = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ash-admin-test-'));
      const dbDir = path.join(tempStorage, 'ash-workbench-pgdata');
      await fs.promises.mkdir(dbDir, { recursive: true });
      await fs.promises.writeFile(path.join(dbDir, 'test.db'), 'fake data');

      assert.ok(fs.existsSync(dbDir));

      await AdminService.resetApplication(tempStorage);

      assert.ok(!fs.existsSync(dbDir));

      // Cleanup
      await fs.promises.rm(tempStorage, { recursive: true, force: true });
    });

    it('does not throw if the data directory does not exist', async () => {
      const tempStorage = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ash-admin-test-'));

      // No dbDir created — reset should not throw
      await assert.doesNotReject(() => AdminService.resetApplication(tempStorage));

      // Cleanup
      await fs.promises.rm(tempStorage, { recursive: true, force: true });
    });
  });
});
