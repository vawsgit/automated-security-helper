# Contract: Message Protocol Extensions

**Feature**: 005-scan-execution-e2e
**Date**: 2026-03-16
**Files**: `vsix/src/models/messages.ts`, `webview/src/types/messages.ts`

## Extension Host → WebView (ExtToWebviewMessage)

### Existing types (no changes)

- `init` (3 variants: sidebar, editorPanel, sink)
- `stateUpdate` with `{ scans: ScanSummary[]; summary: DispositionSummary }`
- `findingsUpdate` with `{ scanId: string; findings: FindingRow[] }`
- `findingDetail` with `FindingRow`
- `dispositionUpdated` with `{ findingId: string; disposition: Disposition }`

### Modified type

- `scanStarted` — payload changes from `{ targetPath: string }` to `{ scanId: string; targetPath: string }`

### New type

- `scanProgress` with `{ scanId: string; elapsed: number; status: string }`

### Full updated type

```typescript
export type ExtToWebviewMessage =
  | { type: 'init'; payload: { context: 'sidebar' } }
  | { type: 'init'; payload: { context: 'editorPanel'; scanId: string } }
  | { type: 'init'; payload: { context: 'sink' } }
  | { type: 'stateUpdate'; payload: { scans: ScanSummary[]; summary: DispositionSummary } }
  | { type: 'findingsUpdate'; payload: { scanId: string; findings: FindingRow[] } }
  | { type: 'findingDetail'; payload: FindingRow }
  | { type: 'dispositionUpdated'; payload: { findingId: string; disposition: Disposition } }
  | { type: 'scanStarted'; payload: { scanId: string; targetPath: string } }
  | { type: 'scanProgress'; payload: { scanId: string; elapsed: number; status: string } };
```

## WebView → Extension Host (WebviewToExtMessage)

### Existing types (no changes)

- `requestState`
- `selectScan` with `{ scanId: string }`
- `selectFinding` with `{ findingId: string }`
- `setDisposition` with `{ findingId: string; disposition: Disposition }`
- `navigateToCode` with `{ filePath: string; startLine: number }`
- `startScan` with `{ targetPath: string }`
- `openFindings` with `{ scanId: string }`
- `openSink`

### New type

- `cancelScan` with `{ scanId: string }`

### Full updated type

```typescript
export type WebviewToExtMessage =
  | { type: 'requestState' }
  | { type: 'selectScan'; payload: { scanId: string } }
  | { type: 'selectFinding'; payload: { findingId: string } }
  | { type: 'setDisposition'; payload: { findingId: string; disposition: Disposition } }
  | { type: 'navigateToCode'; payload: { filePath: string; startLine: number } }
  | { type: 'startScan'; payload: { targetPath: string } }
  | { type: 'cancelScan'; payload: { scanId: string } }
  | { type: 'openFindings'; payload: { scanId: string } }
  | { type: 'openSink' };
```

## Sync Requirement

Both files MUST be identical in type definitions. When modifying one, always update the other to match.
