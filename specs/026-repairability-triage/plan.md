# Implementation Plan: Repairability Triage Analysis

**Branch**: `026-repairability-triage` | **Date**: 2026-03-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/026-repairability-triage/spec.md`

## Summary

Add an AI-driven repairability triage system that classifies HIGH severity, non-suppressed findings into three categories (Suppress, Easy Fix, Systemic) and provides category-specific actions: one-click suppress with AI justification, one-click code fix with before/after preview, and comprehensive repair guidance with clipboard copy. A new triage dashboard with CSS-based KPI charts shows the repairability landscape across all findings, with drill-down into severity × category combinations for systematic remediation workflows.

The implementation extends the existing Finding data model with a `triageAnalysis` JSON field, adds a `TriageService` for classification orchestration and action execution, and introduces three new WebView components (dashboard, drill-down list, triage finding panel). All patterns follow established conventions: extension host owns state, typed postMessage protocol, CSS-based charts, ShadCN/Tailwind styling.

## Technical Context

**Language/Version**: TypeScript / ES2022 (strict mode, Node16 modules)
**Primary Dependencies**: React 19, ShadCN/ui, Tailwind CSS v4, Prisma ORM, Claude Agent SDK, @tanstack/react-table, lucide-react
**Storage**: PGLite (WASM PostgreSQL) via Prisma ORM — new JSON field on existing Finding model + DB migration
**Testing**: Mocha (unit, Node.js) + @vscode/test-electron (integration) + Kitchen Sink (visual)
**Target Platform**: VS Code extension (desktop, Electron)
**Project Type**: VS Code extension (monorepo: vsix/ + webview/)
**Performance Goals**: Dashboard renders cached data within 1s; individual classification completes within AI provider response time (~5-15s per finding)
**Constraints**: No external charting libraries (CSS-based only per existing pattern); AI calls require user-configured provider; file writes for easy fix must be path-safe
**Scale/Scope**: POC targets HIGH severity findings only; typical project has 10-100 HIGH severity findings

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | All processing in extension host. AI provider user-configured (existing). PGLite in-process. File writes via `vscode.workspace.fs`. |
| II. Extension Host Owns State | PASS | TriageService in vsix/src/. WebView is pure renderer. Typed messages for all communication. No business logic in WebView. |
| III. Ship Fast / Simplicity First | PASS | JSON field on existing model (no new tables). Reuses AI provider, batch pattern, suppression infrastructure. CSS charts (no new library). One new service + prompt builder. |
| IV. Typed Contracts at Boundaries | PASS | New discriminated union message types. Triage types manually synced between vsix/ and webview/. Prisma schema typed. |
| V. Theme Integration | PASS | New repairability colors follow `theme-colors.ts` pattern. ShadCN components. CSS bar charts match existing SeverityChart pattern. |
| VI. Security by Default | PASS | Easy fix file writes use `vscode.workspace.fs` with path validation. No eval() or dynamic injection. AI-generated code applied via targeted text replacement, not blind file overwrite. |

### Post-Design Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | No new external dependencies. File write uses VS Code workspace FS API. |
| II. Extension Host Owns State | PASS | TriageService owns all classification state, caching, and action execution. WebView receives results via postMessage. |
| III. Ship Fast / Simplicity First | PASS | Single JSON field, no new tables. Reuses existing batch analysis event pattern. 3 new WebView components (dashboard, drill-down, panel). |
| IV. Typed Contracts at Boundaries | PASS | 10 new ExtToWebview messages, 7 new WebviewToExt messages — all typed discriminated unions. |
| V. Theme Integration | PASS | New `repairabilityColor` map follows same `bg-{color}-500/15` pattern. Charts are CSS `<div>` bars. |
| VI. Security by Default | PASS | File path validation before writes. Line-range matching to prevent wrong-location edits. Fingerprint check before fix application. |

## Project Structure

### Documentation (this feature)

```text
specs/026-repairability-triage/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: data model design
├── quickstart.md        # Phase 1: implementation quickstart
├── contracts/           # Phase 1: message protocol contracts
│   ├── ext-to-webview.md
│   └── webview-to-ext.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
vsix/src/
├── services/
│   ├── triageService.ts              # Triage orchestration: classify, cache, actions
│   └── triagePromptBuilder.ts        # AI prompt construction for classification
├── models/
│   ├── triageTypes.ts                # TriageAnalysis, TriageSummary, TriageCategory types
│   └── messages.ts                   # Extended with triage message types
└── providers/
    └── findingsPanelManager.ts       # Extended with triage message handlers

vsix/prisma/
├── schema.prisma                     # Finding model: add triageAnalysis Json? field
└── migrations/
    └── XXX_add_triage_analysis/
        └── migration.sql             # ALTER TABLE Finding ADD COLUMN triageAnalysis TEXT

webview/src/
├── components/
│   ├── TriageDashboardView.tsx       # KPI charts + severity × category matrix
│   ├── TriageDrillDownView.tsx       # Filtered findings list with progress tracking
│   ├── TriageFindingPanel.tsx        # Category-specific detail + action button
│   └── TriageChart.tsx               # CSS bar chart for repairability breakdown
├── lib/
│   └── theme-colors.ts              # Extended with repairabilityColor map
├── types/
│   ├── types.ts                     # Extended with TriageAnalysis, TriageSummary types
│   └── messages.ts                  # Extended with triage message types
└── pages/sink/demos/
    └── triage-dashboard-demo.tsx     # Kitchen sink demo for triage components
