# Implementation Plan: Settings Inheritance and Configuration

**Feature Branch**: `019-settings-inheritance`
**Spec**: [spec.md](./spec.md)
**Created**: 2026-03-20

## Technical Context

| Aspect | Detail |
| ------ | ------ |
| SDK | `@anthropic-ai/claude-agent-sdk` v0.2.80+ (ESM-only, dynamic import) |
| SDK query options | `settingSources`, `model`, `env`, `maxBudgetUsd`, `maxTurns`, `allowedTools` |
| Existing settings | 7 settings in `package.json`: `useClaudeSettings`, `provider`, `region`, `modelId`, `maxBudgetUsd`, `toolMode`, `maxTurns` |
| Existing code | `AiService.getConfig()` reads settings; `ClaudeAgentProvider` passes `settingSources: ['user']` and `model` override |
| Missing | `awsProfile`, `awsAuthRefresh` settings; `buildQueryOptions()`; detection at activation; env override mechanism |
| Test framework | Mocha + `node:assert/strict` + sinon (unit); `@vscode/test-electron` (integration) |

## Constitution Check

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. VS Code Native | PASS | Settings declared in `package.json`, read via `vscode.workspace.getConfiguration`. Detection uses Node.js `fs` (file is outside workspace). |
| II. Extension Host Owns State | PASS | All config resolution lives in `vsix/src/`. Detection result stored in extension host memory. |
| III. Ship Fast / Simplicity First | PASS | Pure function for options building. No new abstractions — extends existing `AiServiceConfig`. Detection is a single utility function, not a service class. |
| IV. Typed Contracts at Boundaries | PASS | `AiServiceConfig` interface extended with typed fields. `ClaudeSettingsDetection` interface for detection result. |
| V. Theme Integration | N/A | No UI changes in this spec. |
| VI. Security by Default | PASS | `awsAuthRefresh` restricted to `"scope": "application"` (user-level only) preventing workspace command injection. |

## Phase 1: Design Artifacts

- [research.md](./research.md) — 4 research decisions (scope restriction, env overrides, detection, buildQueryOptions design)
- [data-model.md](./data-model.md) — Updated `AiServiceConfig`, new `ClaudeSettingsDetection`
- [contracts/settings-schema.md](./contracts/settings-schema.md) — Settings schema, merge rules, detection rules
- [quickstart.md](./quickstart.md) — File inventory and verification steps

## Phase 2: Implementation Tasks

### Task 1: Add New Settings to `package.json`

**Files**: `vsix/package.json`
**FR**: FR-003, FR-004

Add two new settings to the `contributes.configuration.properties` section:

```json
"ashWorkbench.llm.awsProfile": {
  "type": "string",
  "default": "",
  "description": "AWS profile name for LLM provider. Leave empty to inherit from Claude Code settings."
},
"ashWorkbench.llm.awsAuthRefresh": {
  "type": "string",
  "default": "",
  "scope": "application",
  "description": "Shell command to refresh AWS credentials. Leave empty to inherit from Claude Code settings. Restricted to user settings only for security."
}
```

Key: `awsAuthRefresh` uses `"scope": "application"` — this is the security control from the clarification.

**Acceptance**: `npm run compile` passes. Both settings appear in VS Code Settings UI. `awsAuthRefresh` cannot be set in workspace settings.

---

### Task 2: Extend `AiServiceConfig` and `getConfig()`

**Files**: `vsix/src/services/aiService.ts`
**FR**: FR-003, FR-004, FR-010

1. Add `awsProfile: string` and `awsAuthRefresh: string` to the `AiServiceConfig` interface.
2. Update `getConfig()` to read the new fields:
   ```typescript
   awsProfile: config.get<string>('awsProfile', ''),
   awsAuthRefresh: config.get<string>('awsAuthRefresh', ''),
   ```

**Acceptance**: TypeScript compiles. `getConfig()` returns all 9 fields.

---

### Task 3: Implement `buildQueryOptions()`

**Files**: `vsix/src/services/claudeAgentProvider.ts`
**FR**: FR-002, FR-003, FR-007

Extract a module-level function that takes `AiServiceConfig` and returns SDK query options:

```typescript
export function buildQueryOptions(config: AiServiceConfig): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  // Base layer: load Claude Code settings
  if (config.useClaudeSettings) {
    options.settingSources = ['user'];
  }

  // Model override
  if (config.modelId) {
    options.model = config.modelId;
  }

  // Environment variable overrides for non-empty settings
  const envOverrides: Record<string, string> = {};
  if (config.region) {
    envOverrides.AWS_REGION = config.region;
  }
  if (config.provider === 'bedrock') {
    envOverrides.CLAUDE_CODE_USE_BEDROCK = '1';
  }
  if (config.awsProfile) {
    envOverrides.AWS_PROFILE = config.awsProfile;
  }

  if (Object.keys(envOverrides).length > 0) {
    options.env = { ...process.env, ...envOverrides };
  }

  return options;
}
```

Then refactor `testConnection()` and `analyzeFinding()` to call `buildQueryOptions(this.config)` instead of inline option building. The methods still add their own specific options (`abortController`, `maxTurns`, `maxBudgetUsd`, `allowedTools`, etc.) on top of the shared base.

**Acceptance**: Both `testConnection()` and `analyzeFinding()` produce identical SDK behavior as before. New env overrides are passed when settings are non-empty. `npm run compile` passes.

