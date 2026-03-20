# Research: Safety Hooks and Tool Guardrails

**Feature**: 024-safety-hooks-guardrails
**Date**: 2026-03-20

## R1: Claude Agent SDK PreToolUse Hooks API (TypeScript)

### Decision
Use the SDK's `PreToolUse` hook system with `HookCallback` type and regex matchers registered via the `hooks` field in query options.

### Rationale
The SDK provides a first-class hooks API designed exactly for this use case. The TypeScript types are:
- `HookCallback`: `async (input: PreToolUseHookInput, toolUseID: string | null, context: { signal: AbortSignal }) => Promise<HookResult>`
- `PreToolUseHookInput`: has `tool_name: string`, `tool_input: unknown`, `hook_event_name: "PreToolUse"`
- Deny result: `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: string } }`
- Allow result: `{}` (empty object)
- Matchers: `{ matcher: "Read|Glob|Grep", hooks: [callback] }` — regex against tool name

The `hooks` field goes in query options:
```typescript
const options = {
  ...existingOptions,
  hooks: {
    PreToolUse: [
      { matcher: "Read|Glob|Grep", hooks: [filePathHook] },
      { matcher: "Bash", hooks: [bashCommandHook] },
    ]
  }
};
```

### Alternatives Considered
- **Custom middleware wrapping query()**: Would require intercepting and re-yielding the entire message stream. Rejected — hooks are simpler and SDK-native.
- **PostToolUse redaction**: Only catches output after execution; doesn't prevent the tool from running. Rejected — need pre-execution blocking.
- **allowedTools restriction**: Already used for mode-based filtering, but can't do pattern-based filtering (e.g., allow Read but deny Read of `.env`).

## R2: Hook-to-Generator Communication Pattern

### Decision
Use a shared queue (simple array) that hook callbacks push to and the generator drains after each SDK message. No EventEmitter, no callback indirection.

### Rationale
The hook callbacks execute asynchronously inside the SDK's tool dispatch. The generator iterates `for await (const raw of messages)`. These are decoupled — the hook fires during SDK processing, the generator sees the result after. A shared queue is the simplest bridge:

1. Hook pushes `{ toolName, blockedInput, reason }` to queue
2. Hook logs to output channel immediately (synchronous side effect)
3. Generator checks queue after processing each SDK message
4. Generator yields progress events for any queued blocked operations

This avoids: EventEmitter overhead, callback pyramid, async coordination complexity.

### Alternatives Considered
- **EventEmitter bridge**: More infrastructure, same result. Rejected per Constitution III (KISS).
- **Detect denials in SDK message stream**: Would require parsing tool result messages for denial patterns. Fragile — depends on SDK internal message format. Rejected.
- **onBlocked callback passed to hook factory**: Adds indirection. Queue is simpler.

## R3: Pattern Matching Strategy

### Decision
Use case-insensitive regex matching for both file paths and bash commands. File patterns match against the basename/path suffix, not full absolute paths.

### Rationale
- **Case-insensitive**: `.ENV`, `Credentials.json`, `drop table` are all dangerous. Case-insensitive matching is strictly safer.
- **File path patterns**: The SDK's `tool_input` for Read includes `file_path` (absolute or relative). For Glob, it's `pattern` and `path`. For Grep, it's `path` and `pattern` (content regex) and optionally `glob` (file filter). We check all string fields in `tool_input` against sensitive patterns.
- **Substring matching for bash**: `rm -rf`, `DROP TABLE`, etc. checked as case-insensitive substring of the `command` field. False positives are acceptable per spec assumptions.

### File Pattern → Regex Translation

| Spec Pattern | Regex | Matches |
|---|---|---|
| `**/.env*` | `/\.env/i` | `.env`, `.env.local`, `.env.production` |
| `**/credentials*` | `/credentials/i` | `credentials.json`, `credentials.yml` |
| `**/*.pem` | `/\.pem$/i` | `server.pem`, `cert.pem` |
| `**/*.key` | `/\.key$/i` | `private.key`, `server.key` |
| `**/secrets.*` | `/secrets\./i` | `secrets.json`, `secrets.yaml` |
| `**/.aws/*` | `/[/\\]\.aws[/\\]/i` | `.aws/credentials`, `.aws/config` |

### Bash Pattern → Regex Translation

| Spec Pattern | Regex | Notes |
|---|---|---|
| `rm -rf` | `/rm\s+-rf/i` | Allows variable whitespace |
| `DROP TABLE` | `/drop\s+table/i` | SQL case-insensitive |
| `DELETE FROM` | `/delete\s+from/i` | SQL case-insensitive |
| `format` | `/\bformat\b/i` | Word boundary to reduce false positives on `--format` flag |
| `mkfs` | `/\bmkfs\b/i` | Word boundary for precision |

**Note on `format`**: Using word boundary `\b` means `--format` flag will NOT match (the `--` prefix creates a non-word boundary before `format`). Only standalone `format` as a command will match. This significantly reduces false positives while still catching `format C:` and similar.

**Update**: Actually `\bformat\b` WILL match `--format` because `-` is a non-word character, so `\b` exists between `-` and `f`. To avoid this, we should use a more specific pattern. However, the spec explicitly says false positives are acceptable and intentional for defense-in-depth. We'll use `/\bformat\b/i` and accept the broader match — it's consistent with the spec's security-first stance.

## R4: Grep and Glob Input Field Inspection

### Decision
Inspect ALL string-valued fields in `tool_input` for each file-access tool, rather than hardcoding field names per tool.

### Rationale
Each tool has different input schemas:
- **Read**: `file_path` (string)
- **Glob**: `pattern` (string), `path` (string, optional)
- **Grep**: `pattern` (string), `path` (string, optional), `glob` (string, optional)

Rather than maintaining a mapping of tool→field names (which would break if the SDK adds fields), we iterate all string values in `tool_input` and check each against sensitive patterns. This is:
- Simpler (no per-tool logic)
- More defensive (catches new fields automatically)
- Consistent with the security-first stance

### Alternatives Considered
- **Per-tool field mapping**: `{ Read: ['file_path'], Glob: ['pattern', 'path'], Grep: ['path', 'glob'] }`. More precise but maintenance burden and could miss new fields. Rejected.

## R5: Hook Error Handling (Fail-Closed)

### Decision
If a hook callback throws an exception, the tool call is denied (fail-closed). The error is logged to the output channel.

### Rationale
This is a security tool. A broken hook should NOT silently allow potentially dangerous operations. Fail-closed is standard for security controls. The risk of blocking a legitimate operation due to a bug is lower impact than the risk of allowing a sensitive file read due to a bug.

Implementation: wrap hook logic in try/catch, return deny on catch.