```

**Structure Decision**: Follows existing monorepo layout. New files are co-located with existing patterns: services with services, types with types, components with components. No new directories needed beyond the contracts/ spec directory.

## Complexity Tracking

No constitution violations requiring justification. All design decisions stay within established patterns.

## Design Decisions

### D1: Data Storage — JSON Field on Finding

**Decision**: Add `triageAnalysis Json?` field to the existing Finding model.

**Rationale**: Follows the exact pattern of `aiAnalysis Json?`. Avoids a new table, new relations, and new migration complexity. The JSON field stores the full classification result including category, explanation, action data, and a fingerprint for cache invalidation.

**Alternative rejected**: Separate TriageAnalysis table — adds join complexity, new Prisma model, new mapper, and breaks the existing pattern where finding-level metadata is co-located on the Finding record.

### D2: Chart Visualization — CSS-Based

**Decision**: Use CSS `<div>` bars with Tailwind classes, matching the existing `SeverityChart` pattern.

**Rationale**: Constitution V (Theme Integration) and III (Ship Fast) both favor this. No new charting library to add, configure, or theme. The existing `SeverityChart` uses percentage-width divs with `severityColor[].fill` classes. The triage dashboard will use the same pattern with a new `repairabilityColor` map.

**Alternative rejected**: Recharts/Chart.js — adds a dependency, requires theme integration, increases bundle size, and creates a maintenance surface. The visual requirements (horizontal bars, stacked bars) are trivially implementable with CSS.

### D3: Classification Prompt Strategy — Single Classification Call

**Decision**: One AI call per finding that returns both the category classification AND the category-specific action data (explanation, risk, and action guidance).

**Rationale**: A two-pass approach (classify first, then generate guidance) doubles AI costs and latency. Since the AI must read the finding context to classify, it already has everything needed to generate the action data in the same call. The prompt uses a structured output schema with conditional sections based on the determined category.

**Alternative rejected**: Two-pass (classify → generate) — doubles cost and latency. The classification and guidance generation share the same context window, making a single call more efficient.

### D4: Easy Fix Application — Targeted Text Replacement

**Decision**: The easy fix stores `codeBefore` (original lines) and `codeAfter` (fixed lines) with exact line numbers. Application reads the file, validates the `codeBefore` text still matches at the expected lines, and replaces with `codeAfter`. Uses `vscode.workspace.fs` for file I/O.

**Rationale**: Targeted replacement is safer than full-file rewrite. The before/after pattern allows validation that the code hasn't changed since analysis (the `codeBefore` must match the current file content at those lines). If it doesn't match, the fix is rejected with a re-analysis recommendation.

**Security considerations**: Path is validated against workspace root (no directory traversal). The `codeBefore` match prevents applying fixes to modified files. The user reviews changes via git diff.

### D5: Cache Invalidation — Content Fingerprint

**Decision**: Generate a hash of `ruleId + file + snippet + severity + description` and store it in the `triageAnalysis` JSON. On triage dashboard load, compare current finding attributes against stored fingerprint. Mismatch means the finding changed → re-classify.

**Rationale**: Simple, deterministic, and cheap to compute. The fingerprint captures all attributes that would affect the AI's classification decision. Changes to line numbers alone (code reformatting) don't invalidate the cache if the snippet content is the same.

**Alternative rejected**: Timestamp comparison (last scan time vs analysis time) — too coarse; a finding could persist unchanged across many scans.

### D6: New View States — Extend Existing ViewState Union

**Decision**: Add `'triageDashboard'` and `'triageDrillDown'` to the existing `ViewState` union in `App.tsx`.

**Rationale**: Follows the established view router pattern. The triage dashboard and drill-down are new navigable views, just like `'findingList'` and `'findingDetail'`. They participate in the view history stack for BACK navigation.

### D7: Triage Dashboard as Editor Panel View

**Decision**: The triage dashboard is rendered in the editor panel (managed by `FindingsPanelManager`), not the sidebar.

**Rationale**: The dashboard needs significant screen real estate for charts and the drill-down list. The sidebar has constrained width. The existing pattern uses the editor panel for data-heavy views (findings list, finding detail, scan detail). The sidebar's `SidebarDashboard` can add a "Triage Dashboard" button that opens the editor panel view.

### D8: Batch Classification — Reuse Existing Batch Pattern

**Decision**: Batch triage classification follows the same event-driven pattern as `startBatchAnalysis` in `AiService`: sequential processing, consecutive failure detection, progress events, background continuation.

**Rationale**: The batch analysis pattern (Spec 023) is proven and well-tested. It handles all the edge cases: cancellation, failure tracking, progress reporting, skip logic. The triage batch just uses different prompts and stores results in `triageAnalysis` instead of `aiAnalysis`.

### D9: TriageService — Separate Service Class

**Decision**: New `TriageService` class in `vsix/src/services/` that orchestrates triage workflows. Depends on `AiService` (for AI provider access), `FindingsService` (for queries/updates), and `AshYamlWriteService` (for suppressions).

**Rationale**: Triage has distinct business logic (fingerprinting, cache checks, fix application, batch classification) that doesn't belong in `AiService` (which manages provider lifecycle) or `FindingsService` (which manages CRUD). A dedicated service follows the domain service pattern established by `ScannerService`, `FindingsService`, etc.

### D10: Repairability Color Map

**Decision**: Add a `repairabilityColor` map to `theme-colors.ts` with three entries:
- **suppress**: purple tones (`bg-purple-500/15 text-purple-700 dark:text-purple-400`) — distinct from disposition SUPPRESS (indigo)
- **easy_fix**: green tones (`bg-green-500/15 text-green-700 dark:text-green-400`) — connotes "safe to fix"
- **systemic**: amber tones (`bg-amber-500/15 text-amber-700 dark:text-amber-400`) — connotes "caution, complex"

**Rationale**: Each category needs a distinct visual identity in charts and badges. Purple/green/amber are unused in the existing severity (red/orange/yellow/blue/gray) and disposition (gray/teal/indigo/slate) palettes, preventing visual confusion.
