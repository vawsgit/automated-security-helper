# Implementation Plan: Unified Current Findings View

**Branch**: `015-current-findings-view` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/015-current-findings-view/spec.md`

## Summary

Add a "Current Findings" computed view that becomes the default experience in ASH Workbench. Current findings = latest completed scan's findings with .ash.yaml suppression status overlaid. This replaces the scan-selection-required workflow. Changes span types, mappers, services, providers, and webview components across both vsix/ and webview/ packages.

## Technical Context

**Language/Version**: TypeScript (strict mode, ES2022 target, Node16 modules)
**Primary Dependencies**: React 19, Vite 8, Tailwind CSS v4, ShadCN/ui, PGLite + Prisma ORM, picomatch
**Storage**: PGLite (WASM PostgreSQL) via Prisma ORM — no schema changes needed
**Testing**: Mocha (unit, Node.js) + `@vscode/test-electron` (integration)
**Target Platform**: VS Code extension (^1.110.0)
**Project Type**: VS Code extension + React WebView monorepo
**Performance Goals**: <2s dashboard load (SC-001), <3s .ash.yaml reactivity (SC-002), <500ms toggle (SC-003)
**Constraints**: All in-process, no external services, single developer
**Scale/Scope**: Single workspace, hundreds of findings, tens of suppression rules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. VS Code Native | PASS | All computation in-process. No external services. Data in globalStorageUri via PGLite. |
| II. Extension Host Owns State | PASS | Current findings computed in FindingsService (extension host). WebView receives via postMessage, renders only. Toggle is local UI state (permitted per constitution). |
| III. Ship Fast / Simplicity First | PASS | Computed view (no new DB table). Extends existing patterns (mappers, services, messages). No new abstractions. |
| IV. Typed Contracts at Boundaries | PASS | New message types added to discriminated unions. Types mirrored in both packages. Optional mapper parameter preserves backward compatibility. |
| V. Theme Integration | PASS | Suppression badge uses existing domain color map pattern (theme-colors.ts). Toggle uses ShadCN Switch. No custom colors. |
| VI. Security by Default | PASS | No new security surfaces. No new user input paths. Suppression data from .ash.yaml is already sanitized by Spec 013 parser. |

**Post-Phase 1 re-check**: All gates remain PASS. No violations introduced by design.

## Project Structure

### Documentation (this feature)

```text
specs/015-current-findings-view/
├── plan.md                          # This file
├── spec.md                          # Functional specification
├── research.md                      # Phase 0 research decisions
├── data-model.md                    # Type and model changes
├── quickstart.md                    # Implementation quickstart
├── contracts/
│   └── message-protocol.md          # Message protocol contract
├── checklists/
│   └── requirements.md              # Spec quality checklist
└── tasks.md                         # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
workbench/
├── vsix/src/
│   ├── models/
│   │   ├── types.ts                 # FindingRow + new types
│   │   ├── messages.ts              # New message variants
│   │   └── mappers.ts               # Suppression-aware mapper
│   ├── services/
│   │   └── findings.ts              # getCurrentFindings(), getFindingsWithSuppressionOverlay()
│   ├── providers/
│   │   ├── findingsPanelManager.ts  # Current findings flow, .ash.yaml reactivity
│   │   └── sidebarWebviewProvider.ts # Current findings summary
│   └── extension.ts                 # .ash.yaml change cascade wiring
│
└── webview/src/
    ├── types/
    │   ├── types.ts                 # Mirror of vsix types
    │   └── messages.ts              # Mirror of vsix messages
    ├── App.tsx                      # State + reducer changes
    └── components/
        ├── DashboardView.tsx        # Active vs suppressed counts
        ├── SidebarDashboard.tsx     # Active vs suppressed counts
        ├── FindingsView.tsx         # Suppression toggle, row styling
        ├── FindingDetailView.tsx    # Suppression indicator
        ├── TriageControls.tsx       # Disable Suppress button
        └── TriageProgressBar.tsx    # Active findings denominator