---

### Task 4: Implement Claude Settings Detection

**Files**: New file `vsix/src/services/claudeSettingsDetector.ts`
**FR**: FR-008, FR-009

Create a utility module with a single exported async function:

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export interface ClaudeSettingsDetection {
  claudeSettingsDetected: boolean;
  detectedProvider: 'bedrock' | 'anthropic-api' | 'none';
}

export async function detectClaudeSettings(): Promise<ClaudeSettingsDetection> {
  // 1. Read ~/.claude/settings.json
  // 2. Parse JSON (catch malformed → return not detected + log warning)
  // 3. Check for Bedrock config (env.CLAUDE_CODE_USE_BEDROCK or awsAuthRefresh key)
  // 4. Check for Anthropic API config (env.ANTHROPIC_API_KEY)
  // 5. Return detection result
}
```

Design choices:
- Pure async function, no class (constitution: simplicity first)
- Uses Node.js `fs` (file is outside workspace — `vscode.workspace.fs` not appropriate)
- Returns a typed result, never throws (errors → `{ claudeSettingsDetected: false, detectedProvider: 'none' }`)

**Acceptance**: Function correctly identifies Bedrock config, Anthropic API config, absent file, and malformed JSON.

---

### Task 5: Wire Detection into Extension Activation

**Files**: `vsix/src/extension.ts`
**FR**: FR-008

In the `activate()` function, after services are initialized but before UI providers are wired:

1. Call `detectClaudeSettings()` (non-blocking — don't hold up activation)
2. Store the result
3. Pass it to `sidebarProvider` and `findingsPanelManager` via setter methods

The detection result is a simple value object passed to providers that already receive service dependencies via setters. No new architectural pattern.

**Acceptance**: Detection runs at activation. Result is available to dashboard providers. Extension activates in under 2 seconds (SC-004) — the detection adds negligible time (single file read).

---

### Task 6: Unit Tests for `buildQueryOptions()`

**Files**: New file `vsix/src/test/unit/buildQueryOptions.test.ts`
**FR**: FR-002, FR-003, FR-007

Test cases:
1. `useClaudeSettings: true` → options include `settingSources: ['user']`
2. `useClaudeSettings: false` → no `settingSources` in options
3. `modelId: 'claude-sonnet-4-6'` → options include `model: 'claude-sonnet-4-6'`
4. `modelId: ''` → no `model` in options
5. `region: 'us-west-2'` → `env.AWS_REGION === 'us-west-2'`
6. `provider: 'bedrock'` → `env.CLAUDE_CODE_USE_BEDROCK === '1'`
7. `awsProfile: 'prod'` → `env.AWS_PROFILE === 'prod'`
8. All overrides empty → no `env` key in options
9. Multiple overrides set → all present in `env`, `process.env` is base

**Acceptance**: All tests pass via `npm run test`.

---

### Task 7: Unit Tests for `detectClaudeSettings()`

**Files**: New file `vsix/src/test/unit/claudeSettingsDetector.test.ts`
**FR**: FR-008, FR-009

Test cases (using `fs` mock or tmp directory):
1. File doesn't exist → `{ claudeSettingsDetected: false, detectedProvider: 'none' }`
2. File is malformed JSON → `{ claudeSettingsDetected: false, detectedProvider: 'none' }`
3. File has `env.CLAUDE_CODE_USE_BEDROCK` → `{ claudeSettingsDetected: true, detectedProvider: 'bedrock' }`
4. File has `awsAuthRefresh` key → `{ claudeSettingsDetected: true, detectedProvider: 'bedrock' }`
5. File has `env.ANTHROPIC_API_KEY` → `{ claudeSettingsDetected: true, detectedProvider: 'anthropic-api' }`
6. File has both Bedrock and API key → `{ claudeSettingsDetected: true, detectedProvider: 'bedrock' }` (Bedrock takes precedence)
7. File exists but has neither → `{ claudeSettingsDetected: false, detectedProvider: 'none' }`

To make the function testable without mocking `os.homedir()`, accept an optional `settingsPath` parameter (or use dependency injection for the file reading).

**Acceptance**: All tests pass via `npm run test`.

---

## Task Dependencies

```
Task 1 (package.json) ──┐
                         ├──> Task 2 (AiServiceConfig) ──> Task 3 (buildQueryOptions) ──> Task 6 (tests)
                         │
Task 4 (detection) ──────┤──> Task 5 (activation wiring)
                         │
                         └──> Task 7 (detection tests)
```

Tasks 1 and 4 can run in parallel. Tasks 6 and 7 can run in parallel.

## Risk Assessment

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| SDK `env` option doesn't override settings file `env` | Settings overrides silently ignored | Research confirms `env` is the subprocess environment; test with actual Bedrock config |
| `"scope": "application"` not enforced in older VS Code versions | `awsAuthRefresh` settable at workspace level | Min engine `^1.110.0` supports `application` scope (introduced in VS Code 1.9) |
| Detection reads file at wrong path on Windows | Detection always returns false on Windows | Use `os.homedir()` + `path.join()` — platform-independent path construction |
| Adding `env` spread over `process.env` leaks sensitive env vars | Credentials visible in SDK subprocess | This is the SDK default behavior (`env` defaults to `process.env`); we only add to it, never log it |
