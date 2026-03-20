# Tasks: Safety Hooks and Tool Guardrails

**Input**: Design documents from `/specs/024-safety-hooks-guardrails/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Included — plan.md specifies unit tests as part of the implementation (Phase 3 of the plan, file inventory includes `safetyHooks.test.ts`).

**Organization**: Tasks are grouped by user story. US3 (Logging) and US4 (WebView Progress) are cross-cutting — their implementation is embedded in US1/US2 hook callbacks and the generator queue drain. They have explicit verification tasks in a combined phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Extension host: `vsix/src/` (TypeScript)
- Tests: `vsix/src/test/unit/` (Mocha, Node.js)

---

## Phase 1: Foundational (Shared Infrastructure)

**Purpose**: Create the safety hooks module with pattern definitions and shared types. All user stories depend on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Create `vsix/src/services/safetyHooks.ts` with module scaffold: export `BlockedOperation` interface (`toolName: string`, `blockedInput: string`, `reason: string`), `SENSITIVE_FILE_PATTERNS` array (6 case-insensitive regexes per research.md R3: `/(^|[/\\])\.env/i`, `/credentials/i`, `/\.pem$/i`, `/\.key$/i`, `/secrets\./i`, `/[/\\]\.aws[/\\]/i`), and `DANGEROUS_COMMAND_PATTERNS` array (5 case-insensitive regexes: `/rm\s+-rf/i`, `/drop\s+table/i`, `/delete\s+from/i`, `/\bformat\b/i`, `/\bmkfs\b/i`)
- [x] T002 Implement and export `isSensitiveFilePath(input: string): boolean` in `vsix/src/services/safetyHooks.ts` — tests `input` against all `SENSITIVE_FILE_PATTERNS`, returns `true` on first match
- [x] T003 [P] Implement and export `isDangerousCommand(command: string): boolean` in `vsix/src/services/safetyHooks.ts` — tests `command` against all `DANGEROUS_COMMAND_PATTERNS`, returns `true` on first match

**Checkpoint**: Pattern matching functions ready. Can proceed to hook callbacks.

---

## Phase 2: User Story 1 - Sensitive File Protection (Priority: P1) 🎯 MVP

**Goal**: Block Read, Glob, and Grep tool calls targeting sensitive files (`.env*`, `credentials*`, `*.pem`, `*.key`, `secrets.*`, `.aws/*`). Log blocked operations and emit progress events.

**Independent Test**: Trigger AI analysis on a finding in a project with `.env` and `.pem` files. Verify the agent never receives those file contents, deny log entries appear in the "ASH" output channel, and `aiAnalysisProgress` messages with "Blocked:" prefix are emitted.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T004 [P] [US1] Create `vsix/src/test/unit/safetyHooks.test.ts` with test suite for `isSensitiveFilePath()`: true cases (`.env`, `.env.local`, `src/config/.env.production`, `credentials.json`, `aws_credentials`, `/home/user/.aws/config`, `server.pem`, `private.key`, `secrets.json`, `secrets.yaml`), false cases (`src/app.ts`, `package.json`, `README.md`, `environment.ts`, `src/environment.ts`)
- [x] T005 [P] [US1] Add test suite for `createFilePathHook()` in `vsix/src/test/unit/safetyHooks.test.ts`: mock `PreToolUseHookInput` with `tool_input: { file_path: '/project/.env' }` → returns deny with reason "Sensitive file blocked by ASH Workbench", pushes to queue, calls log. Mock with `tool_input: { file_path: '/project/src/app.ts' }` → returns `{}`, queue stays empty. Mock Glob input `tool_input: { pattern: '**/.env*' }` → returns deny. Test fail-closed: hook throws → returns deny, logs error

### Implementation for User Story 1

