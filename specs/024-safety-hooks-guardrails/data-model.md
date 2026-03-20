# Data Model: Safety Hooks and Tool Guardrails

**Feature**: 024-safety-hooks-guardrails
**Date**: 2026-03-20

## Overview

This feature introduces no persistent data. All entities are runtime-only TypeScript interfaces used within a single analysis session. No database changes, no Prisma schema modifications.

## Entities

### SafetyRule (Static Configuration)

Defines a category of tool calls to block, with the patterns to match and the denial reason to return.

| Field | Type | Description |
|-------|------|-------------|
| `category` | `'file-path' \| 'bash-command'` | Which type of tool input this rule applies to |
| `patterns` | `RegExp[]` | Regex patterns to test against tool input fields |
| `denyReason` | `string` | Human-readable reason returned to SDK and logged |

**Instances** (hardcoded, not user-configurable):

1. File path rule:
   - `category`: `'file-path'`
   - `patterns`: 6 regexes (`.env`, `credentials`, `.pem`, `.key`, `secrets.`, `.aws/`)
   - `denyReason`: `"Sensitive file blocked by ASH Workbench"`

2. Bash command rule:
   - `category`: `'bash-command'`
   - `patterns`: 5 regexes (`rm -rf`, `DROP TABLE`, `DELETE FROM`, `format`, `mkfs`)
   - `denyReason`: `"Dangerous command blocked by ASH Workbench"`

### BlockedOperation (Runtime Event)

Represents a single denied tool call during analysis. Created by hook callbacks, consumed by the generator for logging and progress events.

| Field | Type | Description |
|-------|------|-------------|
| `toolName` | `string` | SDK tool name (e.g., `"Read"`, `"Bash"`, `"Grep"`) |
| `blockedInput` | `string` | The input that triggered the denial (file path or command snippet, truncated to 200 chars) |
| `reason` | `string` | Denial reason from the matching SafetyRule |

**Lifecycle**: Created in hook callback → pushed to shared queue → consumed by generator → yielded as progress event → garbage collected.

## Relationships

```
SafetyRule (static, 2 instances)
    │
    ├── matched by → HookCallback (file-path hook or bash-command hook)
    │                    │
    │                    └── creates → BlockedOperation
    │                                     │
    │                                     ├── pushed to → blockedOpsQueue (shared array)
    │                                     ├── logged to → VS Code output channel
    │                                     └── yielded as → AnalysisProgressEvent
    │
    └── registered in → query() options.hooks.PreToolUse[]
```

## State Transitions

None. Safety rules are immutable. Blocked operations are fire-and-forget events with no state machine.

## No Database Impact

- No Prisma schema changes
- No migration needed
- No new tables or columns
- Blocked operations are not persisted (logged to output channel only)
