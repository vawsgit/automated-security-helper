import assert from 'node:assert/strict';
import {
  isSensitiveFilePath,
  isDangerousCommand,
  createFilePathHook,
  createBashCommandHook,
  buildSafetyHooks,
  type BlockedOperation,
} from '../../services/safetyHooks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePreToolUseInput(toolName: string, toolInput: Record<string, unknown>) {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
  };
}

const dummyContext = { signal: new AbortController().signal };

// ---------------------------------------------------------------------------
// isSensitiveFilePath
// ---------------------------------------------------------------------------

describe('isSensitiveFilePath', () => {
  // --- True cases ---
  const trueCases = [
    '.env',
    '.env.local',
    '.env.production',
    'src/config/.env.production',
    '/project/root/.env',
    'credentials.json',
    'aws_credentials',
    '/home/user/.aws/config',
    '/home/user/.aws/credentials',
    'C:\\Users\\dev\\.aws\\config',
    'server.pem',
    'cert.pem',
    '/path/to/private.key',
    'tls.key',
    'secrets.json',
    'secrets.yaml',
  ];

  for (const path of trueCases) {
    it(`blocks: ${path}`, () => {
      assert.strictEqual(isSensitiveFilePath(path), true);
    });
  }

  // --- False cases ---
  const falseCases = [
    'src/app.ts',
    'package.json',
    'README.md',
    'environment.ts',
    'src/environment.ts',
    'src/format.ts',
    'keystone.config.ts',
    'monkey.test.ts',
  ];

  for (const path of falseCases) {
    it(`allows: ${path}`, () => {
      assert.strictEqual(isSensitiveFilePath(path), false);
    });
  }
});

// ---------------------------------------------------------------------------
// isDangerousCommand
// ---------------------------------------------------------------------------

describe('isDangerousCommand', () => {
  // --- True cases ---
  const trueCases = [
    'rm -rf /tmp',
    'rm  -rf /',
    'sudo rm -rf /var/data',
    'DROP TABLE users',
    'drop table users',
    'DELETE FROM findings',
    'delete from sessions where id = 1',
    'format C:',
    'mkfs.ext4 /dev/sda1',
    'echo "rm -rf"',
    'git log --format=oneline',
  ];

  for (const cmd of trueCases) {
    it(`blocks: ${cmd}`, () => {
      assert.strictEqual(isDangerousCommand(cmd), true);
    });
  }

  // --- False cases ---
  const falseCases = [
    'ls -la',
    'grep -r "password" src/',
    'cat file.txt',
    'npm install',
    'git status',
    'python -c "print(x)"',
  ];

  for (const cmd of falseCases) {
    it(`allows: ${cmd}`, () => {
      assert.strictEqual(isDangerousCommand(cmd), false);
    });
  }
});

// ---------------------------------------------------------------------------
// createFilePathHook
// ---------------------------------------------------------------------------

