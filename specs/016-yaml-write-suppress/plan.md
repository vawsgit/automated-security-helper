# Implementation Plan: .ash.yaml Write & Suppress Action

**Branch**: `016-yaml-write-suppress` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/016-yaml-write-suppress/spec.md`

## Summary

Close the suppress/unsuppress loop by adding write capability to the `.ash.yaml` workflow. Users can suppress a finding from the workbench UI (interactive form with scope selector, justification, live YAML preview) and unsuppress previously suppressed findings. Changes span a new write service in vsix/, message protocol extensions, and a new SuppressionForm component in the webview. The existing file watcher (Spec 013) and current findings view (Spec 015) handle automatic UI refresh after writes.

## Technical Context

**Language/Version**: TypeScript (strict mode, ES2022 target, Node16 modules)
**Primary Dependencies**: React 19, Vite 8, Tailwind CSS v4, ShadCN/ui, js-yaml 4.x, picomatch
**Storage**: `.ash.yaml` file on disk (no database changes)
**Testing**: Mocha (unit, Node.js) + `@vscode/test-electron` (integration)
**Target Platform**: VS Code extension (^1.110.0)
**Project Type**: VS Code extension + React WebView monorepo
**Performance Goals**: <2s suppress operation (SC-001), <2s UI refresh after write (SC-003)
**Constraints**: All in-process, no external services, single developer
**Scale/Scope**: Hundreds of findings, tens of suppression rules, single `.ash.yaml` file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. VS Code Native | PASS | File write via `vscode.workspace.fs`. No external services. AshYamlWriteService runs in-process. |
| II. Extension Host Owns State | PASS | Write logic lives in vsix/ (`AshYamlWriteService`). WebView sends user input via postMessage, receives results. Form state (scope, justification, preview) is local UI concern (permitted). |
| III. Ship Fast / Simplicity First | PASS | Append strategy for new entries (no complex YAML CST library). Re-uses existing `generateYamlEntry()` for preview. Single new service class. |
| IV. Typed Contracts at Boundaries | PASS | 3 new message types added to discriminated unions. `SuppressionInput` and `SuppressionResult` types mirrored in both packages. |
| V. Theme Integration | PASS | Suppression form uses existing ShadCN components. Suppress/unsuppress buttons use `variant="outline"` per convention. No custom colors. |
| VI. Security by Default | PASS | User input (justification) is sanitized by YAML serialization (js-yaml escapes special characters). File writes use VS Code API. No command injection risk. |

**Post-Phase 1 re-check**: All gates remain PASS. No violations introduced by design.

## Project Structure

### Documentation (this feature)

```text
specs/016-yaml-write-suppress/
├── plan.md                          # This file
├── spec.md                          # Functional specification
├── research.md                      # Phase 0 research decisions
├── data-model.md                    # Type and model changes
├── quickstart.md                    # Implementation quickstart
├── contracts/
│   └── message-protocol.md          # Message protocol contract
└── tasks.md                         # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
workbench/
├── vsix/src/
│   ├── models/
│   │   ├── types.ts                 # SuppressionScope, SuppressionInput, SuppressionResult
│   │   ├── messages.ts              # 3 new message variants
│   │   └── mappers.ts               # Export generateYamlEntry (already exists, make public)
│   ├── services/
│   │   ├── ashYaml.ts               # Existing read service (unchanged)
│   │   └── ashYamlWrite.ts          # NEW — write service
│   ├── providers/
│   │   └── findingsPanelManager.ts  # Handle suppress/unsuppress messages
│   └── extension.ts                 # Wire AshYamlWriteService
│
├── webview/src/
│   ├── types/
│   │   ├── types.ts                 # Mirror type additions
│   │   └── messages.ts              # Mirror message additions
│   ├── App.tsx                      # Reducer: form state + suppressionResult handler
│   └── components/
│       ├── SuppressionForm.tsx      # NEW — interactive suppress form with YAML preview
│       ├── FindingDetailView.tsx    # Suppress/unsuppress buttons + form mount point
│       └── SuppressionPanel.tsx     # Add unsuppress button
│
└── vsix/src/test/unit/
    └── ashYamlWrite.test.ts         # NEW — write service tests
