# Implementation Plan: Suppression Management View

**Branch**: `017-suppression-manager` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/017-suppression-manager/spec.md`

## Summary

Add a dedicated suppression management interface to the ASH Workbench that displays all `.ash.yaml` suppression rules with computed status (active/unused/expired), match counts against the latest scan, and provides add/edit/remove capabilities. The view is a new page within the existing editor panel, reachable from the sidebar dashboard, panel header, and a VS Code command. It extends the existing AshYaml read/write services with status computation and an update operation, adds 4 new WebView→Extension messages and 2 new Extension→WebView messages, and introduces 3 new React components.

## Technical Context

**Language/Version**: TypeScript / ES2022, strict mode, Node16 modules
**Primary Dependencies**: React 19, ShadCN/ui, Tailwind CSS v4, Vite 8 (webview); VS Code API (vsix)
**Storage**: `.ash.yaml` files (YAML on disk); PGLite for findings (existing, read-only for this feature)
**Testing**: Mocha (unit, Node.js) + `@vscode/test-electron` (integration); Kitchen Sink (visual)
**Target Platform**: VS Code ^1.110.0 (Electron)
**Project Type**: VS Code extension with React WebView
**Performance Goals**: 2s load time for suppression list (SC-001), 2s propagation of changes (SC-004)
**Constraints**: In-process only, no external services, single developer
**Scale/Scope**: 50+ suppression rules manageable with search/filter (SC-003)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. VS Code Native | PASS | Uses existing WebView panel, VS Code commands, file watchers. No external services. New command registered in `package.json`. |
| II. Extension Host Owns State | PASS | Status computation (`getSuppressionStatuses`) runs in extension host. WebView is pure renderer. Local UI state limited to filter/sort/search/form state. Message protocol enforced. |
| III. Ship Fast / Simplicity First | PASS | Extends existing services (no new infrastructure). Reuses `findSuppressionIndex`, `reserializeSuppressionsSection`, file watcher, conflict detection. No premature abstractions. |
| IV. Typed Contracts | PASS | 6 new message types added to discriminated unions. New types (`SuppressionEntry`, `SuppressionWriteResult`, etc.) in both packages. Manual sync required (documented). |
| V. Theme Integration | PASS | Uses ShadCN components, VS Code theme variables. Status badges use domain color maps from `theme-colors.ts`. `variant="outline"` buttons. |
| VI. Security by Default | PASS | No new CSP concerns. YAML write sanitization from Spec 016 reused. No `eval()`, no dynamic scripts. User input (form fields) validated before write. |

**Post-Phase 1 re-check**: All gates still pass. No violations introduced by design decisions.

## Project Structure

### Documentation (this feature)

```text
specs/017-suppression-manager/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: design decisions
├── data-model.md        # Phase 1: type definitions and state model
├── quickstart.md        # Phase 1: implementation guide
├── contracts/
│   └── message-protocol.md  # Phase 1: message contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2: task breakdown (via /speckit.tasks)
```

### Source Code (repository root)

```text
workbench/
├── vsix/src/
│   ├── models/
│   │   ├── types.ts              # + SuppressionEntry, SuppressionStatus, MatchedFindingRef, SuppressionWriteResult
│   │   └── messages.ts           # + requestSuppressions, editSuppression, removeSuppression, addSuppression,
│   │                             #   suppressionsUpdate, suppressionWriteResult
│   ├── services/
│   │   ├── ashYaml.ts            # + getSuppressionStatuses(findings) method
│   │   └── ashYamlWrite.ts       # + updateSuppression(old, updated), removeSuppressionRule(suppression),
│   │                             #   addSuppressionDirect(suppression) methods
│   ├── providers/
│   │   └── findingsPanelManager.ts  # + suppression management message handlers, showSuppressionManager()
│   └── extension.ts              # + command registration wiring
│
├── vsix/package.json              # + ashWorkbench.manageSuppressions command
│
└── webview/src/
    ├── types/
    │   ├── types.ts              # Mirror new types from vsix
    │   └── messages.ts           # Mirror new messages from vsix
    ├── components/
    │   ├── SuppressionManagerView.tsx  # NEW: main view (summary header + table + ignore paths + config)
    │   ├── SuppressionTable.tsx        # NEW: sortable/filterable/searchable table with expandable rows
    │   ├── SuppressionRuleForm.tsx     # NEW: add/edit form with validation and autocomplete
    │   ├── DashboardView.tsx           # MODIFIED: add "Manage Suppressions" link
    │   └── SidebarDashboard.tsx        # MODIFIED: add "Manage Suppressions" link with rule count
    ├── pages/sink/
    │   ├── suppression-management-demo.tsx  # NEW: Kitchen Sink demo
    │   └── sink-registry.ts                # MODIFIED: register demo
    └── App.tsx                    # MODIFIED: ViewState, AppState, reducer, render switch
```

**Structure Decision**: Extends existing monorepo layout (vsix/ + webview/) per constitution. No new packages or structural changes. All new components follow established file naming conventions (PascalCase for app components, kebab-case for sink demos).

## Design Decisions

See [research.md](research.md) for detailed rationale on each decision:

| # | Decision | Summary |
|---|----------|---------|
| R1 | Rule identity | Full-field matching via `findSuppressionIndex()` |
| R2 | Update operation | New `updateSuppression(old, new)` method using find-and-replace in YAML array |
| R3 | Direct removal | New `removeSuppressionRule(suppression)` method (separate from finding-driven `removeSuppression`) |
| R4 | Status computation | `getSuppressionStatuses(findings)` on `AshYamlService` (read service) |
| R5 | Write result type | New `SuppressionWriteResult` type (simpler than finding-driven `SuppressionResult`) |
| R6 | Edit form | Inline form (below selected row), consistent with existing SuppressionForm pattern |
| R7 | Message naming | Distinct names from finding-driven messages to avoid confusion |
| R8 | Navigation | `'suppressionManager'` ViewState + dual dispatch+postMessage pattern |

## Complexity Tracking

No constitution violations. No complexity justifications needed.
