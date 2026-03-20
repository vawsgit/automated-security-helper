# Tasks: Settings Inheritance and Configuration

**Input**: Design documents from `/specs/019-settings-inheritance/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included — plan.md explicitly defines test tasks (Tasks 6 and 7).

**Organization**: Tasks grouped by user story. US2 (Override Settings) and US4 (Safety Controls) are combined into one phase because they share the same implementation surface (`buildQueryOptions()`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Declare new settings and extend the config interface — required before ANY user story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Add `awsProfile` and `awsAuthRefresh` settings to `vsix/package.json` contributes.configuration section. `awsAuthRefresh` MUST use `"scope": "application"` for security (FR-004). `awsProfile` uses default `window` scope.
- [X] T002 Extend `AiServiceConfig` interface with `awsProfile: string` and `awsAuthRefresh: string` fields, and update `getConfig()` to read both new settings in `vsix/src/services/aiService.ts`

**Checkpoint**: `cd vsix && npm run compile` passes. New settings visible in VS Code Settings UI.

---

## Phase 2: User Story 1 — Zero-Config AI for Claude Code Users (Priority: P1) MVP

**Goal**: Existing Claude Code users trigger AI analysis with zero additional configuration. The extension inherits provider, region, model, and credentials from `~/.claude/settings.json` automatically.

**Independent Test**: Install extension with valid `~/.claude/settings.json` containing Bedrock config. Trigger AI analysis without changing any VS Code settings. Analysis completes successfully.

### Implementation for User Story 1

- [X] T003 [US1] Implement exported `buildQueryOptions(config: AiServiceConfig)` function in `vsix/src/services/claudeAgentProvider.ts`. Returns SDK options with: `settingSources: ['user']` when `useClaudeSettings` is true, `model` when `modelId` is non-empty, `env` spread over `process.env` with overrides for non-empty `region`→`AWS_REGION`, `provider=bedrock`→`CLAUDE_CODE_USE_BEDROCK=1`, `awsProfile`→`AWS_PROFILE`. See contracts/settings-schema.md merge rules.
- [X] T004 [US1] Refactor `testConnection()` and `analyzeFinding()` in `vsix/src/services/claudeAgentProvider.ts` to call `buildQueryOptions(this.config)` for shared base options instead of inline option building (lines 273-286 and 364-380). Each method then spreads its own specific options (`abortController`, `maxTurns`, `maxBudgetUsd`, `allowedTools`, `outputFormat`) on top of the shared base.

### Tests for User Story 1

- [X] T005 [US1] Create unit tests for `buildQueryOptions()` in `vsix/src/test/unit/buildQueryOptions.test.ts`. Test cases: (1) `useClaudeSettings: true` → `settingSources: ['user']`, (2) `useClaudeSettings: false` → no `settingSources`, (3) `modelId` non-empty → `model` set, (4) `modelId` empty → no `model`, (5) all override fields empty → no `env` key in output.

**Checkpoint**: `cd vsix && npm run compile && npm run test` passes. `buildQueryOptions()` produces correct SDK options for zero-config scenario.

---

## Phase 3: User Story 2 + User Story 4 — Override Settings + Safety Controls (Priority: P2)

**Goal**: Users can override individual settings (model, region, provider, awsProfile) while inheriting the rest. Budget/tool/turn limits are ALWAYS from VS Code settings, never inherited.

**Independent Test**: Set `modelId` to a specific value while inheriting everything else. Verify the override is applied. Set `maxBudgetUsd` to $0.50 and confirm it's enforced even with full Claude Code inheritance.

### Tests for User Story 2 + User Story 4

- [X] T006 [US2] Add override and safety tests to `vsix/src/test/unit/buildQueryOptions.test.ts`. Test cases: (1) `region: 'us-west-2'` → `env.AWS_REGION === 'us-west-2'`, (2) `provider: 'bedrock'` → `env.CLAUDE_CODE_USE_BEDROCK === '1'`, (3) `awsProfile: 'prod'` → `env.AWS_PROFILE === 'prod'`, (4) multiple overrides set → all present in `env` with `process.env` as base, (5) confirm `maxBudgetUsd`, `toolMode`, and `maxTurns` are NOT present in `buildQueryOptions()` output (they are passed separately by the caller, satisfying US4 safety requirement).

**Checkpoint**: All override and safety tests pass. No additional implementation needed — `buildQueryOptions()` from Phase 2 already handles overrides.

---

## Phase 4: User Story 3 — Dashboard Guidance for New Users (Priority: P3)

**Goal**: On activation, detect whether `~/.claude/settings.json` contains usable AI provider config (Bedrock or Anthropic API). Expose result to dashboard for contextual guidance.

**Independent Test**: Rename `~/.claude/settings.json`, activate extension, verify detection returns false. Restore file, reactivate, verify detection returns true.

### Implementation for User Story 3

- [X] T007 [P] [US3] Create `vsix/src/services/claudeSettingsDetector.ts` with exported async function `detectClaudeSettings(settingsPath?: string): Promise<ClaudeSettingsDetection>`. Reads `~/.claude/settings.json` via `node:fs/promises`, parses JSON, checks for: (a) Bedrock → `env.CLAUDE_CODE_USE_BEDROCK` or `awsAuthRefresh` key, (b) Anthropic API → `env.ANTHROPIC_API_KEY`. Returns `{ claudeSettingsDetected: boolean, detectedProvider: 'bedrock' | 'anthropic-api' | 'none' }`. Never throws — errors return not-detected. Optional `settingsPath` parameter for testability.
- [X] T008 [US3] Wire detection into extension activation in `vsix/src/extension.ts`. Call `detectClaudeSettings()` after services are initialized (around line 103). Pass result to `sidebarProvider` and `findingsPanelManager` via setter methods (same pattern as existing `setAiService()`).

### Tests for User Story 3

- [X] T009 [US3] Create unit tests for `detectClaudeSettings()` in `vsix/src/test/unit/claudeSettingsDetector.test.ts`. Use tmp directory via `node:fs/promises` and `node:os` for isolation. Test cases: (1) file doesn't exist → not detected, (2) malformed JSON → not detected, (3) `env.CLAUDE_CODE_USE_BEDROCK` present → `detectedProvider: 'bedrock'`, (4) `awsAuthRefresh` key present → `detectedProvider: 'bedrock'`, (5) `env.ANTHROPIC_API_KEY` present → `detectedProvider: 'anthropic-api'`, (6) both Bedrock and API key → `detectedProvider: 'bedrock'` (Bedrock precedence), (7) file exists with neither → not detected.

**Checkpoint**: Detection tests pass. Detection runs at activation and result is available to dashboard providers.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all stories

- [X] T010 Run full verification: `cd vsix && npm run compile && npm run lint && npm run test`. Fix any issues.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Phase 1 completion — BLOCKS US2/US4 testing
- **US2+US4 (Phase 3)**: Depends on Phase 2 (tests build on `buildQueryOptions()`)
- **US3 (Phase 4)**: Depends on Phase 1 only — can run in PARALLEL with Phase 2
- **Polish (Phase 5)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: After Foundational → core implementation
- **US2+US4 (P2)**: After US1 → additional test coverage (no new implementation)
- **US3 (P3)**: After Foundational → independent of US1/US2/US4

### Parallel Opportunities

```
Phase 1: T001 ──┐
                 └──> T002 (sequential, T002 depends on T001 for compile check)

