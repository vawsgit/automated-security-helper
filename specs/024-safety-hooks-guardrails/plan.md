# Implementation Plan: Safety Hooks and Tool Guardrails

**Feature Branch**: `024-safety-hooks-guardrails`
**Created**: 2026-03-20
**Spec**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)
**Data Model**: [data-model.md](./data-model.md)

## Technical Context

| Aspect | Detail |
|--------|--------|
| Language | TypeScript (strict mode, ES2022, Node16 modules) |
| Key Dependency | `@anthropic-ai/claude-agent-sdk` (ESM-only, dynamic import) |
| Integration Point | `vsix/src/services/claudeAgentProvider.ts` → `analyzeFinding()` → `query()` options |
| Hooks API | SDK `PreToolUse` hooks with `HookCallback`, regex matchers, deny/allow decisions |
| Progress Channel | `AnalysisEvent` generator → `onEvent` callback → `aiAnalysisProgress` webview message |
| Logging | `[ASH AI]` prefix via `outputChannel.appendLine()` |
| Test Framework | Mocha (Node.js unit tests), sinon for mocking |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | ✅ Pass | Hooks run in-process, no external dependencies |
| II. Extension Host Owns State | ✅ Pass | All hook logic in `vsix/src/`, no WebView business logic |
| III. Ship Fast / Simplicity First | ✅ Pass | Simple regex matching, shared queue, no abstractions |
| IV. Typed Contracts at Boundaries | ✅ Pass | Hook callbacks typed via SDK types; progress uses existing `AnalysisProgressEvent` |
| V. Theme Integration | ✅ N/A | No UI changes — reuses existing progress message display |
| VI. Security by Default | ✅ Pass | This feature IS the security control; fail-closed on hook errors |

No gate violations. Proceeding to design.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ claudeAgentProvider.ts — analyzeFinding()               │
│                                                         │
│  1. Create blockedOpsQueue: BlockedOperation[]          │
│  2. Build hooks via buildSafetyHooks(log, queue)        │
│  3. Add hooks to query() options                        │
│  4. for await (message of query(...)):                  │
│       yield existing progress events                    │
│       drain queue → yield blocked op progress events    │
│                                                         │
└──────────────┬──────────────────────────────────────────┘
               │ hooks registered in options
               ▼
