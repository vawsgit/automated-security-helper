# Data Model: Scan Execution End-to-End

**Feature**: 005-scan-execution-e2e
**Date**: 2026-03-16

## Overview

This feature does not introduce new database entities. It wires existing entities (Scan, Finding, ScanTarget from Spec 004) to the UI layer. The key data model contribution is the **mapping layer** between Prisma models and WebView view types, and the **message protocol extensions**.

## Entity Mappings

### Prisma Scan → ScanSummary (View Type)

| Prisma Field | View Field | Transform |
|-------------|------------|-----------|
| `id` | `id` | Direct |
| `projectId` | `projectId` | Direct |
| `scanTargetId` | `scanTargetId` | Direct |
| `status` | `status` | Direct (same enum values) |
| `startedAt` | `startedAt` | `.toISOString()` |
| `completedAt` | `completedAt` | `.toISOString()` or `undefined` |
| `sourceDir` | `sourceDirectory` | Direct (field rename) |
| `findingsCount` | `findingCount` | Direct (field rename) |
| `severityBreakdown` | `severityCounts` | Cast `Record<string, number>` → `Record<Severity, number>`, fill missing keys with 0 |

### Prisma Finding → FindingRow (View Type)

| Prisma Field | View Field | Transform |
|-------------|------------|-----------|
| `id` | `id` | Direct |
| `scanId` | `scanId` | Direct |
| `scanTargetId` | `scanTargetId` | Direct |
| `title` | `title` | Direct |
| `description` | `description` | Direct |
| `severity` | `severity` | Direct |
| `disposition` | `disposition` | Default `'PENDING'` (field not yet in Prisma schema) |
| `scanner` | `scanner` | Direct |
| `ruleId` | `ruleId` | Direct |
| `file` | `filePath` | Direct (field rename) |
| `startLine` | `startLine` | Direct |
| `endLine` | `endLine` | Direct |
| `snippet` | `codeSnippet` | Direct (field rename), default `''` if null |
| `createdAt` | `firstDetectedAt` | `.toISOString()` |
| N/A | `notes` | Default `''` (not yet in schema) |
| N/A | `aiAnalysis` | Default `null` (future feature) |
| N/A | `suppression` | Default `null` (future feature) |

## Message Protocol Extensions

### New: scanProgress (Extension → WebView)

```
{ type: 'scanProgress'; payload: { scanId: string; elapsed: number; status: string } }
```

- `scanId`: The ID of the currently running scan
- `elapsed`: Seconds since scan started
- `status`: Status text (e.g., "Scanning...")

### New: cancelScan (WebView → Extension)

```
{ type: 'cancelScan'; payload: { scanId: string } }
```

- `scanId`: The ID of the scan to cancel

### Modified: scanStarted (Extension → WebView)

```
{ type: 'scanStarted'; payload: { scanId: string; targetPath: string } }
```

- Added `scanId` field to existing payload (was previously `{ targetPath: string }` only)

## DispositionSummary Computation

The sidebar needs a `DispositionSummary` computed from the database. Since the `disposition` field is not yet in the Prisma Finding schema, the initial implementation will return a default summary with all counts at 0 and total equal to total finding count. This will be properly computed once the disposition field is added to the schema in a future spec.