Phase 2:          T003 ──> T004 ──> T005

Phase 3:          T006 (after T005)

Phase 4:          T007 [P] ──> T008 ──> T009
                  (can start in parallel with Phase 2)

Phase 5:          T010 (after all)
```

---

## Parallel Example: US1 + US3

```
# After Phase 1 (Foundational) completes, these can run in parallel:

# Track A: US1 implementation
Task T003: Implement buildQueryOptions() in claudeAgentProvider.ts
Task T004: Refactor testConnection/analyzeFinding to use buildQueryOptions()
Task T005: Unit tests for buildQueryOptions() base layer

# Track B: US3 implementation (different files, no dependency on US1)
Task T007: Create claudeSettingsDetector.ts
Task T008: Wire detection into extension.ts
Task T009: Unit tests for detectClaudeSettings()
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (T001–T002)
2. Complete Phase 2: US1 — Zero-Config AI (T003–T005)
3. **STOP and VALIDATE**: `npm run compile && npm run test` — zero-config AI works
4. This alone delivers the primary value proposition (SC-001)

### Incremental Delivery

1. Phase 1 → Foundational ready
2. Phase 2 (US1) → Zero-config AI works → Test and validate (MVP!)
3. Phase 3 (US2+US4) → Overrides and safety verified → Additional test coverage
4. Phase 4 (US3) → Dashboard detection ready → Guidance for non-Claude-Code users
5. Phase 5 → Full verification pass

### Parallel Team Strategy

With two developers after Phase 1:
- Developer A: US1 (Phase 2) → US2+US4 (Phase 3)
- Developer B: US3 (Phase 4)
- Both: Phase 5 (Polish)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US2+US4 share Phase 3 because they exercise the same code (`buildQueryOptions()`) — US2 tests overrides, US4 tests safety exclusion
- US3 is fully independent of US1/US2/US4 — it reads the filesystem, not the SDK
- `awsAuthRefresh` override when `useClaudeSettings=true` is limited by SDK design (SDK reads from settings file directly). The VS Code setting takes effect when `useClaudeSettings=false`.
- Commit after each task or logical group