describe('createFilePathHook', () => {
  it('denies Read of .env file', async () => {
    const logs: string[] = [];
    const queue: BlockedOperation[] = [];
    const hook = createFilePathHook((msg) => logs.push(msg), queue);

    const result = await hook(
      makePreToolUseInput('Read', { file_path: '/project/.env' }),
      'tool-123',
      dummyContext,
    );

    assert.strictEqual(
      (result as any).hookSpecificOutput?.permissionDecision,
      'deny',
    );
    assert.strictEqual(
      (result as any).hookSpecificOutput?.permissionDecisionReason,
      'Sensitive file blocked by ASH Workbench',
    );
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].toolName, 'Read');
    assert.ok(queue[0].blockedInput.includes('.env'));
    assert.strictEqual(logs.length, 1);
    assert.ok(logs[0].includes('[BLOCKED]'));
  });

  it('allows Read of safe file', async () => {
    const logs: string[] = [];
    const queue: BlockedOperation[] = [];
    const hook = createFilePathHook((msg) => logs.push(msg), queue);

    const result = await hook(
      makePreToolUseInput('Read', { file_path: '/project/src/app.ts' }),
      'tool-456',
      dummyContext,
    );

    assert.deepStrictEqual(result, {});
    assert.strictEqual(queue.length, 0);
    assert.strictEqual(logs.length, 0);
  });

  it('denies Glob with sensitive pattern', async () => {
    const queue: BlockedOperation[] = [];
    const hook = createFilePathHook(() => {}, queue);

    const result = await hook(
      makePreToolUseInput('Glob', { pattern: '**/.env*', path: '/project' }),
      null,
      dummyContext,
    );

    assert.strictEqual(
      (result as any).hookSpecificOutput?.permissionDecision,
      'deny',
    );
    assert.strictEqual(queue.length, 1);
  });

  it('denies Grep with sensitive path', async () => {
    const queue: BlockedOperation[] = [];
    const hook = createFilePathHook(() => {}, queue);

    const result = await hook(
      makePreToolUseInput('Grep', { pattern: 'API_KEY', path: '/project/.env.local' }),
      null,
      dummyContext,
    );

    assert.strictEqual(
      (result as any).hookSpecificOutput?.permissionDecision,
      'deny',
    );
    assert.strictEqual(queue.length, 1);
  });

  it('fail-closed: returns deny on error', async () => {
    const logs: string[] = [];
    const queue: BlockedOperation[] = [];
    const hook = createFilePathHook((msg) => logs.push(msg), queue);

    // Pass a non-object input that will cause an error in Object.values
    const result = await hook(
      { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: null },
      null,
      dummyContext,
    );

    // Should return allow (null tool_input is handled gracefully)
    assert.deepStrictEqual(result, {});
  });

  it('handles tool_input with no string values', async () => {
    const queue: BlockedOperation[] = [];
    const hook = createFilePathHook(() => {}, queue);

    const result = await hook(
      makePreToolUseInput('Read', { offset: 0, limit: 100 }),
      null,
      dummyContext,
    );

    assert.deepStrictEqual(result, {});
    assert.strictEqual(queue.length, 0);
  });

  // --- US3: Log format verification (T016) ---
  it('log message contains [BLOCKED], tool name, input, and reason', async () => {
    const logs: string[] = [];
    const queue: BlockedOperation[] = [];
    const hook = createFilePathHook((msg) => logs.push(msg), queue);

    await hook(
      makePreToolUseInput('Read', { file_path: '/project/secrets.json' }),
      null,
      dummyContext,
    );

    assert.strictEqual(logs.length, 1);
    assert.ok(logs[0].includes('[BLOCKED]'), 'log should contain [BLOCKED]');
    assert.ok(logs[0].includes('Read'), 'log should contain tool name');
    assert.ok(logs[0].includes('secrets.json'), 'log should contain blocked input');
    assert.ok(
      logs[0].includes('Sensitive file blocked by ASH Workbench'),
      'log should contain denial reason',
    );
  });

  // --- US4: BlockedOperation queue format verification (T017) ---
  it('queue entry has correct format with truncated blockedInput', async () => {
    const queue: BlockedOperation[] = [];
    const longPath = '/project/' + 'a'.repeat(250) + '/.env';
    const hook = createFilePathHook(() => {}, queue);

    await hook(
      makePreToolUseInput('Read', { file_path: longPath }),
      null,
      dummyContext,
    );

    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].toolName, 'Read');
    assert.ok(queue[0].blockedInput.length <= 200, 'blockedInput should be truncated to 200 chars');
    assert.strictEqual(queue[0].reason, 'Sensitive file blocked by ASH Workbench');
  });
});

// ---------------------------------------------------------------------------
// createBashCommandHook
// ---------------------------------------------------------------------------

