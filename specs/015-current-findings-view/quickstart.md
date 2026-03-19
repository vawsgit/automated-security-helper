# Quickstart: Unified Current Findings View

**Branch**: `015-current-findings-view` | **Date**: 2026-03-19

## Prerequisites

- Spec 012 (Scan Root) implemented: `ScanRootService` available with `getEffectiveScanRoot()`
- Spec 013 (.ash.yaml Read + Suppression Matching) implemented: `AshYamlService` available with `matchesSuppression()`, `getMatchingSuppressions()`, and `onDidChangeConfig` event

## Implementation Order

1. **Types & messages** — Add new fields and message types (both vsix + webview mirrors)
2. **Mapper** — Extend `mapFindingToRow` with optional suppression parameter
3. **FindingsService** — Add `getCurrentFindings()` and `getFindingsWithSuppressionOverlay()`
4. **FindingsPanelManager** — Wire current findings flow, .ash.yaml change handler
5. **SidebarWebviewProvider** — Wire current findings summary
6. **Extension.ts** — Connect .ash.yaml change event to recomputation cascade
7. **WebView state** — Add AppState fields, reducer cases
8. **Dashboard components** — Active vs suppressed counts, triage progress denominator
9. **FindingsView** — Suppression toggle, suppressed row styling
10. **FindingDetailView** — Suppression indicator
11. **TriageControls** — Disable Suppress button with tooltip

## Key Files to Modify

| File | Change |
|------|--------|
| `vsix/src/models/types.ts` | Add `isCurrentlySuppressed`, `suppressionSource` to FindingRow; add `SuppressionSummary`, `AshYamlConfigSummary` |
| `webview/src/types/types.ts` | Mirror above |
| `vsix/src/models/messages.ts` | Add `currentFindingsUpdate`, `ashYamlChanged` to ExtToWebviewMessage; add `requestCurrentFindings` to WebviewToExtMessage |
| `webview/src/types/messages.ts` | Mirror above |
| `vsix/src/models/mappers.ts` | Extend `mapFindingToRow` signature, add `generateYamlEntry` helper |
| `vsix/src/services/findings.ts` | Add `getCurrentFindings()`, `getFindingsWithSuppressionOverlay()` |
| `vsix/src/providers/findingsPanelManager.ts` | Current findings flow, .ash.yaml change handler, modify `requestState`/`showFindings` |
| `vsix/src/providers/sidebarWebviewProvider.ts` | Post current findings summary |
| `vsix/src/extension.ts` | Wire .ash.yaml change → recomputation cascade |
| `webview/src/App.tsx` | AppState fields, reducer cases for `currentFindingsUpdate`, `ashYamlChanged`, `TOGGLE_SHOW_SUPPRESSED` |
| `webview/src/components/DashboardView.tsx` | Active vs suppressed counts |
| `webview/src/components/SidebarDashboard.tsx` | Active vs suppressed counts |
| `webview/src/components/FindingsView.tsx` | Suppression toggle, row styling |
| `webview/src/components/FindingDetailView.tsx` | Suppression indicator |
| `webview/src/components/TriageControls.tsx` | Disable Suppress button |
| `webview/src/components/TriageProgressBar.tsx` | Active findings denominator |

## Build & Test

```bash
cd vsix && npm run compile   # TypeScript compile
cd webview && npm run build  # Vite build
cd vsix && npm run test      # Run tests
```

## Verification Checklist

1. Open sidebar → see active findings count (not total)
2. Open findings panel → suppressed findings hidden by default
3. Toggle "Show suppressed" → suppressed findings appear with badge
4. Edit .ash.yaml → dashboard and findings update automatically
5. View historical scan → "Currently suppressed" badges on matching findings
6. Click Suppress button → disabled with tooltip
7. Set Fix/Defer on a suppressed finding → both states shown independently
