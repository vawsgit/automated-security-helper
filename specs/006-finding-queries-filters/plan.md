# Implementation Plan: Finding Queries, Filters & Summary

**Branch**: `006-finding-queries-filters` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-finding-queries-filters/spec.md`

## Summary

Create a `FindingsService` that centralizes all finding, scan, and scan-target database queries. Add filtering support (severity, scanner, disposition, file pattern) via a new `applyFilters` message. Enrich scan targets with computed aggregates (finding counts, severity breakdown, triage progress). Replace all remaining mock data in the WebView with real data pushed from the extension host. Extend the `stateUpdate` message to include scan targets.

## Technical Context

**Language/Version**: TypeScript (strict mode, ES2022 target, Node16 modules)
**Primary Dependencies**: Prisma ORM (PGLite adapter), VS Code Extension API, React 19 (WebView)
**Storage**: PGLite (WASM PostgreSQL) via Prisma — in-process, no external DB
**Testing**: Mocha (unit, Node.js) + sinon for mocking
**Target Platform**: VS Code extension (Node.js extension host + WebView renderer)
**Project Type**: VS Code extension (monorepo: vsix/ + webview/)
**Performance Goals**: < 1 second for finding queries with up to 500 findings
**Constraints**: Single-user, in-process database, no network calls
**Scale/Scope**: 1–5 scan targets, 1–50 scans, 0–1000 findings per scan

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | All queries run in-process via PGLite. No external services. |
| II. Extension Host Owns State | PASS | FindingsService lives in vsix/. WebView sends filter actions via postMessage, receives filtered data back. No client-side data fetching. |
| III. Ship Fast / Simplicity First | PASS | FindingsService is a thin wrapper around Prisma queries + mappers. No abstractions beyond what's needed for filter composition. |
| IV. Typed Contracts at Boundaries | PASS | FilterState type defined in both packages. applyFilters message added to discriminated union. Prisma queries produce typed results. |
| V. Theme Integration | N/A | No visual changes in this spec. |
| VI. Security by Default | PASS | No user input flows to raw SQL. All queries via Prisma parameterized ORM. File pattern filter uses Prisma `contains` (parameterized). |

**Post-design re-check**: All gates still PASS. No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/006-finding-queries-filters/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── findings-service.md
│   ├── message-protocol.md
│   └── webview-changes.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code

```text
vsix/src/
├── services/
│   └── findings.ts          # NEW: FindingsService class
├── models/
│   ├── types.ts             # MODIFY: Add FilterState interface
│   ├── messages.ts          # MODIFY: Add applyFilters, update stateUpdate
│   └── mappers.ts           # MODIFY: Add mapScanTargetToView()
├── providers/
│   ├── findingsPanelManager.ts  # MODIFY: Use FindingsService, add applyFilters handler
│   └── sidebarWebviewProvider.ts  # MODIFY: Use FindingsService for queryStateAndPost
├── extension.ts             # MODIFY: Create and inject FindingsService

webview/src/
├── types/
│   ├── types.ts             # MODIFY: Add FilterState interface
│   └── messages.ts          # MODIFY: Add applyFilters, update stateUpdate
├── App.tsx                  # MODIFY: Remove mock imports, update reducer
└── mock-data.ts             # KEEP: Used by Kitchen Sink only
```

**Structure Decision**: No new directories needed. One new file (`vsix/src/services/findings.ts`). All other changes are modifications to existing files.

## Implementation Phases

### Phase 1: Foundation — FindingsService & Types

Create the FindingsService class and update shared types. This is the prerequisite for all subsequent phases.

- Add `FilterState` to `vsix/src/models/types.ts`
- Add `mapScanTargetToView()` to `vsix/src/models/mappers.ts`
- Create `vsix/src/services/findings.ts` with all four methods
- Mirror `FilterState` in `webview/src/types/types.ts`

### Phase 2: Message Protocol Updates

Update message types in both packages to support filtering and enriched state.

- Add `applyFilters` to `WebviewToExtMessage` in both packages
- Update `stateUpdate` payload to include `scanTargets` in both packages

### Phase 3: Provider Wiring (US1)

Replace inline queries in providers with FindingsService calls. Wire FindingsService into the extension.

- Update `extension.ts` to create and inject FindingsService
- Update `findingsPanelManager.ts` to use FindingsService
- Update `sidebarWebviewProvider.ts` to use FindingsService (including scanTargets)
- Add `stateUpdate` push after disposition changes

### Phase 4: Filter Support (US2)

Add the applyFilters message handler and wire it through the provider.

- Add `applyFilters` handler to `findingsPanelManager.ts`

### Phase 5: WebView Mock Removal (US1 + US3)

Remove mock data dependencies from the WebView and update the reducer to handle real data.

- Remove mock imports from `App.tsx`
- Update initial state to empty defaults
- Update `stateUpdate` handler to accept `scanTargets`
- Replace mock helper calls in `dispositionUpdated`, `SET_DISPOSITION`, `SET_NOTES` handlers

### Phase 6: Polish

Compile, lint, test, verify.

- `npm run compile` in vsix/
- `npm run lint` in vsix/
- `npm run build` in webview/
- `npm run test:unit` in vsix/
- Verify no mock-data imports in App.tsx