```

**Structure Decision**: Extends existing monorepo structure (vsix/ + webview/). One new service file, one new component file, one new test file. All other changes modify existing files.

## Phase 0: Research

See [research.md](./research.md) for 9 research decisions covering:
- R1: YAML write strategy — text append for adds, re-serialize for removes
- R2: File creation strategy — minimal skeleton with `.ash.yaml` filename
- R3: Conflict detection — mtime comparison with single retry
- R4: YAML validation — parse before write, refuse on invalid
- R5: Entry serialization — reuse `generateYamlEntry()` for preview and write
- R6: Unsuppress matching — field-by-field comparison using existing AshSuppression
- R7: Message protocol extensions — 3 new messages
- R8: Form design — inline React component in FindingDetailView
- R9: File I/O — `vscode.workspace.fs` for writes

All NEEDS CLARIFICATION items resolved. No outstanding unknowns.

## Phase 1: Design

### Data Model

See [data-model.md](./data-model.md) for complete type definitions.

**Key additions**:
- `SuppressionScope` type: `'file_rule' | 'rule_everywhere' | 'file_all_rules'`
- `SuppressionInput` interface: user's form choices sent to extension host
- `SuppressionResult` interface: success/error feedback from extension host
- `AshYamlWriteService` class: handles all `.ash.yaml` write operations
- WebView state: `suppressionFormFindingId` and `suppressionPending` fields

### Contracts

See [contracts/message-protocol.md](./contracts/message-protocol.md) for complete message protocol.

**New messages**:
- `suppressFinding` (webview → ext): write a new suppression entry
- `unsuppressFinding` (webview → ext): remove a suppression entry
- `suppressionResult` (ext → webview): operation result with success/error

### Implementation Approach

#### Layer 1: Types & Messages (foundation, no behavior change)

1. Add `SuppressionScope`, `SuppressionInput`, `SuppressionResult` to `types.ts` in both packages
2. Add `suppressFinding`, `unsuppressFinding` to `WebviewToExtMessage` in both packages
3. Add `suppressionResult` to `ExtToWebviewMessage` in both packages
4. Export `generateYamlEntry` as a public function from `mappers.ts` (currently private)

#### Layer 2: Write Service (core logic)

5. Create `vsix/src/services/ashYamlWrite.ts` with pure helper functions:
   - `inputToSuppression()`: converts `SuppressionInput` → `AshSuppression` based on scope
   - `serializeSuppressionEntry()`: produces indented YAML text for file append
   - `generateSkeleton()`: creates `.ash.yaml` content for new files
   - `findSuppressionIndex()`: locates matching entry in suppressions array
   - `reserializeSuppressionsSection()`: rewrites suppressions after entry removal
6. Create `AshYamlWriteService` class with `addSuppression()` and `removeSuppression()`:
   - Add: validate → read file → check mtime → append entry text → write file
   - Remove: validate → read file → check mtime → parse → remove entry → re-serialize → write file
   - Both: handle file creation (FR-008), invalid YAML (FR-011), conflict detection (FR-010)

#### Layer 3: Extension Host Wiring (providers + coordination)

7. Wire `AshYamlWriteService` in `extension.ts`:
   - Instantiate with scan root and ashYamlService
   - Pass to FindingsPanelManager via setter (`setAshYamlWriteService()`)
   - Update scan root on setting change
8. Add message handlers in `FindingsPanelManager.handleMessage()`:
   - `suppressFinding`: call `writeService.addSuppression()`, send `suppressionResult`
   - `unsuppressFinding`: look up matching suppression, call `writeService.removeSuppression()`, send `suppressionResult`
   - No manual UI refresh — file watcher cascade handles it (Spec 013 → Spec 015)

#### Layer 4: WebView State (reducer + actions)

9. Extend AppState with `suppressionFormFindingId: string | null` and `suppressionPending: boolean`
10. Add reducer actions:
    - `OPEN_SUPPRESSION_FORM`: set `suppressionFormFindingId`
    - `CLOSE_SUPPRESSION_FORM`: clear form state
    - `suppressionResult` message handler: close form on success, show error on failure, clear pending

#### Layer 5: WebView Components (UI)

11. Create `SuppressionForm.tsx`:
    - Scope radio group (3 presets from FR-004)
    - Justification textarea (pre-populated from finding notes per FR-017)
    - Line range toggle (ShadCN Switch, hidden when no line numbers, default off per FR-018)
    - Optional expiration date input
    - Live YAML preview panel (computed from local form state)
    - "Add Suppression" button with client-side validation (non-empty justification)
    - Disable button + show spinner while `suppressionPending`
12. Modify `FindingDetailView.tsx`:
    - Add "Suppress" button when `!finding.isCurrentlySuppressed` (after triage section, visually distinct per FR-016)
    - Add "Unsuppress" button when `finding.isCurrentlySuppressed`
    - Render `SuppressionForm` inline when form is open for this finding
    - Wire buttons to dispatch `OPEN_SUPPRESSION_FORM` and send `unsuppressFinding` message
13. Modify `SuppressionPanel.tsx`:
    - Add "Unsuppress" button when finding is suppressed via .ash.yaml
    - Show confirmation before sending `unsuppressFinding` message
    - Warn when suppression matches multiple findings (count from suppressionSummary or pass count)
14. Add Kitchen Sink demo for `SuppressionForm` in sink page

#### Layer 6: Testing

15. Unit tests for pure helpers (`inputToSuppression`, `serializeSuppressionEntry`, `generateSkeleton`, `findSuppressionIndex`, `reserializeSuppressionsSection`)
16. Unit tests for `AshYamlWriteService`:
    - Add suppression to existing file (verify append, content preserved)
    - Add suppression when no file exists (verify skeleton creation)
    - Remove suppression (verify correct entry removed)
    - Invalid YAML rejection (verify error returned)
    - Conflict detection (mtime mismatch handling)
17. Unit tests for reducer actions (`OPEN_SUPPRESSION_FORM`, `CLOSE_SUPPRESSION_FORM`, `suppressionResult`)

### Dependencies Between Layers

```
Layer 1 (Types) ← Layer 2 (Service) ← Layer 3 (Wiring) ← Layer 4 (State) ← Layer 5 (UI)
                                                                               ↑
                                                          Layer 6 (Tests) -----|
```

Layers 1-3 are sequential (each depends on previous). Layers 4 and 5 can be worked in parallel once Layer 1 is done (types are shared). Layer 6 can begin as soon as Layer 2 is done.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