```

**Structure Decision**: Extends existing monorepo structure (vsix/ + webview/). No new directories or packages. All changes modify existing files.

## Phase 0: Research

See [research.md](./research.md) for 9 research decisions covering:
- R1: Computed view strategy (no new DB table)
- R2: Latest completed scan query pattern
- R3: Batch suppression matching performance
- R4: Message protocol extension pattern
- R5: Suppression toggle as local UI state
- R6: .ash.yaml change reactivity flow
- R7: mapFindingToRow suppression-aware extension
- R8: Historical scan suppression overlay
- R9: Triage progress bar denominator change

All NEEDS CLARIFICATION items resolved. No outstanding unknowns.

## Phase 1: Design

### Data Model

See [data-model.md](./data-model.md) for complete type definitions.

**Key changes**:
- `FindingRow` gains `isCurrentlySuppressed: boolean` and `suppressionSource: 'ash_yaml' | null`
- Existing `suppression: SuppressionData | null` field gets populated when .ash.yaml matches
- New types: `SuppressionSummary`, `AshYamlConfigSummary`
- `mapFindingToRow` gains optional `suppression?: AshSuppression` parameter
- `FindingsService` gains `getCurrentFindings()` and `getFindingsWithSuppressionOverlay()`
- `AppState` gains `currentFindings`, `suppressionSummary`, `showSuppressed`

### Contracts

See [contracts/message-protocol.md](./contracts/message-protocol.md) for complete message protocol.

**New messages**:
- `currentFindingsUpdate` (ext → webview): findings + suppression summary + scan metadata
- `ashYamlChanged` (ext → webview): config summary for informational display
- `requestCurrentFindings` (webview → ext): explicit refresh request

### Implementation Approach

#### Layer 1: Types & Messages (foundation, no behavior change)

1. Add `isCurrentlySuppressed` and `suppressionSource` to `FindingRow` in both packages
2. Add `SuppressionSummary` and `AshYamlConfigSummary` types in both packages
3. Add `currentFindingsUpdate`, `ashYamlChanged` to `ExtToWebviewMessage` in both packages
4. Add `requestCurrentFindings` to `WebviewToExtMessage` in both packages

#### Layer 2: Mapper & Service (core logic)

5. Extend `mapFindingToRow` with optional `AshSuppression` parameter + `generateYamlEntry` helper
6. Add `getCurrentFindings()` to FindingsService — queries latest completed scan, batch matches suppressions, returns enriched FindingRow[] + SuppressionSummary
7. Add `getFindingsWithSuppressionOverlay()` to FindingsService — enriches any scan's findings with current suppression overlay

#### Layer 3: Extension Host Wiring (providers + coordination)

8. FindingsPanelManager: Add `postCurrentFindingsUpdate()` method. Modify `handleMessage` to handle `requestCurrentFindings`. Modify `showFindings` to use suppression overlay. Add `refreshCurrentFindings()` for .ash.yaml change handler
9. SidebarWebviewProvider: Modify `queryStateAndPost()` to also compute and post current findings summary
10. Extension.ts: Wire `ashYamlService.onDidChangeConfig` to trigger `findingsPanelManager.refreshCurrentFindings()` and `sidebarProvider.queryStateAndPost()`

#### Layer 4: WebView State (reducer + actions)

11. Add `currentFindings`, `suppressionSummary`, `showSuppressed` to AppState initial state
12. Add reducer cases: `currentFindingsUpdate` → set currentFindings/suppressionSummary; `ashYamlChanged` → informational; `TOGGLE_SHOW_SUPPRESSED` → flip boolean

#### Layer 5: WebView Components (UI changes)

13. DashboardView: Show active findings count (from suppressionSummary.active), suppressed count, severity breakdown of active findings only, "Last scanned" timestamp
14. SidebarDashboard: Show active findings count, suppressed count, severity breakdown of active findings only
15. TriageProgressBar: Accept active findings count as denominator (exclude suppressed)
16. FindingsView: Add "Show suppressed" toggle (ShadCN Switch). When off, filter out `isCurrentlySuppressed === true`. When on, show all with muted/badge styling for suppressed rows
17. FindingDetailView: Show "Currently suppressed" badge when `isCurrentlySuppressed === true`, with suppression details (justification, expiration)
18. TriageControls: Disable SUPPRESS button, add tooltip "Suppression is managed via .ash.yaml"

#### Layer 6: Testing

19. Unit tests for `getCurrentFindings()` — mock Prisma + AshYamlService, verify suppression overlay
20. Unit tests for extended `mapFindingToRow` — with and without suppression parameter
21. Unit tests for `generateYamlEntry` helper
22. Unit tests for reducer cases — `currentFindingsUpdate`, `ashYamlChanged`, `TOGGLE_SHOW_SUPPRESSED`

### Dependencies Between Layers

```
Layer 1 (Types) ← Layer 2 (Logic) ← Layer 3 (Wiring) ← Layer 4 (State) ← Layer 5 (UI)
                                                                            ↑
                                                         Layer 6 (Tests) ---|
```

Layers 1-3 are sequential (each depends on previous). Layers 4 and 5 can be worked in parallel once Layer 1 is done (types are shared). Layer 6 can begin as soon as Layer 2 is done.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
