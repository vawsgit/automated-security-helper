# Data Model: .ash.yaml Write & Suppress Action

**Feature**: Spec 016 — .ash.yaml Write & Suppress Action
**Date**: 2026-03-20

## Overview

No database schema changes. All changes are to view types, message types, and a new service. The suppression write operation targets the `.ash.yaml` file on disk, not the database.

## New Types

### SuppressionInput (webview → extension host)

User's choices when creating a suppression. Sent as the payload of the `suppressFinding` message.

```typescript
// Location: vsix/src/models/types.ts + webview/src/types/types.ts (mirrored)

export type SuppressionScope = 'file_rule' | 'rule_everywhere' | 'file_all_rules';

export interface SuppressionInput {
  findingId: string;            // Finding being suppressed
  filePath: string;             // Finding's file path (from FindingRow)
  ruleId: string;               // Finding's rule ID (from FindingRow)
  scope: SuppressionScope;      // Scope preset selection
  justification: string;        // Non-empty reason text (FR-002)
  includeLineRange: boolean;    // Whether to include line constraints
  startLine: number | null;     // Line start (from FindingRow, if includeLineRange)
  endLine: number | null;       // Line end (from FindingRow, if includeLineRange)
  expiration: string | null;    // ISO date "YYYY-MM-DD" or null (permanent)
}
```

### SuppressionScope → AshSuppression Mapping

| Scope | path | rule_id |
|-------|------|---------|
| `file_rule` | Finding's `filePath` | Finding's `ruleId` |
| `rule_everywhere` | `"**"` | Finding's `ruleId` |
| `file_all_rules` | Finding's `filePath` | `null` |

Line range fields (`line_start`, `line_end`) are included only when `includeLineRange === true`.

### SuppressionResult (extension host → webview)

```typescript
// Location: vsix/src/models/types.ts + webview/src/types/types.ts (mirrored)

export interface SuppressionResult {
  success: boolean;
  findingId: string;
  action: 'suppress' | 'unsuppress';
  error?: string;               // Present only when success === false
}
```

## Modified Types

### FindingRow — No Changes

The existing `FindingRow` type (Spec 015) already has all fields needed:
- `isCurrentlySuppressed: boolean` — drives suppress/unsuppress action visibility
- `suppressionSource: 'ash_yaml' | null` — identifies suppression source
- `suppression: SuppressionData | null` — contains justification and YAML entry for unsuppress matching
- `notes: string` — pre-populates justification (FR-017)

### Message Protocol Extensions

```typescript
// Location: vsix/src/models/messages.ts + webview/src/types/messages.ts (mirrored)

// Add to ExtToWebviewMessage union:
| { type: 'suppressionResult'; payload: SuppressionResult }

// Add to WebviewToExtMessage union:
| { type: 'suppressFinding'; payload: SuppressionInput }
| { type: 'unsuppressFinding'; payload: { findingId: string } }
```

## New Service

### AshYamlWriteService

```typescript
// Location: vsix/src/services/ashYamlWrite.ts

export class AshYamlWriteService {
  constructor(
    private scanRoot: string,
    private ashYamlService: AshYamlService,  // For re-reading config
  ) {}

  /**
   * Write a suppression entry to .ash.yaml.
   * - Validates the file is parseable (FR-011)
   * - Re-reads before writing (FR-010)
   * - Creates file if missing (FR-008)
   * - Preserves existing content (FR-009) via text append
   */
  async addSuppression(input: SuppressionInput): Promise<SuppressionResult>;

  /**
   * Remove a suppression entry from .ash.yaml.
   * - Re-reads before writing (FR-010)
   * - Matches entry by field comparison
   * - Re-serializes suppressions array via js-yaml.dump()
   */
  async removeSuppression(findingId: string): Promise<SuppressionResult>;

  /** Update scan root when setting changes */
  setScanRoot(newRoot: string): void;
}
```

### Key Helper Functions (pure, testable)

```typescript
// Location: vsix/src/services/ashYamlWrite.ts (private/exported for tests)

/** Convert SuppressionInput to AshSuppression */
export function inputToSuppression(input: SuppressionInput): AshSuppression;

/** Serialize AshSuppression to YAML text for appending */
export function serializeSuppressionEntry(s: AshSuppression, indent: number): string;

/** Find the index of a matching suppression in the array */
export function findSuppressionIndex(
  suppressions: AshSuppression[],
  target: AshSuppression,
): number;

/** Generate a minimal .ash.yaml skeleton with one suppression entry */
export function generateSkeleton(entry: AshSuppression): string;

/** Re-serialize the global_settings.suppressions section after removal */
export function reserializeSuppressionsSection(
  fileContent: string,
  updatedSuppressions: AshSuppression[],
): string;
```

## State Changes (WebView)

### AppState Additions

```typescript
// Location: webview/src/App.tsx (in AppState type)

// New fields:
suppressionFormFindingId: string | null;  // Finding ID for open form (null = closed)
suppressionPending: boolean;               // True while waiting for suppressionResult
```

### New Reducer Actions

```typescript
// New action types in reducer:
| { type: 'OPEN_SUPPRESSION_FORM'; findingId: string }
| { type: 'CLOSE_SUPPRESSION_FORM' }
| { type: 'suppressionResult'; payload: SuppressionResult }
```

## Entity Relationship

```
FindingRow (webview state)
  ├── isCurrentlySuppressed: boolean  ──→  drives Suppress/Unsuppress button visibility
  ├── suppression: SuppressionData    ──→  pre-populates form (justification) + identifies entry for removal
  └── notes: string                   ──→  pre-populates justification (FR-017)

SuppressionInput (webview → ext)
  └── maps to → AshSuppression (written to .ash.yaml)

.ash.yaml file (on disk)
  └── watched by AshYamlService (Spec 013)
       └── triggers currentFindingsUpdate (Spec 015) ──→ auto-refreshes UI
```

## Validation Rules

| Field | Rule | Error |
|-------|------|-------|
| `justification` | Non-empty, trimmed length > 0 | "Justification is required" |
| `expiration` | If present, must be future date in YYYY-MM-DD format | "Expiration must be a future date" |
| `filePath` | Must be non-empty | Internal error (should never happen) |
| `ruleId` | Must be non-empty when scope is `file_rule` or `rule_everywhere` | Internal error (should never happen) |