┌─────────────────────────────────────────────────────────┐
│ safetyHooks.ts (NEW)                                    │
│                                                         │
│  SENSITIVE_FILE_PATTERNS: RegExp[]                      │
│  DANGEROUS_COMMAND_PATTERNS: RegExp[]                   │
│                                                         │
│  isSensitiveFilePath(input: string): boolean            │
│  isDangerousCommand(command: string): boolean           │
│                                                         │
│  createFilePathHook(log, queue): HookCallback           │
│  createBashCommandHook(log, queue): HookCallback        │
│  buildSafetyHooks(log, queue): HooksConfig              │
│                                                         │
│  Hook callback flow:                                    │
│    1. Extract relevant fields from tool_input           │
│    2. Test against patterns                             │
│    3. If match: log to output channel, push to queue,   │
│       return deny                                       │
│    4. If no match: return {} (allow)                    │
│    5. On error: log error, return deny (fail-closed)    │
└─────────────────────────────────────────────────────────┘
```

## File Inventory

| File | Action | Purpose |
|------|--------|---------|
| `vsix/src/services/safetyHooks.ts` | **CREATE** | Safety hook callbacks, pattern definitions, hook builder |
| `vsix/src/services/claudeAgentProvider.ts` | **MODIFY** | Add hooks to query options, drain blocked ops queue in generator |
| `vsix/src/test/unit/safetyHooks.test.ts` | **CREATE** | Unit tests for pattern matching and hook callbacks |

**No changes to**: `aiService.ts`, `aiProvider.ts`, `messages.ts`, `findingsPanelManager.ts`, WebView code, `package.json`.

The existing progress event pipeline (`AnalysisProgressEvent` → `onEvent` → `aiAnalysisProgress` → WebView) handles blocked operation messages without modification. Blocked ops are just progress events with a "Blocked:" prefix message.

## Phase 1: Safety Hooks Module

**New file**: `vsix/src/services/safetyHooks.ts`

### 1.1 Pattern Definitions

Export two constant arrays of case-insensitive regexes:

**SENSITIVE_FILE_PATTERNS** (6 patterns):
- `/\.env/i` — matches `.env`, `.env.local`, `.env.production`
- `/credentials/i` — matches `credentials.json`, `aws_credentials`
- `/\.pem$/i` — matches `cert.pem`, `server.pem`
- `/\.key$/i` — matches `private.key`, `tls.key`
- `/secrets\./i` — matches `secrets.json`, `secrets.yaml`
- `/[/\\]\.aws[/\\]/i` — matches `.aws/credentials`, `.aws/config`

**DANGEROUS_COMMAND_PATTERNS** (5 patterns):
- `/rm\s+-rf/i` — matches `rm -rf`, `rm  -rf`
- `/drop\s+table/i` — matches `DROP TABLE`, `drop table`
- `/delete\s+from/i` — matches `DELETE FROM`, `delete from`
- `/\bformat\b/i` — matches `format` as a word
- `/\bmkfs\b/i` — matches `mkfs` as a word

### 1.2 Pattern Matching Functions

```typescript
export function isSensitiveFilePath(input: string): boolean
```
Tests a string against all `SENSITIVE_FILE_PATTERNS`. Returns `true` on first match.

```typescript
export function isDangerousCommand(command: string): boolean
```
Tests a string against all `DANGEROUS_COMMAND_PATTERNS`. Returns `true` on first match.

### 1.3 BlockedOperation Interface

```typescript
export interface BlockedOperation {
  toolName: string;
  blockedInput: string;  // Truncated to 200 chars
  reason: string;
}
```

### 1.4 Hook Callback Factories

```typescript
export function createFilePathHook(
  log: (msg: string) => void,
  blockedOps: BlockedOperation[],
): HookCallback
```

Logic:
1. Cast `input` to `PreToolUseHookInput`
2. Cast `tool_input` to `Record<string, unknown>`
3. Iterate all string values in `tool_input`
4. For each string value, call `isSensitiveFilePath()`
5. On match: push to `blockedOps`, call `log()`, return deny with reason "Sensitive file blocked by ASH Workbench"
6. On no match: return `{}`
7. Entire callback wrapped in try/catch — on error: log error, return deny (fail-closed)

```typescript
export function createBashCommandHook(
  log: (msg: string) => void,
  blockedOps: BlockedOperation[],
): HookCallback
```

Logic:
1. Extract `command` field from `tool_input`
2. Call `isDangerousCommand(command)`
3. On match: push to `blockedOps`, call `log()`, return deny with reason "Dangerous command blocked by ASH Workbench"
4. On no match: return `{}`
5. Wrapped in try/catch — fail-closed

### 1.5 Hook Builder

```typescript
export function buildSafetyHooks(
  log: (msg: string) => void,
  blockedOps: BlockedOperation[],
): Record<string, unknown>
```

Returns:
```typescript
{
  PreToolUse: [
    { matcher: 'Read|Glob|Grep', hooks: [createFilePathHook(log, blockedOps)] },
    { matcher: 'Bash', hooks: [createBashCommandHook(log, blockedOps)] },
  ]
}
```

Return type is `Record<string, unknown>` because the SDK types are imported dynamically (ESM-only constraint). The actual shape matches the SDK's hooks config.

## Phase 2: ClaudeAgentProvider Integration

**Modify**: `vsix/src/services/claudeAgentProvider.ts`

### 2.1 Import

Add import of `buildSafetyHooks` and `BlockedOperation` from `./safetyHooks`.

Note: `safetyHooks.ts` does NOT import from the Claude Agent SDK directly — it uses plain TypeScript function signatures. The `HookCallback` type is structurally matched, not nominally imported. This avoids the ESM import issue entirely.

### 2.2 Modify analyzeFinding()

**Before the `query()` call** (after building `options`):

```typescript
const blockedOps: BlockedOperation[] = [];
const hooks = buildSafetyHooks(
  (msg) => this.log(msg),  // Uses existing log method pattern
  blockedOps,
);
options.hooks = hooks;
```

**In the generator loop**, after processing each SDK message and yielding any progress event:

```typescript
// Drain blocked ops queue → yield progress events
while (blockedOps.length > 0) {
  const op = blockedOps.shift()!;
  yield {
    type: 'progress' as const,
    message: `Blocked: attempted to ${op.toolName.toLowerCase()} ${op.blockedInput}`,
    toolName: op.toolName,
  };
}
```

This inserts blocked-operation progress events into the generator stream alongside normal progress events. The existing `onEvent` → `aiAnalysisProgress` pipeline forwards them to the WebView without any additional changes.

### 2.3 Log Method Access

The `ClaudeAgentProvider` class already has a `log()` pattern via the output channel. The hook factory receives a `log` function as a closure parameter, so it doesn't need direct access to the class instance or the output channel.

Log format for blocked operations:
```
[ASH AI] [BLOCKED] Read denied: .env.local — Sensitive file blocked by ASH Workbench
[ASH AI] [BLOCKED] Bash denied: rm -rf /tmp/data — Dangerous command blocked by ASH Workbench
```

## Phase 3: Unit Tests

**New file**: `vsix/src/test/unit/safetyHooks.test.ts`

### 3.1 Pattern Matching Tests

**isSensitiveFilePath()**:
- `.env` → true
- `.env.local` → true
- `.env.production` → true
- `src/config/.env.production` → true (depth-independent)
- `credentials.json` → true
- `aws_credentials` → true
- `/home/user/.aws/config` → true
- `/home/user/.aws/credentials` → true
- `server.pem` → true
- `private.key` → true
- `secrets.json` → true
- `secrets.yaml` → true
- `src/app.ts` → false
- `package.json` → false
- `README.md` → false
- `src/format.ts` → false (not a file pattern match)
- `environment.ts` → false (`.env` must match as a path segment, not substring of `environment`)

Wait — the regex `/\.env/i` WILL match `environment.ts` because it contains `.env` as a substring of `environment`. Let me reconsider: the spec pattern `**/.env*` means files whose basename starts with `.env`. The regex should be `/[/\\]\.env|^\.env/i` — either preceded by a path separator or at the start of the string.

Updated regex: `/(^|[/\\])\.env/i` — matches `.env` at start of string or after a path separator. This correctly handles:
- `.env` → true
- `.env.local` → true
- `src/.env.production` → true
- `environment.ts` → false ✓
- `src/environment.ts` → false ✓

### 3.2 isDangerousCommand() Tests

- `rm -rf /tmp` → true
- `rm  -rf /` → true (extra whitespace)
- `DROP TABLE users` → true
- `drop table users` → true (case-insensitive)
- `DELETE FROM findings` → true
- `format C:` → true
- `mkfs.ext4 /dev/sda1` → true
- `ls -la` → false
- `grep -r "password" src/` → false
- `cat file.txt` → false
- `git log --format=oneline` → true (false positive, accepted per spec)
- `echo "rm -rf"` → true (false positive, accepted per spec)

### 3.3 Hook Callback Tests

**File path hook**:
- Input with `file_path: '/project/.env'` → returns deny, pushes to queue, logs
- Input with `file_path: '/project/src/app.ts'` → returns `{}`, queue empty, no log
- Input with `pattern: '**/.env*'` (Glob) → returns deny
- Hook throws → returns deny (fail-closed), logs error

**Bash command hook**:
- Input with `command: 'rm -rf /tmp'` → returns deny
- Input with `command: 'ls -la'` → returns `{}`
- Hook throws → returns deny (fail-closed)

### 3.4 buildSafetyHooks() Tests

- Returns object with `PreToolUse` array
- Array has 2 entries: file-path matcher and bash matcher
- File-path matcher has `matcher: 'Read|Glob|Grep'`
- Bash matcher has `matcher: 'Bash'`

## Implementation Order

1. **safetyHooks.ts** — Pure logic, no dependencies, fully testable in isolation
2. **safetyHooks.test.ts** — Validate all patterns and hook behavior
3. **claudeAgentProvider.ts** — Integration (add hooks to options, drain queue in loop)
4. Manual verification — Run AI analysis on a project with `.env` file, verify logs

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SDK hooks API changes | Low | High | Pin SDK version; hooks are stable documented API |
| False positives block legitimate analysis | Medium | Low | Logged to output channel for visibility; spec accepts false positives |
| `format` pattern too broad | Medium | Low | Word boundary reduces most false positives; defense-in-depth only |
| Hook error breaks analysis | Low | Medium | Fail-closed with logging; won't crash — just denies one tool call |
| ESM import issues | Low | Medium | safetyHooks.ts avoids SDK imports; uses structural typing |

## Dependencies

- **Spec 5** (ClaudeAgentProvider): Must be implemented. ✅ Already exists.
- **Spec 20** (AI Message Protocol): Must be implemented. ✅ Already exists.
- **Claude Agent SDK**: `@anthropic-ai/claude-agent-sdk` must support `hooks.PreToolUse` in query options. ✅ Verified via SDK docs.
