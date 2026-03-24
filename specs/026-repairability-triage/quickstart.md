# Quickstart: Repairability Triage Analysis

**Feature**: 026-repairability-triage | **Date**: 2026-03-23

## Prerequisites

- Branch `026-repairability-triage` checked out
- `cd workbench/vsix && npm install` (extension dependencies)
- `cd workbench/webview && npm install` (webview dependencies)
- AI provider configured in VS Code settings (for classification)

## Build & Run

```bash
# Extension (watches for changes)
cd workbench/vsix && npm run watch

# WebView (watches for changes, fixed output filenames)
cd workbench/webview && npm run dev

# Run tests
cd workbench/vsix && npm run test

# Lint
cd workbench/vsix && npm run lint
```

Press F5 in VS Code to launch the Extension Development Host.

## Key Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `vsix/src/services/triageService.ts` | Triage orchestration: classify, cache, apply fixes, suppress |
| `vsix/src/services/triagePromptBuilder.ts` | AI prompt construction for classification |
| `vsix/src/models/triageTypes.ts` | TypeScript types: TriageClassification, TriageSummary, TriageCategory |
| `webview/src/components/TriageDashboardView.tsx` | Dashboard with KPI charts and severity × category matrix |
| `webview/src/components/TriageDrillDownView.tsx` | Filtered findings list with progress tracking |
| `webview/src/components/TriageFindingPanel.tsx` | Category-specific detail view with action button |
| `webview/src/components/TriageChart.tsx` | Reusable CSS bar chart component for repairability breakdown |
| `webview/src/pages/sink/demos/triage-dashboard-demo.tsx` | Kitchen Sink demo |
| `vsix/prisma/migrations/XXX_add_triage_analysis/migration.sql` | DB migration |

### Files to Modify

| File | Changes |
|------|---------|
| `vsix/prisma/schema.prisma` | Add `triageAnalysis Json?` to Finding model |
| `vsix/src/models/messages.ts` | Add triage message types to both unions |
| `vsix/src/models/mappers.ts` | Extend `mapFindingToRow()` with triage fields |
| `vsix/src/providers/findingsPanelManager.ts` | Add triage message handlers, inject TriageService |
| `vsix/src/extension.ts` | Instantiate TriageService, inject into panel manager |
| `webview/src/App.tsx` | Add `triageDashboard`/`triageDrillDown` view states, triage reducer cases |
| `webview/src/types/types.ts` | Add TriageClassification, TriageSummary, FindingRow extensions |
| `webview/src/types/messages.ts` | Mirror triage message types from vsix |
| `webview/src/lib/theme-colors.ts` | Add `repairabilityColor` map |
| `webview/src/components/SidebarDashboard.tsx` | Add "Triage" button |
| `webview/src/pages/sink/sink-registry.ts` | Register triage demo |

## Implementation Order

1. **Data model** — Schema migration, types, mapper extension
2. **TriageService** — Classification logic, fingerprinting, caching
3. **TriagePromptBuilder** — AI prompt for classification
4. **Message protocol** — New message types in both packages
5. **Panel manager** — Triage message handlers
6. **TriageDashboardView** — Charts and matrix UI
7. **TriageDrillDownView** — Filtered list with progress
8. **TriageFindingPanel** — Category-specific detail + actions
9. **One-click suppress** — Wire up to AshYamlWriteService
10. **One-click fix** — File read/validate/replace logic
11. **Systemic guidance** — Clipboard copy
12. **Kitchen Sink** — Demo with mock triage data
13. **Integration** — Sidebar button, navigation, state reducer

## Testing Strategy

| Layer | What to Test | Files |
|-------|-------------|-------|
| Unit (Mocha) | Fingerprint computation, prompt builder, triage type parsing | `vsix/src/test/services/triageService.test.ts` |
| Unit (Mocha) | Fix application logic (codeBefore match, replacement) | `vsix/src/test/services/triageFix.test.ts` |
| Unit (Mocha) | Triage summary aggregation | `vsix/src/test/services/triageSummary.test.ts` |
| Unit (Mocha) | Mapper extension (parseStoredTriageAnalysis) | `vsix/src/test/models/mappers.test.ts` |
| Visual (Sink) | Dashboard charts, drill-down, finding panel | `webview/src/pages/sink/demos/triage-dashboard-demo.tsx` |

## Architecture Patterns to Follow

- **Domain service**: `TriageService` is a class with injected dependencies (constructor params), async methods. Follow `FindingsService` pattern.
- **Prompt builder**: `triagePromptBuilder.ts` exports pure functions (`buildTriagePrompt()`, `parseTriageResponse()`). Follow `suppressionPromptBuilder.ts` pattern.
- **Panel manager**: Add triage handler cases to the existing `handleMessage()` switch. Follow the same setter injection pattern for `TriageService`.
- **WebView components**: Named exports, props interface defined above component, use `cn()` for class merging, import from `@/components/ui/*` for ShadCN.
- **View router**: Add to `ViewState` union, handle in reducer. Follow `'suppressionManager'` pattern for navigation.
- **Kitchen sink**: Create demo file as `triage-dashboard-demo.tsx`, register in `sink-registry.ts` with `type: 'app'`.
- **Type sync**: Copy triage types to both `vsix/src/models/triageTypes.ts` and `webview/src/types/types.ts`. Keep in sync manually.
