import assert from 'node:assert/strict';
import sinon from 'sinon';
import { EventEmitter } from 'node:events';
import type { ChildProcess, SpawnOptionsWithoutStdio } from 'node:child_process';

/**
 * Spawn function type matching child_process.spawn signature.
 * The real scanner service will accept this as a dependency,
 * allowing tests to inject a mock without stubbing frozen Node.js modules.
 */
type SpawnFn = (
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio,
) => ChildProcess;

/** Creates a mock ChildProcess backed by EventEmitters. */
function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = sinon.stub().returns(true);
  proc.pid = 12345;
  proc.stdin = null;
  proc.stdio = [null, proc.stdout, proc.stderr];
  return proc as ChildProcess;
}

describe('Scanner mock smoke test', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('sinon can create a spawn stub via dependency injection', () => {
    const mockProcess = createMockProcess();
    const spawnStub = sinon.stub<Parameters<SpawnFn>, ChildProcess>().returns(mockProcess);

    // Simulate how the scanner service will call spawn
    const proc = spawnStub('ash', ['--source-dir', '/test']);

    assert.ok(spawnStub.calledOnce, 'spawn should be called');
    assert.deepEqual(spawnStub.firstCall.args[0], 'ash');
    assert.deepEqual(spawnStub.firstCall.args[1], ['--source-dir', '/test']);
    assert.equal(proc.pid, 12345);
  });

  it('can simulate process exit with code 0 (clean scan)', (done) => {
    const mockProcess = createMockProcess();
    const spawnStub = sinon.stub<Parameters<SpawnFn>, ChildProcess>().returns(mockProcess);

    const proc = spawnStub('ash', []);

    proc.on('exit', (code) => {
      assert.equal(code, 0);
      done();
    });

    mockProcess.emit('exit', 0, null);
  });

  it('can simulate process exit with code 2 (findings detected)', (done) => {
    const mockProcess = createMockProcess();
    const spawnStub = sinon.stub<Parameters<SpawnFn>, ChildProcess>().returns(mockProcess);

    const proc = spawnStub('ash', []);

    proc.on('exit', (code) => {
      assert.equal(code, 2);
      done();
    });

    mockProcess.emit('exit', 2, null);
  });

  it('can simulate stdout data events (progress output)', (done) => {
    const mockProcess = createMockProcess();
    const spawnStub = sinon.stub<Parameters<SpawnFn>, ChildProcess>().returns(mockProcess);

    const proc = spawnStub('ash', []);
    const chunks: string[] = [];

    proc.stdout!.on('data', (data: Buffer) => {
      chunks.push(data.toString());
    });

    proc.on('exit', () => {
      assert.equal(chunks.length, 2);
      assert.ok(chunks[0].includes('Scanning'));
      done();
    });

    mockProcess.stdout!.emit('data', Buffer.from('Scanning source...'));
    mockProcess.stdout!.emit('data', Buffer.from('Running bandit...'));
    mockProcess.emit('exit', 0, null);
  });

  it('can simulate SIGTERM kill (cancel scan)', () => {
    const mockProcess = createMockProcess();
    const spawnStub = sinon.stub<Parameters<SpawnFn>, ChildProcess>().returns(mockProcess);

    const proc = spawnStub('ash', []);
    const killed = proc.kill('SIGTERM');

    assert.ok(killed);
    assert.ok((proc.kill as sinon.SinonStub).calledWith('SIGTERM'));
  });
});
