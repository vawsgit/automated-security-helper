# Data Model: Suppression Management View

**Branch**: `017-suppression-manager` | **Date**: 2026-03-20

## New Types

### SuppressionStatus

```typescript
export type SuppressionStatus = 'active' | 'unused' | 'expired';
```

Computed per rule:
- `'expired'` — `expiration` is non-null and in the past (`isExpired()` from ashYamlCore)
- `'active'` — not expired AND matchCount > 0
- `'unused'` — not expired AND matchCount === 0

When no scan data exists, status is not computable. The UI shows a "No scan data" indicator; the status field defaults to `'unused'` with matchCount 0.

### MatchedFindingRef

```typescript
export interface MatchedFindingRef {
  id: string;
  severity: string;
  title: string;
  file: string;
  line: number | null;
}
```

Lightweight reference to a finding matched by a suppression rule. Used for the expandable matched-findings list in each row. Fields are subset of `FindingRow` sufficient for display and navigation.

### SuppressionEntry

```typescript
export interface SuppressionEntry extends AshSuppression {
  status: SuppressionStatus;
  matchCount: number;
  matchedFindings: MatchedFindingRef[];
}
```

Extends the existing `AshSuppression` with computed enrichment. Produced by `AshYamlService.getSuppressionStatuses()`. Transmitted in the `suppressionsUpdate` message from extension host to webview.

### SuppressionWriteResult

```typescript
export interface SuppressionWriteResult {
  success: boolean;
  error?: string;
}
```

Result of management view write operations (add, edit, remove). Simpler than `SuppressionResult` (which carries `findingId` and `action` for the finding-driven flow).

## Existing Types (unchanged)

### AshSuppression (from Spec 013)

```typescript
export interface AshSuppression {
  path: string;
  reason: string;
  rule_id: string | null;
  line_start: number | null;
  line_end: number | null;
  expiration: string | null;
}
```

Identity: Full-field match via `findSuppressionIndex()`. No synthetic ID.

### AshIgnorePath (from Spec 013)

```typescript
export interface AshIgnorePath {
  path: string;
  reason: string;
  expiration: string | null;
}
```

Read-only display in the management view. Expiration check uses same `isExpired()` logic as suppressions.

### AshYamlConfigSummary (from Spec 015)

```typescript
export interface AshYamlConfigSummary {
  suppressionCount: number;
  ignorePathCount: number;
  severityThreshold: string;
  projectName: string | null;
  enabledScanners: string[];
}
```

Already includes all fields needed for the config info panel. No changes required.

## State Changes

### AppState additions (webview/src/App.tsx)

```typescript
interface AppState {
  // ... existing fields ...

  // Suppression Management View state (Spec 017)
  suppressions: SuppressionEntry[];
  ignorePaths: AshIgnorePath[];
  suppressionManagerConfig: AshYamlConfigSummary | null;
  editingSuppressionIndex: number | null;  // Index in suppressions[] of rule being edited
  addingNewSuppression: boolean;           // True when add form is open
}
```

Initial values: `suppressions: []`, `ignorePaths: []`, `suppressionManagerConfig: null`, `editingSuppressionIndex: null`, `addingNewSuppression: false`.

### ViewState extension

```typescript
type ViewState =
  | 'loading' | 'dashboard' | 'findingList' | 'findingDetail'
  | 'scanHistory' | 'scanDetail' | 'scanProgress' | 'empty'
  | 'suppressionManager';  // NEW
```

### Reducer Actions additions

```typescript
type AppAction =
  // ... existing actions ...
  | { type: 'OPEN_SUPPRESSION_EDIT'; index: number }
  | { type: 'CLOSE_SUPPRESSION_EDIT' }
  | { type: 'START_ADD_SUPPRESSION' }
  | { type: 'CANCEL_ADD_SUPPRESSION' };
```

Navigation to suppression manager uses existing `{ type: 'NAVIGATE'; view: 'suppressionManager' }`.

Data updates arrive via existing `{ type: 'MESSAGE'; payload: ExtToWebviewMessage }` with new `suppressionsUpdate` and `suppressionWriteResult` message types.

## Entity Relationships

```
AshYamlConfig (extension host, from .ash.yaml)
├── suppressions: AshSuppression[]  ──enriched──>  SuppressionEntry[]
│   └── matched against FindingRow[] from latest scan
│       └── produces MatchedFindingRef[] per rule
├── ignorePaths: AshIgnorePath[]    ──passed through──>  displayed read-only
└── config fields                   ──mapped to──>  AshYamlConfigSummary
```

## Validation Rules

| Field | Add/Edit Form | Rule |
|-------|--------------|------|
| path | Required | Non-empty string |
| reason | Required | Non-empty string (FR-013) |
| rule_id | Optional | Null means "any rule" |
| line_start | Optional | Positive integer, must have line_end if set |
| line_end | Optional | Positive integer >= line_start |
| expiration | Optional | Must be future date if provided (FR-023) |
