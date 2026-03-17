# Contract: WebView Changes

## App.tsx Reducer Changes

### Initial State — Remove Mock Data

Replace:
```typescript
import { mockProject, mockScans, mockFindings, mockSummary, mockScanTargets, updateMockDisposition, updateMockNotes, recomputeScanTargets } from './mock-data';
```

With empty initial state:
```typescript
const initialState: AppState = {
  context: 'unknown',
  view: 'loading',           // Start in loading (was 'dashboard')
  viewHistory: [],
  project: { id: '', name: '', rootPath: '' },
  scanId: undefined,
  scans: [],
  summary: { total: 0, counts: { PENDING: 0, FIX: 0, SUPPRESS: 0, DEFER: 0 } },
  findings: [],
  selectedFinding: undefined,
  targetPath: undefined,
  scanElapsed: 0,
  scanStatus: '',
  scanTargets: [],
  selectedScanTargetId: undefined,
};
```

### stateUpdate Handler — Accept scanTargets

Current:
```typescript
case 'stateUpdate':
  return { ...state, scans: msg.payload.scans, summary: msg.payload.summary };
```

Updated:
```typescript
case 'stateUpdate':
  return {
    ...state,
    scans: msg.payload.scans,
    summary: msg.payload.summary,
    scanTargets: msg.payload.scanTargets,
    view: state.view === 'loading' ? 'dashboard' : state.view,
  };
```

Transitions from `loading` to `dashboard` on first `stateUpdate`. Subsequent updates preserve the current view.

### dispositionUpdated Handler — Remove Mock Helpers

Current (uses `updateMockDisposition` and `recomputeScanTargets`):
```typescript
case 'dispositionUpdated': {
  const findings = updateMockDisposition(state.findings, msg.payload.findingId, msg.payload.disposition);
  ...
  scanTargets: recomputeScanTargets(findings, state.scans),
}
```

Updated (simple in-place update, summary/scanTargets come from next `stateUpdate`):
```typescript
case 'dispositionUpdated': {
  const findings = state.findings.map(f =>
    f.id === msg.payload.findingId ? { ...f, disposition: msg.payload.disposition } : f
  );
  const selectedFinding = state.selectedFinding?.id === msg.payload.findingId
    ? { ...state.selectedFinding, disposition: msg.payload.disposition }
    : state.selectedFinding;
  return { ...state, findings, selectedFinding };
}
```

The extension host sends a follow-up `stateUpdate` with refreshed summary and scanTargets.

### SET_DISPOSITION Action — Remove Mock Helpers

Same pattern: replace `updateMockDisposition` / `recomputeScanTargets` with simple `.map()`. The WebView sends `setDisposition` to the extension host and updates local state optimistically. The extension host confirms with `dispositionUpdated` + `stateUpdate`.

### SET_NOTES Action — Remove Mock Helper

Replace `updateMockNotes` with simple `.map()`:
```typescript
case 'SET_NOTES': {
  const findings = state.findings.map(f =>
    f.id === action.findingId ? { ...f, notes: action.notes } : f
  );
  ...
}
```

### recomputeSummary — Keep as Optimistic Update Helper

The `recomputeSummary()` function can remain for optimistic local updates. The authoritative summary comes from the extension host via `stateUpdate`.

## mock-data.ts — Keep for Kitchen Sink Only

The file is NOT deleted. It remains available for Kitchen Sink demos (`pages/sink/`). It is simply no longer imported by `App.tsx`.
