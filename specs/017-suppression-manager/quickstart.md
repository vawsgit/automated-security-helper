# Quickstart: Suppression Management View

**Branch**: `017-suppression-manager` | **Date**: 2026-03-20

## Prerequisites

- Specs 013 (.ash.yaml read) and 016 (.ash.yaml write) must be implemented and merged
- Node.js and npm installed
- VS Code ^1.110.0

## Development Setup

```bash
cd workbench

# Install dependencies for both packages
cd vsix && npm install && cd ..
cd webview && npm install && cd ..

# Start webview in watch mode (terminal 1)
cd webview && npm run dev

# Start extension in watch mode (terminal 2)
cd vsix && npm run watch
```

Press **F5** in VS Code to launch the Extension Development Host.

## Implementation Order

### Layer 1: Types & Messages (no behavior change)
1. Add `SuppressionStatus`, `MatchedFindingRef`, `SuppressionEntry`, `SuppressionWriteResult` to `vsix/src/models/types.ts`
2. Mirror types to `webview/src/types/types.ts`
3. Add new message types to `vsix/src/models/messages.ts`
4. Mirror messages to `webview/src/types/messages.ts`
5. Add `'suppressionManager'` to `ViewState` in `webview/src/App.tsx`

### Layer 2: Extension Host Services
6. Add `getSuppressionStatuses(findings)` to `AshYamlService`
7. Add `updateSuppression(old, updated)` to `AshYamlWriteService`
8. Add `removeSuppressionRule(suppression)` to `AshYamlWriteService`
9. Add `addSuppressionDirect(suppression)` to `AshYamlWriteService` (accepts raw `AshSuppression`)

### Layer 3: Extension Host Handlers
10. Add message handlers in `FindingsPanelManager` for `requestSuppressions`, `editSuppression`, `removeSuppression`, `addSuppression`
11. Add `showSuppressionManager()` method to `FindingsPanelManager`
12. Register `ashWorkbench.manageSuppressions` command in `package.json` and `extension.ts`

### Layer 4: WebView State & Navigation
13. Extend `AppState` with suppression management fields
14. Add reducer cases for `suppressionsUpdate`, `suppressionWriteResult`, and local UI actions
15. Add navigation entry points in `DashboardView` and `SidebarDashboard`
16. Add breadcrumb segment for suppression manager

### Layer 5: WebView Components
17. Build `SuppressionTable` (sortable, filterable, searchable list with expandable rows)
18. Build `SuppressionRuleForm` (add/edit form with validation)
19. Build `SuppressionManagerView` (composes summary header + table + ignore paths + config info)
20. Wire view into `App.tsx` render switch

### Layer 6: Kitchen Sink
21. Create `suppression-management-demo.tsx` with mock data
22. Register in `sink-registry.ts`

## Key Files

| File | Change |
|------|--------|
| `vsix/src/models/types.ts` | Add new types |
| `webview/src/types/types.ts` | Mirror new types |
| `vsix/src/models/messages.ts` | Add 6 message types |
| `webview/src/types/messages.ts` | Mirror messages |
| `vsix/src/services/ashYaml.ts` | Add `getSuppressionStatuses()` |
| `vsix/src/services/ashYamlWrite.ts` | Add `updateSuppression()`, `removeSuppressionRule()`, `addSuppressionDirect()` |
| `vsix/src/providers/findingsPanelManager.ts` | Add handlers + `showSuppressionManager()` |
| `vsix/package.json` | Register command |
| `vsix/src/extension.ts` | Wire command handler |
| `webview/src/App.tsx` | ViewState, AppState, reducer, render |
| `webview/src/components/SuppressionManagerView.tsx` | New component |
| `webview/src/components/SuppressionTable.tsx` | New component |
| `webview/src/components/SuppressionRuleForm.tsx` | New component |
| `webview/src/components/DashboardView.tsx` | Add navigation link |
| `webview/src/components/SidebarDashboard.tsx` | Add navigation link |
| `webview/src/pages/sink/suppression-management-demo.tsx` | New demo |
| `webview/src/pages/sink/sink-registry.ts` | Register demo |

## Verification

```bash
# Compile extension (catches type errors)
cd vsix && npm run compile

# Build webview (catches React/TS errors)
cd webview && npm run build

# Run extension tests
cd vsix && npm run test

# Visual check: open Kitchen Sink and verify suppression management demo
# F5 → Command Palette → "ASH: Open Kitchen Sink" → find "Suppression Management"
```
