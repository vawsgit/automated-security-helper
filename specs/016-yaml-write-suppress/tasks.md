# Tasks: .ash.yaml Write & Suppress Action

**Input**: Design documents from `/specs/016-yaml-write-suppress/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included — the spec references testable acceptance scenarios and the plan includes a testing layer.

**Organization**: Tasks are grouped by user story. US1+US2+US4 share the same SuppressionForm component and are grouped together since the form, preview, and scope are inseparable. US3 (Unsuppress) is a distinct flow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Extension host**: `vsix/src/`
- **WebView app**: `webview/src/`
- **Tests**: `vsix/src/test/unit/`

---

## Phase 1: Setup

**Purpose**: Install missing ShadCN dependencies needed for the suppression form

- [x] T001 Install ShadCN RadioGroup component for scope selector: run `npx shadcn@latest add radio-group --yes` from `webview/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, messages, and public API changes that ALL user stories depend on

**Warning**: No user story work can begin until this phase is complete

- [x] T002 [P] Add `SuppressionScope`, `SuppressionInput`, `SuppressionResult` types to `vsix/src/models/types.ts` (see data-model.md for exact definitions)
- [x] T003 [P] Mirror `SuppressionScope`, `SuppressionInput`, `SuppressionResult` types to `webview/src/types/types.ts`
- [x] T004 [P] Add `suppressFinding` and `unsuppressFinding` variants to `WebviewToExtMessage` union in `vsix/src/models/messages.ts` (see contracts/message-protocol.md)
- [x] T005 [P] Add `suppressionResult` variant to `ExtToWebviewMessage` union in `vsix/src/models/messages.ts`
- [x] T006 [P] Mirror message type changes to `webview/src/types/messages.ts` — add `suppressFinding`, `unsuppressFinding` to `WebviewToExtMessage` and `suppressionResult` to `ExtToWebviewMessage`
- [x] T007 Export `generateYamlEntry` as a public named export from `vsix/src/models/mappers.ts` (currently a private function — change `function generateYamlEntry` to `export function generateYamlEntry`)

**Checkpoint**: All shared types and messages are in place. Both packages compile cleanly.

---

## Phase 3: US1 + US2 + US4 — Suppress a Finding with YAML Preview & Scope (Priority: P1+P2) MVP

**Goal**: Users can suppress a finding from the workbench via an interactive form with scope selection, justification, optional line range/expiration, and a live YAML preview. The entry is written to `.ash.yaml` and the finding immediately shows as suppressed.

**Independent Test**: Open any non-suppressed finding → click Suppress → fill justification → select each scope preset → verify YAML preview updates live → click "Add Suppression" → verify entry appears in `.ash.yaml` → verify finding shows as suppressed in UI.

### Write Service (core logic)

- [x] T008 [US1] Create `vsix/src/services/ashYamlWrite.ts` with pure helper functions: `inputToSuppression()` (converts SuppressionInput → AshSuppression based on scope per data-model.md mapping table), `serializeSuppressionEntry()` (produces indented YAML text for file append), `generateSkeleton()` (creates minimal `.ash.yaml` content for new files per research.md R2)
- [x] T009 [US1] Implement `AshYamlWriteService` class in `vsix/src/services/ashYamlWrite.ts` with `addSuppression(input: SuppressionInput): Promise<SuppressionResult>` — validate input, discover/create `.ash.yaml` via `discoverConfigFile()`, re-read file for conflict detection (mtime comparison per research.md R3), validate YAML is parseable (FR-011), append serialized entry preserving existing content (FR-009), write via `vscode.workspace.fs`, handle file creation (FR-008) and missing `global_settings.suppressions` key
- [x] T010 [US1] Add `setScanRoot(newRoot: string)` method to `AshYamlWriteService` in `vsix/src/services/ashYamlWrite.ts`

### Extension Host Wiring

- [x] T011 [US1] Wire `AshYamlWriteService` in `vsix/src/extension.ts` — instantiate after `AshYamlService` with scan root + ashYamlService, pass to `FindingsPanelManager` via new `setAshYamlWriteService()` setter, update scan root on `ashWorkbench.scanRoot` config change
- [x] T012 [US1] Add `suppressFinding` message handler in `FindingsPanelManager.handleMessage()` in `vsix/src/providers/findingsPanelManager.ts` — call `writeService.addSuppression(payload)`, send `suppressionResult` back to webview panel

### WebView State

- [x] T013 [US1] Extend `AppState` in `webview/src/App.tsx` with `suppressionFormFindingId: string | null` (initially null) and `suppressionPending: boolean` (initially false). Add reducer actions: `OPEN_SUPPRESSION_FORM` (sets findingId), `CLOSE_SUPPRESSION_FORM` (clears both), and `suppressionResult` message handler (on success: clear form + set pending false; on error: set pending false, keep form open)

### WebView Components