- [x] T006 [US1] Implement `createFilePathHook(log: (msg: string) => void, blockedOps: BlockedOperation[]): HookCallback` in `vsix/src/services/safetyHooks.ts` — cast input to `PreToolUseHookInput`, iterate all string values in `tool_input`, call `isSensitiveFilePath()` on each, on match: push `BlockedOperation` to queue, call `log('[BLOCKED] {toolName} denied: {blockedInput} — Sensitive file blocked by ASH Workbench')`, return `{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Sensitive file blocked by ASH Workbench' } }`. Truncate `blockedInput` to 200 chars. Wrap in try/catch — on error: log error, return deny (fail-closed)
- [x] T007 [US1] Implement `buildSafetyHooks(log: (msg: string) => void, blockedOps: BlockedOperation[]): Record<string, unknown>` in `vsix/src/services/safetyHooks.ts` — returns `{ PreToolUse: [{ matcher: 'Read|Glob|Grep', hooks: [createFilePathHook(log, blockedOps)] }] }`. Initially file-path matcher only; bash matcher added in US2
- [x] T008 [US1] Integrate safety hooks into `vsix/src/services/claudeAgentProvider.ts` `analyzeFinding()` method: import `buildSafetyHooks` and `BlockedOperation` from `./safetyHooks`. Before the `query()` call, create `const blockedOps: BlockedOperation[] = []`, build hooks via `buildSafetyHooks((msg) => this.log(msg), blockedOps)`, add `options.hooks = hooks`
- [x] T009 [US1] Add blocked ops queue drain to generator loop in `vsix/src/services/claudeAgentProvider.ts`: after processing each SDK message and yielding any progress event, drain the `blockedOps` array with `while (blockedOps.length > 0) { const op = blockedOps.shift()!; yield { type: 'progress', message: 'Blocked: attempted to ${op.toolName.toLowerCase()} ${op.blockedInput}', toolName: op.toolName }; }`
- [x] T010 [US1] Run tests: `cd vsix && npm run test` — verify all `isSensitiveFilePath` and `createFilePathHook` tests pass

**Checkpoint**: File path filtering fully operational. Sensitive files blocked, logged, and reported via progress events. US1 is independently testable.

---

## Phase 3: User Story 2 - Dangerous Command Protection (Priority: P2)

**Goal**: Block Bash tool calls containing destructive patterns (`rm -rf`, `DROP TABLE`, `DELETE FROM`, `format`, `mkfs`) when tool mode is "full". Defense-in-depth only.

**Independent Test**: Configure tool mode to "full", trigger AI analysis, verify Bash commands with destructive patterns are denied while safe commands proceed.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US2] Add test suite for `isDangerousCommand()` in `vsix/src/test/unit/safetyHooks.test.ts`: true cases (`rm -rf /tmp`, `rm  -rf /` with extra whitespace, `DROP TABLE users`, `drop table users`, `DELETE FROM findings`, `format C:`, `mkfs.ext4 /dev/sda1`, `echo "rm -rf"`, `git log --format=oneline`), false cases (`ls -la`, `grep -r "password" src/`, `cat file.txt`)
- [x] T012 [P] [US2] Add test suite for `createBashCommandHook()` in `vsix/src/test/unit/safetyHooks.test.ts`: mock `PreToolUseHookInput` with `tool_input: { command: 'rm -rf /tmp' }` → returns deny with reason "Dangerous command blocked by ASH Workbench", pushes to queue, calls log. Mock with `tool_input: { command: 'ls -la' }` → returns `{}`, queue stays empty. Test fail-closed: hook throws → returns deny

### Implementation for User Story 2

- [x] T013 [US2] Implement `createBashCommandHook(log: (msg: string) => void, blockedOps: BlockedOperation[]): HookCallback` in `vsix/src/services/safetyHooks.ts` — extract `command` field from `tool_input` as string, call `isDangerousCommand(command)`, on match: push `BlockedOperation` to queue, call `log('[BLOCKED] Bash denied: {command_snippet} — Dangerous command blocked by ASH Workbench')`, return deny. Truncate command to 200 chars for `blockedInput`. Wrap in try/catch — fail-closed
- [x] T014 [US2] Update `buildSafetyHooks()` in `vsix/src/services/safetyHooks.ts` to include Bash matcher: `{ matcher: 'Bash', hooks: [createBashCommandHook(log, blockedOps)] }` in the `PreToolUse` array alongside the existing file-path matcher
- [x] T015 [US2] Run tests: `cd vsix && npm run test` — verify all `isDangerousCommand` and `createBashCommandHook` tests pass

**Checkpoint**: Both file path and command filtering operational. US2 is independently testable.

---

## Phase 4: User Stories 3+4 - Logging & WebView Notifications (Priority: P3+P4)

**Goal**: Verify that blocked operation logging (US3) and progress event emission (US4) work correctly with the proper message formats. These behaviors are already implemented as part of US1/US2 hook callbacks and the generator queue drain — this phase adds explicit format verification.

**Independent Test**: Trigger analysis that hits a sensitive file, verify output channel shows `[ASH AI] [BLOCKED] Read denied: .env — Sensitive file blocked by ASH Workbench` and WebView receives `aiAnalysisProgress` with `message: "Blocked: attempted to read .env"`.

