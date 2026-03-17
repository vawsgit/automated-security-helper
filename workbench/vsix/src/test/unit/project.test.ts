import assert from 'node:assert/strict';
import { DatabaseService } from '../../services/database';
import { ensureProject } from '../../services/project';

/** Create a mock WorkspaceFolder matching the vscode.WorkspaceFolder shape. */
function mockFolder(name: string, fsPath: string) {
  return {
    uri: { fsPath },
    name,
    index: 0,
  } as unknown as import('vscode').WorkspaceFolder;
}

describe('ensureProject', () => {
  before(async () => {
    await DatabaseService.initialize();
  });

  after(async () => {
    await DatabaseService.close();
  });

  it('creates project with correct name and rootPath on first call', async () => {
    const folders = [mockFolder('my-project', '/home/user/my-project')];
    const project = await ensureProject(DatabaseService.client, folders);

    assert.equal(project.name, 'my-project');
    assert.equal(project.rootPath, '/home/user/my-project');
  });

  it('returns a project with a valid UUID id', async () => {
    const folders = [mockFolder('uuid-test', '/home/user/uuid-test')];
    const project = await ensureProject(DatabaseService.client, folders);

    assert.ok(project.id);
    assert.match(project.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns existing project on second call (idempotent)', async () => {
    const folders = [mockFolder('idempotent', '/home/user/idempotent')];
    const first = await ensureProject(DatabaseService.client, folders);
    const second = await ensureProject(DatabaseService.client, folders);

    assert.equal(first.id, second.id);

    const count = await DatabaseService.client.project.count({
      where: { rootPath: '/home/user/idempotent' },
    });
    assert.equal(count, 1);
  });

  it('uses first workspace folder when multiple are provided', async () => {
    const folders = [
      mockFolder('first-folder', '/home/user/first-folder'),
      mockFolder('second-folder', '/home/user/second-folder'),
    ];
    const project = await ensureProject(
      DatabaseService.client,
      folders as unknown as readonly import('vscode').WorkspaceFolder[],
    );

    assert.equal(project.name, 'first-folder');
    assert.equal(project.rootPath, '/home/user/first-folder');
  });
});