- [x] T014 [US1] [US2] [US4] Create `webview/src/components/SuppressionForm.tsx` — Props: `finding: FindingRow`, `isPending: boolean`, `onSubmit: (input: SuppressionInput) => void`, `onCancel: () => void`. Local state via `useState`: scope (RadioGroup with 3 presets per FR-004, default `file_rule`), justification (Textarea, pre-populated from `finding.notes` per FR-017), includeLineRange (Switch, hidden when `finding.startLine === finding.endLine === 0`, default off per FR-018), expiration (Input type="date", optional). Live YAML preview panel computed from local form state using exported `generateYamlEntry()` logic (FR-003, SC-006). "Add Suppression" Button with client-side validation (non-empty justification per FR-002). Disable form + show loading state while `isPending`. Style with `variant="outline"` buttons per convention.
- [x] T015 [US1] Modify `webview/src/components/FindingDetailView.tsx` — add a "Suppress" section after the triage controls (visually distinct per FR-016, separated by `<Separator/>`). Show "Suppress Finding" button (variant="outline") when `!finding.isCurrentlySuppressed` (FR-019). On click, dispatch `OPEN_SUPPRESSION_FORM`. Render `<SuppressionForm>` inline when `suppressionFormFindingId === finding.id`. Wire `onSubmit` to `postMessage({ type: 'suppressFinding', payload })` and set pending. Wire `onCancel` to dispatch `CLOSE_SUPPRESSION_FORM`.
- [x] T016 [US1] Wire `suppressionResult` message in `webview/src/App.tsx` message handler (inside `useEffect` for postMessage listener) — dispatch the `suppressionResult` reducer action with the payload. On success, the `currentFindingsUpdate` from the file watcher cascade (Spec 013→015) handles the actual finding state refresh (FR-014).

### Unit Tests

- [x] T017 [P] [US1] Create `vsix/src/test/unit/ashYamlWrite.test.ts` — test pure helpers: `inputToSuppression()` for all 3 scope variants (file_rule, rule_everywhere, file_all_rules per data-model.md mapping table), with and without line range, with and without expiration. Test `serializeSuppressionEntry()` produces correct YAML indentation and field ordering. Test `generateSkeleton()` produces valid parseable YAML.
- [x] T018 [P] [US1] Add `AshYamlWriteService.addSuppression()` tests to `vsix/src/test/unit/ashYamlWrite.test.ts` — test append to existing file (verify entry appended, original content preserved including comments per FR-009), test file creation when no `.ash.yaml` exists (verify skeleton per FR-008), test invalid YAML rejection (verify error result per FR-011), test conflict detection (mtime mismatch triggers retry per research.md R3)

**Checkpoint**: User Stories 1, 2, and 4 are fully functional. A user can click Suppress on any non-suppressed finding, fill out the form with scope/justification/preview, and write to `.ash.yaml`. The finding updates to suppressed automatically.

---

## Phase 4: US3 — Unsuppress a Finding (Priority: P2)

**Goal**: Users can remove a suppression entry from `.ash.yaml` for any currently suppressed finding, with a confirmation dialog that warns about multi-finding impact.

**Independent Test**: Toggle "Show suppressed" on → click a suppressed finding → click Unsuppress → confirm → verify entry removed from `.ash.yaml` → verify finding returns to unsuppressed state.

### Write Service (removal logic)

- [x] T019 [US3] Add `findSuppressionIndex()` and `reserializeSuppressionsSection()` helper functions to `vsix/src/services/ashYamlWrite.ts` — `findSuppressionIndex` compares all non-null fields of the target AshSuppression against each entry in the array (per research.md R6). `reserializeSuppressionsSection` parses the full file, removes the entry at the matched index from the suppressions array, re-serializes using `js-yaml.dump()` (comments lost per research.md R1 accepted tradeoff), and returns the updated file content.
- [x] T020 [US3] Implement `AshYamlWriteService.removeSuppression(findingId: string)` in `vsix/src/services/ashYamlWrite.ts` — look up the finding's matching suppression via `ashYamlService.matchesSuppression()`, re-read file for conflict detection, parse and find matching entry via `findSuppressionIndex()`, remove entry via `reserializeSuppressionsSection()`, write file. Handle edge case: entry already removed externally (return success with informational message per edge cases spec).

### Extension Host Wiring

- [x] T021 [US3] Add `unsuppressFinding` message handler in `FindingsPanelManager.handleMessage()` in `vsix/src/providers/findingsPanelManager.ts` — look up the finding from current findings to get its data, call `writeService.removeSuppression(findingId)`, send `suppressionResult` back to webview panel.

### WebView Components

- [x] T022 [US3] Modify `webview/src/components/SuppressionPanel.tsx` — when `finding.isCurrentlySuppressed && finding.suppressionSource === 'ash_yaml'`, add an "Unsuppress" button (variant="outline"). On click, show inline confirmation with the matching rule ID, file path, and a warning if the suppression may affect multiple findings (FR-013). On confirm, `postMessage({ type: 'unsuppressFinding', payload: { findingId } })`. On cancel, close confirmation.
- [x] T023 [US3] Modify `webview/src/components/FindingDetailView.tsx` — pass the necessary props to `SuppressionPanel` for the unsuppress action (findingId). Update the condition that renders SuppressionPanel: show it when `finding.isCurrentlySuppressed` (not just when `disposition === 'SUPPRESS'`) so the unsuppress button is accessible.