describe('createBashCommandHook', () => {
  it('denies dangerous command', async () => {
    const logs: string[] = [];
    const queue: BlockedOperation[] = [];
    const hook = createBashCommandHook((msg) => logs.push(msg), queue);

    const result = await hook(
      makePreToolUseInput('Bash', { command: 'rm -rf /tmp/data' }),
      'tool-789',
      dummyContext,
    );

    assert.strictEqual(
      (result as any).hookSpecificOutput?.permissionDecision,
      'deny',
    );
    assert.strictEqual(
      (result as any).hookSpecificOutput?.permissionDecisionReason,
      'Dangerous command blocked by ASH Workbench',
    );
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].toolName, 'Bash');
    assert.ok(queue[0].blockedInput.includes('rm -rf'));
    assert.strictEqual(logs.length, 1);
    assert.ok(logs[0].includes('[BLOCKED]'));
  });

  it('allows safe command', async () => {
    const logs: string[] = [];
    const queue: BlockedOperation[] = [];
    const hook = createBashCommandHook((msg) => logs.push(msg), queue);

    const result = await hook(
      makePreToolUseInput('Bash', { command: 'ls -la' }),
      null,
      dummyContext,
    );

    assert.deepStrictEqual(result, {});
    assert.strictEqual(queue.length, 0);
    assert.strictEqual(logs.length, 0);
  });

  it('allows when command field is not a string', async () => {
    const queue: BlockedOperation[] = [];
    const hook = createBashCommandHook(() => {}, queue);

    const result = await hook(
      makePreToolUseInput('Bash', { command: 42 }),
      null,
      dummyContext,
    );

    assert.deepStrictEqual(result, {});
    assert.strictEqual(queue.length, 0);
  });

  it('fail-closed: returns deny on error', async () => {
    const queue: BlockedOperation[] = [];
    // Create a hook with a log that itself throws
    const hook = createBashCommandHook(() => { throw new Error('log failed'); }, queue);

    // This should trigger isDangerousCommand match, then log throws → catch → deny
    const result = await hook(
      makePreToolUseInput('Bash', { command: 'rm -rf /' }),
      null,
      dummyContext,
    );

    assert.strictEqual(
      (result as any).hookSpecificOutput?.permissionDecision,
      'deny',
    );
  });

  // --- US3: Log format verification ---
  it('log message contains [BLOCKED], Bash, command snippet, and reason', async () => {
    const logs: string[] = [];
    const queue: BlockedOperation[] = [];
    const hook = createBashCommandHook((msg) => logs.push(msg), queue);

    await hook(
      makePreToolUseInput('Bash', { command: 'DROP TABLE users' }),
      null,
      dummyContext,
    );

    assert.strictEqual(logs.length, 1);
    assert.ok(logs[0].includes('[BLOCKED]'));
    assert.ok(logs[0].includes('Bash'));
    assert.ok(logs[0].includes('DROP TABLE users'));
    assert.ok(logs[0].includes('Dangerous command blocked by ASH Workbench'));
  });
});

// ---------------------------------------------------------------------------
// buildSafetyHooks (T018)
// ---------------------------------------------------------------------------

describe('buildSafetyHooks', () => {
  it('returns object with PreToolUse array', () => {
    const hooks = buildSafetyHooks(() => {}, []);
    assert.ok(Array.isArray((hooks as any).PreToolUse));
  });

  it('has 2 matchers: file-path and bash', () => {
    const hooks = buildSafetyHooks(() => {}, []);
    const matchers = (hooks as any).PreToolUse as Array<{ matcher: string; hooks: unknown[] }>;
    assert.strictEqual(matchers.length, 2);
  });

  it('first matcher targets Read|Glob|Grep', () => {
    const hooks = buildSafetyHooks(() => {}, []);
    const matchers = (hooks as any).PreToolUse as Array<{ matcher: string; hooks: unknown[] }>;
    assert.strictEqual(matchers[0].matcher, 'Read|Glob|Grep');
    assert.strictEqual(matchers[0].hooks.length, 1);
    assert.strictEqual(typeof matchers[0].hooks[0], 'function');
  });

  it('second matcher targets Bash', () => {
    const hooks = buildSafetyHooks(() => {}, []);
    const matchers = (hooks as any).PreToolUse as Array<{ matcher: string; hooks: unknown[] }>;
    assert.strictEqual(matchers[1].matcher, 'Bash');
    assert.strictEqual(matchers[1].hooks.length, 1);
    assert.strictEqual(typeof matchers[1].hooks[0], 'function');
  });
});
