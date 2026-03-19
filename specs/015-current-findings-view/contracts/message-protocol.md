# Message Protocol Contract: Current Findings

**Branch**: `015-current-findings-view` | **Date**: 2026-03-19

## New Extension → WebView Messages

### currentFindingsUpdate

Sent when current findings are computed or recomputed (initial load, .ash.yaml change, scan root change).

```typescript
{
  type: 'currentFindingsUpdate';
  payload: {
    findings: FindingRow[];           // All findings from latest scan, with suppression overlay
    suppressionSummary: SuppressionSummary;  // Aggregate counts
    scanId: string;                   // ID of the latest completed scan
    lastScannedAt: string;            // ISO timestamp of latest scan completion
  };
}
```

**Trigger points**:
1. FindingsPanelManager handles `requestState` (initial panel load)
2. SidebarWebviewProvider handles `requestState` (initial sidebar load)
3. AshYamlService emits `onDidChangeConfig` (file watcher)
4. Scan root setting changes
5. New scan completes

### ashYamlChanged

Sent when .ash.yaml file changes. Informational — UI may use this for status display.

```typescript
{
  type: 'ashYamlChanged';
  payload: {
    config: AshYamlConfigSummary;
  };
}
```

**Trigger points**:
1. AshYamlService emits `onDidChangeConfig`

## New WebView → Extension Messages

### requestCurrentFindings

Explicit request to recompute and send current findings.

```typescript
{
  type: 'requestCurrentFindings';
}
```

**Response**: Extension sends `currentFindingsUpdate`.

## Modified Messages

### stateUpdate (Extension → WebView)

No structural change. The sidebar continues to receive `stateUpdate` for scan list and targets. Additionally receives `currentFindingsUpdate` for the current findings summary.

### findingsUpdate (Extension → WebView)

No change. Continues to be used for scan-specific views (historical scans). When loading a historical scan, findings now include `isCurrentlySuppressed` and `suppressionSource` overlay fields.

## Message Flow Diagrams

### Initial Panel Load

```
WebView                    Extension Host
  |-- requestState ----------->|
  |                            |-- query latest scan
  |                            |-- batch match suppressions
  |<-- currentFindingsUpdate --|
  |<-- stateUpdate ------------|
```

### .ash.yaml File Change

```
File System                Extension Host              WebView
  |-- file change ----------->|                           |
  |                           |-- debounce (200ms)        |
  |                           |-- recompute suppressions  |
  |                           |-- currentFindingsUpdate ->|
  |                           |-- stateUpdate ----------->| (sidebar)
```

### Historical Scan Selection

```
WebView                    Extension Host
  |-- selectScan { scanId } -->|
  |                            |-- query scan findings
  |                            |-- overlay current suppression
  |<-- findingsUpdate ---------|  (with isCurrentlySuppressed)
```

### Toggle Show Suppressed

```
WebView (local only, no message to extension)
  dispatch(TOGGLE_SHOW_SUPPRESSED)
  → filter currentFindings by isCurrentlySuppressed
  → re-render findings list
```

## Type Definitions

```typescript
// New types added to both vsix/src/models/types.ts and webview/src/types/types.ts

interface SuppressionSummary {
  total: number;
  suppressed: number;
  active: number;
}

interface AshYamlConfigSummary {
  suppressionCount: number;
  ignorePathCount: number;
  severityThreshold: string;
  projectName: string | null;
  enabledScanners: string[];
}
```

## Updated Discriminated Unions

### ExtToWebviewMessage

```typescript
export type ExtToWebviewMessage =
  // ... existing variants ...
  | { type: 'currentFindingsUpdate'; payload: { findings: FindingRow[]; suppressionSummary: SuppressionSummary; scanId: string; lastScannedAt: string } }
  | { type: 'ashYamlChanged'; payload: { config: AshYamlConfigSummary } };
```

### WebviewToExtMessage

```typescript
export type WebviewToExtMessage =
  // ... existing variants ...
  | { type: 'requestCurrentFindings' };
```