### Unit Tests

- [x] T024 [P] [US3] Add removal tests to `vsix/src/test/unit/ashYamlWrite.test.ts` — test `findSuppressionIndex()` matches correct entry, returns -1 when no match. Test `reserializeSuppressionsSection()` produces valid YAML with the entry removed while preserving other entries. Test `removeSuppression()` end-to-end: remove from multi-entry file, handle entry-not-found gracefully, conflict detection on removal.

**Checkpoint**: User Story 3 is fully functional. A user can unsuppress any .ash.yaml-suppressed finding with confirmation.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Kitchen Sink demo, edge case hardening, validation

- [x] T025 [P] Add Kitchen Sink demo for `SuppressionForm` component in `webview/src/pages/sink/` — exercise all variants: all 3 scopes, with/without line range, with/without expiration, pending state, error state. Register in sink page registry.
- [x] T026 Verify end-to-end suppress and unsuppress flows compile and run: `cd vsix && npm run compile` and `cd webview && npm run build`. Fix any TypeScript errors from type mirroring or missing imports.
- [x] T027 Run existing test suite: `cd vsix && npm run test`. Fix any regressions introduced by type changes or mapper export changes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Can start in parallel with Phase 1. BLOCKS all user story phases.
- **US1+US2+US4 (Phase 3)**: Depends on Phase 2 completion
- **US3 (Phase 4)**: Depends on Phase 2 completion. Can run in parallel with Phase 3 (separate files for removal vs addition logic), but T021 handler is in the same file as T012 — serialize these two.
- **Polish (Phase 5)**: Depends on Phases 3 and 4

### User Story Dependencies

- **US1+US2+US4 (P1+P2)**: Can start after Phase 2 — No dependencies on US3
- **US3 (P2)**: Can start after Phase 2 — Depends on T009 (AshYamlWriteService class exists) to add removal method. Best sequenced after US1 write service tasks.

### Within Each User Story

- Service logic before extension wiring
- Extension wiring before webview state
- Webview state before webview components
- Unit tests can run in parallel with wiring/components (test the service directly)

### Parallel Opportunities

- **Phase 2**: T002-T007 are ALL parallelizable (different files, no dependencies between them)
- **Phase 3**: T017 and T018 (tests) can run in parallel with T013-T016 (webview work) since they test different layers
- **Phase 4**: T024 (tests) can run in parallel with T022-T023 (webview work)
- **Phase 5**: T025 (sink demo) can run in parallel with T026-T027 (validation)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# All 6 foundational tasks can run in parallel (different files):
Task: T002 — Add types to vsix/src/models/types.ts
Task: T003 — Mirror types to webview/src/types/types.ts
Task: T004 — Add WebviewToExtMessage variants to vsix/src/models/messages.ts
Task: T005 — Add ExtToWebviewMessage variant to vsix/src/models/messages.ts
Task: T006 — Mirror messages to webview/src/types/messages.ts
Task: T007 — Export generateYamlEntry from vsix/src/models/mappers.ts
```

## Parallel Example: Phase 3 (US1+US2+US4)

```bash
# After T009 (write service), these can run in parallel:
Task: T011 — Wire in extension.ts
Task: T017 — Unit tests for pure helpers (tests vsix/src/services/ashYamlWrite.ts)
Task: T018 — Unit tests for addSuppression (tests vsix/src/services/ashYamlWrite.ts)

# After T011 (extension wiring):
Task: T012 — Message handler in findingsPanelManager.ts
Task: T013 — WebView state in App.tsx

# After T013 (state), these can run in parallel:
Task: T014 — SuppressionForm.tsx (new file)
Task: T015 — FindingDetailView.tsx modifications
Task: T016 — Wire suppressionResult in App.tsx
```

---

## Implementation Strategy

### MVP First (Phase 3: US1+US2+US4 Only)

1. Complete Phase 1: Install RadioGroup ShadCN component
2. Complete Phase 2: Types, messages, mapper export
3. Complete Phase 3: Full suppress form with YAML preview and scope
4. **STOP and VALIDATE**: Suppress a finding → verify `.ash.yaml` entry → verify UI updates
5. This delivers the core value proposition

### Incremental Delivery

1. Complete Setup + Foundational → Types and shared infrastructure ready
2. Add US1+US2+US4 → Full suppress flow → Test independently → **MVP!**
3. Add US3 → Unsuppress flow → Test independently → Complete feature
4. Add Polish → Kitchen Sink demo + validation → Ship

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] labels: US1 (Suppress), US2 (YAML Preview), US3 (Unsuppress), US4 (Scope Config)
- US1+US2+US4 share the SuppressionForm component and are grouped in Phase 3
- US3 is independently testable in Phase 4
- The file watcher cascade (Spec 013 → Spec 015) handles automatic UI refresh after writes — no manual refresh logic needed
- T004 and T005 both modify `vsix/src/models/messages.ts` — if parallelizing, one agent handles both, or serialize them