- [x] T016 [P] [US3] Add test in `vsix/src/test/unit/safetyHooks.test.ts` verifying log message format: when `createFilePathHook` denies a tool call, the `log` function receives a string containing `[BLOCKED]`, the tool name, the blocked input, and the denial reason
- [x] T017 [P] [US4] Add test in `vsix/src/test/unit/safetyHooks.test.ts` verifying `BlockedOperation` queue entry format: `toolName` is the SDK tool name, `blockedInput` is truncated to 200 chars, `reason` matches the denial reason constant
- [x] T018 Add test suite for `buildSafetyHooks()` in `vsix/src/test/unit/safetyHooks.test.ts`: returns object with `PreToolUse` key, array has 2 entries, first entry has `matcher: 'Read|Glob|Grep'`, second entry has `matcher: 'Bash'`, each entry has `hooks` array with one function
- [x] T019 Run full test suite: `cd vsix && npm run test` — verify all safety hooks tests pass including format verification

**Checkpoint**: All 4 user stories verified. Safety hooks module complete.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Compilation, lint, and final validation

- [x] T020 Run TypeScript compilation: `cd vsix && npm run compile` — verify no type errors in `safetyHooks.ts` or modified `claudeAgentProvider.ts`
- [x] T021 Run linter: `cd vsix && npm run lint` — verify no lint errors in new/modified files
- [x] T022 Verify no regressions in existing tests: `cd vsix && npm run test` — all pre-existing tests still pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately
- **US1 (Phase 2)**: Depends on Phase 1 completion — BLOCKS US2 (provider integration must exist before adding bash hook)
- **US2 (Phase 3)**: Depends on Phase 2 (US1) — adds bash hook to existing buildSafetyHooks and provider integration
- **US3+US4 (Phase 4)**: Depends on Phase 3 (US2) — format verification for both hook types
- **Polish (Phase 5)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational. Creates the hooks module and provider integration — other stories extend this
- **US2 (P2)**: Depends on US1 completion. Adds bash hook to existing module and builder function
- **US3 (P3)**: Cross-cutting — logging is implemented inline in US1/US2 hook callbacks. Phase 4 adds format verification
- **US4 (P4)**: Cross-cutting — progress events are emitted by the generator queue drain (T009 in US1). Phase 4 adds format verification

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Pattern functions before hook callbacks
- Hook callbacks before provider integration
- Provider integration before test verification

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel (different functions, same file but independent)
- **Phase 2**: T004 and T005 can run in parallel (different test suites)
- **Phase 3**: T011 and T012 can run in parallel (different test suites)
- **Phase 4**: T016 and T017 can run in parallel (different test aspects)
- **Cross-phase**: US2 tests (T011, T012) can be written in parallel with US1 implementation (T006–T009) since they test different functions

---

## Parallel Example: User Story 1

```bash
# Launch tests for US1 together (write-first):
Task: T004 "Test isSensitiveFilePath() in vsix/src/test/unit/safetyHooks.test.ts"
Task: T005 "Test createFilePathHook() in vsix/src/test/unit/safetyHooks.test.ts"

# Then implement sequentially:
Task: T006 "Implement createFilePathHook in vsix/src/services/safetyHooks.ts"
Task: T007 "Implement buildSafetyHooks in vsix/src/services/safetyHooks.ts"
Task: T008 "Add hooks to query options in vsix/src/services/claudeAgentProvider.ts"
Task: T009 "Add queue drain to generator in vsix/src/services/claudeAgentProvider.ts"
Task: T010 "Run and verify tests pass"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (patterns + matchers)
2. Complete Phase 2: US1 (file path hook + provider integration)
3. **STOP and VALIDATE**: Run tests, verify `.env` files are blocked
4. This alone delivers the highest-value security guardrail

### Incremental Delivery

1. Foundational → Pattern matching ready
2. US1 → Sensitive file protection live (MVP!)
3. US2 → Dangerous command protection live
4. US3+US4 → Format verification complete
5. Polish → Clean, lint-free, no regressions

### Single Developer Strategy

This feature is compact (3 files). Execute sequentially in phase order. Total estimated scope: ~200 lines of production code + ~250 lines of tests.

---

## Notes

- [P] tasks = different files or independent functions, no dependencies
- [Story] label maps task to specific user story for traceability
- US3 and US4 are cross-cutting — their implementation is embedded in US1/US2 hook callbacks and generator queue drain. Phase 4 provides explicit format verification
- The `HookCallback` type is structurally matched (plain async function), not nominally imported from the SDK — avoids ESM import issues
- All hook callbacks use fail-closed error handling per research.md R5
- Commit after each phase completion
