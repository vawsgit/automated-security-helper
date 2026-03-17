# Contract: Message Protocol Changes

## New Types

### FilterState (vsix/src/models/types.ts + webview/src/types/types.ts)

```typescript
export interface FilterState {
  severity?: Severity[];
  scanner?: string;
  disposition?: Disposition[];
  filePattern?: string;
}
```

Must be defined in both packages and kept in sync.

## WebviewToExtMessage Changes

### Add: applyFilters

```typescript
| { type: 'applyFilters'; payload: { scanId: string; filters: FilterState } }
```

**Sender**: WebView (when user changes filter controls)
**Handler**: `findingsPanelManager.ts` — calls `FindingsService.getFindings(scanId, filters)`, responds with `findingsUpdate`

Must be added to both `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`.

## ExtToWebviewMessage Changes

### Modify: stateUpdate

Current:
```typescript
| { type: 'stateUpdate'; payload: { scans: ScanSummary[]; summary: DispositionSummary } }
```

Updated:
```typescript
| { type: 'stateUpdate'; payload: { scans: ScanSummary[]; summary: DispositionSummary; scanTargets: ScanTarget[] } }
```

Must be updated in both packages.

## Unchanged Messages

All existing messages remain unchanged:
- `init`, `findingsUpdate`, `findingDetail`, `dispositionUpdated`, `scanStarted`, `scanProgress`
- `requestState`, `selectScan`, `selectFinding`, `setDisposition`, `navigateToCode`, `startScan`, `cancelScan`, `openFindings`, `openSink`

## Provider Handler Changes

### findingsPanelManager.ts

| Message | Current Handler | New Handler |
|---------|-----------------|-------------|
| `requestState` | Inline `db.finding.findMany` | Call `FindingsService.getFindings(scanId)` |
| `selectFinding` | Inline `db.finding.findUnique` | Keep as-is (single record lookup, not a service concern) |
| `setDisposition` | Inline `db.finding.update` | Keep update, add `stateUpdate` push after success |
| `applyFilters` | _(new)_ | Call `FindingsService.getFindings(scanId, filters)`, respond with `findingsUpdate` |

### sidebarWebviewProvider.ts

| Message | Current Handler | New Handler |
|---------|-----------------|-------------|
| `requestState` | Inline `queryStateAndPost()` | Call `FindingsService.getScanSummaries()`, `.getSummary()`, `.getScanTargets()`, post `stateUpdate` with all three |
