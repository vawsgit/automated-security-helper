---
title: Planned Implementation Specs
---

# Planned Implementation Specs

Ordered sequence of atomic, verifiable specs that build the ASH Workbench from its
current mock state to a fully functional extension. Each spec is designed to be fed
to `speckit.specify` and then implemented via `speckit.implement`.

## Current State Summary

The extension host (`vsix/src/`) has a working shell:

- `extension.ts` activates, registers commands, tree view, sidebar, and editor panel
- `FindingsPanelManager` creates editor WebView panels and handles the message bridge
- `SidebarWebviewProvider` handles the sidebar context
- `ScanTreeProvider` shows mock scan history in a native tree view
- `scanCommands.ts` registers start/cancel/folder scan commands (all mock)
- `mock/data.ts` provides hardcoded Project, Scans, Findings, and helper functions
- `models/types.ts` and `models/messages.ts` define the typed message protocol
- `providers/webviewHtml.ts` generates CSP-compliant HTML that loads the WebView build

The WebView (`webview/src/`) is a complete interactive mock:

- 8 view states: dashboard, findingList, findingDetail, scanHistory, scanDetail,
  scanProgress, empty, loading
- `useReducer` state machine in `App.tsx` with `MESSAGE` action type for extension
  host messages (currently triggered only when real messages arrive)
- All views, components, and navigation working against `mock-data.ts`
- Message protocol types in `types/messages.ts` (manual copy of `vsix/src/models/messages.ts`)
- ShadCN/ui component library with Kitchen Sink demos

**What does NOT exist yet**: database layer, Prisma schema, SARIF parser,
scanner service (ASH CLI integration), real data queries, settings/admin features,
application lifecycle management.

---

## Spec Inventory

| # | Spec Name | Phase | Dependencies | Key Deliverable |
|---|-----------|-------|--------------|-----------------|
| 1 | Database Layer & Schema | Foundation | None | PGLite + Prisma + migration runner |
| 2 | SARIF Parser | Foundation | None | `parseSarif()` with unit tests |
| 3 | Project Lifecycle & Activation | Foundation | Spec 1 | Auto-create project on activation |
| 4 | Scanner Service | Scan Execution | Spec 1, 2 | ASH CLI spawn, SARIF parse, finding storage |
| 5 | Scan Execution End-to-End | Scan Execution | Spec 3, 4 | startScan message to findings in DB |
| 6 | Finding Queries, Filters & Summary | Finding Display | Spec 1, 5 | Real DB queries replace mock data |
| 7 | Finding Detail & Code Navigation | Finding Display | Spec 6 | Detail from DB, click-to-open at line |
| 8 | Finding Triage | Triage & Polish | Spec 6 | Disposition persistence in DB |
| 9 | Scan History & Management | Triage & Polish | Spec 5, 6 | Real scan list, delete with cascade, tree refresh |
| 10 | Settings, Admin & Application Lifecycle | Triage & Polish | Spec 1, 3 | Config properties, reset, migration upgrade |

---

## Spec 1: Database Layer & Schema

**Phase**: Foundation
**Dependencies**: None
**Risk**: PGLite + Prisma is unproven in VS Code extensions (see technical design Section 4.2)

### What It Builds

The in-process database layer using PGLite (WASM PostgreSQL) with Prisma ORM.
This is the persistence foundation for every subsequent spec.

### Implementation Scope

**New files to create:**

- `vsix/prisma/schema.prisma` -- Prisma schema defining Project, ScanTarget, Scan,
  Finding entities with enums (ScanStatus, Severity, Disposition) and indexes. Must
  enable `driverAdapters` preview feature. See technical design Section 4.1 for the
  exact schema.
- `vsix/src/services/database.ts` -- `DatabaseService` class that:
  - Initializes PGLite with filesystem persistence at `context.globalStorageUri`
  - Runs raw SQL migrations directly via `pglite.exec()` (bypasses Prisma's
    migration engine which requires a network-accessible database)
  - Tracks applied migrations in an `_ash_migrations` table
  - Creates and exposes a `PrismaClient` with the PGLite driver adapter
  - Provides `initialize(storageUri)` and `close()` static methods
  - See technical design Sections 3.4 and 4.3 for the implementation pattern

**New dependencies to add to `vsix/package.json`:**

- `@prisma/client` (production dependency)
- `prisma` (dev dependency)
- `prisma-pglite` (production -- provides the adapter; `@electric-sql/pglite`
  already in devDependencies, move to production)

**Tests to create:**

- `vsix/src/test/unit/database.test.ts` -- Unit tests using PGLite in-memory mode:
  - Initialize database and verify migration runs
  - Create a Project and retrieve by `rootPath`
  - Create a Scan with findings, verify cascade delete
  - Verify index performance (scan ordering, finding queries)
  - The existing `vsix/src/test/unit/pglite.smoke.test.ts` can be expanded or
    replaced

**Key constraints from constitution:**

- Database MUST run in-process as WASM (Principle I)
- All persistent data MUST live in `context.globalStorageUri` (Principle I)
- TypeScript strict mode (Quality conventions)
- No `any` types in production code (Principle IV)

### Acceptance Criteria

1. `DatabaseService.initialize()` creates a PGLite instance and applies all
   Prisma-generated migrations
2. Prisma client can CRUD all four entities (Project, ScanTarget, Scan, Finding)
3. Finding cascade delete works when a Scan is deleted
4. Migrations are idempotent (running twice does not error)
5. In-memory PGLite tests pass in under 5 seconds
6. `DatabaseService.close()` cleanly shuts down PGLite

### Fallback

If PGLite + Prisma integration fails within the spike, switch to SQLite via
`better-sqlite3` as documented in technical design Section 4.4. The switch affects
only this spec's files.

### References

- Technical design Section 4 (entire Database Layer section)
- Technical design Section 3.4 (`services/database.ts` code sample)
- Constitution Principle I (in-process, `globalStorageUri`)
- Constitution Principle IV (typed contracts, Prisma ORM)
- `vsix/src/test/unit/pglite.smoke.test.ts` (existing smoke test)

---

## Spec 2: SARIF Parser

**Phase**: Foundation
**Dependencies**: None (pure function, no database or VS Code APIs)

### What It Builds

A standalone SARIF 2.1.0 parser that converts ASH CLI output into typed Finding
records. This is the most critical correctness component -- it determines whether
findings are accurately extracted.

### Implementation Scope

**New files to create:**

- `vsix/src/services/sarif.ts` -- The parser module containing:
  - `parseSarif(sarifJson: SarifLog, sourceDir: string): ParsedFinding[]` --
    Main entry point. Iterates `runs[].results[]`, maps each to a `ParsedFinding`
  - `extractSeverity(result, run)` -- Checks `result.properties.severity` or
    `result.properties['ash/severity']` first (ASH-specific), falls back to SARIF
    `level` mapping (`error` to HIGH, `warning` to MEDIUM, `note` to LOW,
    `none` to INFO).
    See technical design Section 5.3 for the severity mapping table and code sample
  - `normalizeFilePath(uri: string, sourceDir: string)` -- Strips `file://` prefix,
    makes path relative to `sourceDir`
  - `deduplicateFindings(findings: ParsedFinding[])` -- Groups by `(ruleId, file)`,
    merges line ranges (min startLine, max endLine), keeps most detailed description,
    concatenates scanner names
  - SARIF type definitions: `SarifLog`, `SarifRun`, `SarifResult` (extend the
    existing `vsix/src/test/fixtures/sarif-factory.ts` types or import from them)
  - `ParsedFinding` interface: intermediate type before database storage (no `id`,
    no `scanId`, no `projectId` -- those are added when storing)

**Existing files to modify:**

- `vsix/src/test/fixtures/sarif-factory.ts` -- May need to add factory functions
  for ASH-specific properties, multi-run SARIF, edge cases

**Tests to create (P0 priority per technical design Section 9.2):**

- `vsix/src/test/unit/sarif.test.ts`:
  - Extracts findings from multi-run SARIF (multiple scanners in one file)
  - Maps severity correctly from ASH properties when present
  - Falls back to SARIF level mapping when no ASH properties
  - Deduplicates findings by `(ruleId, file)` composite key
  - Merges line ranges correctly during deduplication
  - Makes file paths relative to source directory
  - Strips `file://` prefix from artifact URIs
  - Handles missing optional fields gracefully (no region, no snippet, no endLine)
  - Handles empty results array (clean scan)
  - Extracts scanner name from `run.tool.driver.name`
  - Extracts title from `run.tool.driver.rules[].shortDescription` when available
  - Test data should cover all 8 ASH scanners: bandit, checkov, semgrep, cdk-nag,
    cfn-nag, detect-secrets, grype, npm-audit

### Key Design Decisions

- The parser is a **pure function** with no side effects -- it takes JSON in and
  returns typed objects out. No database, no VS Code APIs.
- `ParsedFinding` is an intermediate type, not `FindingRow`. The database storage
  step (Spec 4) adds `id`, `scanId`, `projectId`.
- The parser must handle SARIF from any ASH version defensively (optional fields,
  missing properties bags).

### Acceptance Criteria

1. `parseSarif()` correctly extracts findings from a multi-scanner SARIF log
2. Severity mapping prioritizes ASH `properties` over SARIF `level`
3. Deduplication produces one finding per `(ruleId, file)` pair
4. All file paths in output are relative (no absolute paths, no `file://` prefix)
5. Missing optional fields (snippet, endLine, region) do not throw
6. Empty SARIF (no results) returns empty array
7. All unit tests pass

### References

- Technical design Section 3.3 (`services/sarif.ts` code sample and SARIF types)
- Technical design Section 5.3 (SARIF mapping table)
- Technical design Section 5.2 (ASH output structure)
- Technical design Section 9.2 (SARIF parser test specifications)
- `vsix/src/test/fixtures/sarif-factory.ts` (existing test factory)
- Functional design Section 4.2 (SARIF parsing behavior)
- ASH CLI exit codes: 0=clean, 1=error, 2=findings (technical design Section 5.1)

---

## Spec 3: Project Lifecycle & Activation

**Phase**: Foundation
**Dependencies**: Spec 1 (Database Layer)

### What It Builds

Automatic project creation on extension activation. When the extension activates,
it ensures a Project record exists for the current workspace folder. This is the
entry point for all user data.

### Implementation Scope

**New files to create:**

- `vsix/src/services/project.ts` -- `ProjectService` class with:
  - `ensureProject(db: PrismaClient, workspaceFolders)` -- Queries for existing
    project by `rootPath`. If none found, creates one with the workspace folder
    name as default project name. Returns the Project record.
  - Called from `extension.ts` `activate()` after database initialization

**Existing files to modify:**

- `vsix/src/extension.ts` -- Update `activate()` to:
  1. Initialize `DatabaseService` with `context.globalStorageUri` (from Spec 1)
  2. Call `ensureProject()` to get/create project
  3. Pass `db` and `project` to existing providers and command registrations
  4. Push `DatabaseService` close to `context.subscriptions` via a disposable
  5. Handle errors: if database init fails, show error and do not activate
  6. This replaces the current direct registration pattern -- providers need the
     database client and project reference

- `vsix/src/providers/findingsPanelManager.ts` -- Accept `db: PrismaClient` and
  `project: Project` in constructor (or setter). Do NOT replace mock data yet
  (that's Spec 6) -- just accept the dependencies.

- `vsix/src/providers/sidebarWebviewProvider.ts` -- Same: accept `db` and `project`.

- `vsix/src/providers/scanTreeProvider.ts` -- Same: accept `db` and `project`.

### Acceptance Criteria

1. On first activation with a workspace open, a Project record is created in the
   database with the workspace folder name and path
2. On subsequent activations, the existing Project is retrieved (no duplicate)
3. If no workspace folder is open, extension shows an informational message
   (graceful degradation, not an error)
4. Database close is registered as a disposable on `context.subscriptions`
5. If database initialization fails, an error message is shown and the extension
   does not crash

### References

- Technical design Section 3.1 (`extension.ts` code sample)
- Functional design Section 4.1 (Project Management behavior)
- Functional design Section 7.1 (First Run interaction flow)
- Constitution Principle I (every disposable pushed to `context.subscriptions`)
- `vsix/src/extension.ts` (current activation code to modify)

---

## Spec 4: Scanner Service

**Phase**: Scan Execution
**Dependencies**: Spec 1 (Database), Spec 2 (SARIF Parser)

### What It Builds

The service that spawns the ASH CLI as a child process, monitors its lifecycle,
parses output, and stores findings in the database.

### Implementation Scope

**New files to create:**

- `vsix/src/services/scanner.ts` -- `ScannerService` class with:
  - Constructor accepts `PrismaClient` and `projectId`
  - `startScan(params: { targetPath, severityThreshold? })` -- Finds or creates a
    ScanTarget for the given `targetPath`, creates a Scan record in DB (status:
    RUNNING) linked to that ScanTarget, spawns ASH CLI child process. Returns
    `scanId`.
    - ASH invocation: `ash --source-dir <abs-path> --output-dir <temp-dir>
      --output-formats sarif --color false --progress`
    - `ashPath` and `ashMode` read from VS Code configuration
      (`ashWorkbench.ashPath`, `ashWorkbench.ashMode`)
    - Temp output dir created via `fs.mkdtemp()` under extension storage path
    - See technical design Section 3.2 and Section 5.1 for invocation details
  - `cancelScan(scanId: string)` -- Sends `SIGTERM` to the running process,
    updates Scan status to CANCELLED, cleans up temp directory
  - Process lifecycle handling:
    - Exit code 0: clean scan, parse SARIF (should have empty results)
    - Exit code 2: findings found, parse SARIF from
      `<outputDir>/reports/ash.sarif`
    - Exit code 1: error, update Scan status to FAILED with stderr as
      `errorMessage`
    - `ENOENT` spawn error: ASH not installed, show helpful message
  - On successful parse: call `parseSarif()` (from Spec 2), store Finding records
    in DB, update Scan with status COMPLETED, `findingsCount`, `severityBreakdown`
  - Progress callback: emits status updates (elapsed time, status text) for the
    WebView to display
  - Timeout: configurable via `ashWorkbench.scanTimeout` setting (default 600s),
    kills process on expiry
  - One scan at a time per project (constraint from functional design Section 4.2)
  - Dependency injection of spawn function for testability (as documented in
    constitution: `SpawnFn` injection, sinon cannot stub `child_process.spawn`
    under Node16 modules)

**Tests to create:**

- `vsix/src/test/unit/scanner.test.ts` -- Unit tests with mocked child process:
  - Successful scan (exit code 2) creates Scan and Finding records
  - Clean scan (exit code 0) creates Scan with zero findings
  - Failed scan (exit code 1) creates Scan with FAILED status and error message
  - Cancel scan sends SIGTERM and marks CANCELLED
  - ASH not installed (ENOENT) produces meaningful error
  - Timeout kills process and marks FAILED
  - Existing `vsix/src/test/unit/scanner-mock.smoke.test.ts` can be expanded

### Acceptance Criteria

1. `startScan()` creates a RUNNING Scan record and spawns ASH CLI
2. On exit code 2, SARIF is parsed and findings are stored in the database
3. On exit code 0, Scan is marked COMPLETED with zero findings
4. On exit code 1, Scan is marked FAILED with `errorMessage` from stderr
5. `cancelScan()` kills the process and marks Scan as CANCELLED
6. ENOENT error shows a user-friendly message about installing ASH
7. Only one scan runs at a time per project
8. Temp output directory is cleaned up after parsing

### References

- Technical design Section 3.2 (`services/scanner.ts` code samples)
- Technical design Section 5 (entire ASH CLI Integration section)
- Technical design Section 5.1 (CLI flags, exit codes, invocation pattern)
- Technical design Section 5.4 (error handling table)
- Technical design Section 5.5 (progress reporting)
- Functional design Section 4.2 (Scan Execution behavior)
- Constitution testing conventions (SpawnFn injection, sinon mocking)
- `vsix/src/test/unit/scanner-mock.smoke.test.ts` (existing smoke test)

---

## Spec 5: Scan Execution End-to-End

**Phase**: Scan Execution
**Dependencies**: Spec 3 (Project Lifecycle), Spec 4 (Scanner Service)

### What It Builds

The end-to-end scan flow: user clicks "Run Scan" in the WebView or command palette,
the extension spawns ASH, reports progress, parses results, stores findings, and
pushes updated state back to the WebView.

### Implementation Scope

**Existing files to modify:**

- `vsix/src/commands/scanCommands.ts` -- Replace mock implementations:
  - `ashWorkbench.startScan` command: open scan target picker dialog (shows existing
    targets, workspace root, custom path), call `ScannerService.startScan()` with
    `targetPath`, send `scanStarted` message to WebView
  - `ashWorkbench.cancelScan` command: call `ScannerService.cancelScan()`
  - `ashWorkbench.scanFolder` command: use folder URI from context menu, call
    `ScannerService.startScan()` with that path
  - Commands need access to the `ScannerService`, `FindingsPanelManager`, and
    `ScanTreeProvider` to push updates

- `vsix/src/providers/findingsPanelManager.ts` -- Wire `startScan` message handler:
  - On `startScan` message from WebView: call `ScannerService.startScan()`,
    send `scanStarted` to WebView
  - On `cancelScan` message (new message type to add): call
    `ScannerService.cancelScan()`
  - Register a progress callback on the `ScannerService` to push `scanProgress`
    messages to the WebView during scan (elapsed time, status text)
  - On scan completion: push `stateUpdate` (updated scan list and summary) and
    `findingsUpdate` (new findings) to WebView, refresh `ScanTreeProvider`

- `vsix/src/providers/sidebarWebviewProvider.ts` -- Wire `startScan` message:
  - On `startScan` message: call `ScannerService.startScan()` for the default
    target (workspace root)
  - Push `stateUpdate` on scan completion

- `vsix/src/providers/scanTreeProvider.ts` -- Add `refresh()` call after scan
  completion

- `vsix/src/models/messages.ts` -- Add new message types if needed:
  - `WebviewToExtMessage`: add `cancelScan` variant
  - `ExtToWebviewMessage`: add `scanProgress` variant with `{ scanId, status,
    elapsed }` payload (documented in functional design Section 5.3)
  - Keep both `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`
    in sync

- `webview/src/types/messages.ts` -- Mirror any new message types

- `webview/src/App.tsx` -- Add reducer handlers for new message types
  (`scanProgress`, `cancelScan`)

### Acceptance Criteria

1. Clicking "Run Scan" in the WebView triggers ASH CLI execution
2. The `ashWorkbench.startScan` command palette command works
3. Right-click "ASH: Run Security Scan" on a folder works
4. Scan progress is visible in the WebView during execution
5. On completion, the findings appear in the WebView
6. On completion, the scan tree view refreshes with the new scan
7. Cancel scan stops the ASH process
8. Sidebar "Scan Workspace" button triggers a scan

### References

- Functional design Section 4.2 (Scan Execution behavior)
- Functional design Section 7.2 (Run Scan interaction flow)
- Technical design Section 6.2 (WebView message handling code sample)
- Technical design Section 6.3 (message protocol types)
- `vsix/src/commands/scanCommands.ts` (existing mock commands to replace)
- `vsix/src/providers/findingsPanelManager.ts` (existing message handlers)
- `vsix/src/providers/sidebarWebviewProvider.ts` (existing sidebar handler)
- `webview/src/App.tsx` (reducer MESSAGE handler, lines 75-112)

---

## Spec 6: Finding Queries, Filters & Summary

**Phase**: Finding Display
**Dependencies**: Spec 1 (Database), Spec 5 (Scan Execution -- for real data)

### What It Builds

Replaces mock data functions with real database queries. When the WebView requests
state or selects a scan, the extension host queries the database and pushes real
finding data.

### Implementation Scope

**New files to create:**

- `vsix/src/services/findings.ts` -- `FindingsService` class with:
  - `getFindings(scanId: string, filters?: FilterState)` -- Query findings from
    DB with optional filters (severity, scanner, disposition, file pattern).
    Returns `FindingRow[]` shaped for the WebView.
  - `getSummary(projectId: string)` -- Compute disposition summary across all
    findings in the project. Returns `DispositionSummary`.
  - `getScanSummaries(projectId: string)` -- Query all scans for a project,
    ordered by `startedAt` DESC. Returns `ScanSummary[]`.
  - `getScanTargets(projectId: string)` -- Query ScanTarget records for the
    project, enriched with computed per-target finding counts, severity breakdown,
    and triage progress. Returns `ScanTarget[]`.
  - Map database entity shapes to the WebView `FindingRow` and `ScanSummary`
    interfaces defined in `vsix/src/models/types.ts`

**Existing files to modify:**

- `vsix/src/providers/findingsPanelManager.ts` -- Replace mock data calls:
  - `requestState` handler: call `FindingsService.getScanSummaries()` and
    `FindingsService.getSummary()` instead of `getMockScans()` / `getMockSummary()`
  - `selectScan` handler: call `FindingsService.getFindings(scanId)` instead of
    `getMockFindings()`
  - Add `applyFilters` message handler: call `FindingsService.getFindings()` with
    filter params, push `findingsUpdate` response

- `vsix/src/providers/sidebarWebviewProvider.ts` -- Replace mock data calls:
  - `requestState` handler: use real queries for scans and summary

- `vsix/src/models/messages.ts` -- Add `applyFilters` to `WebviewToExtMessage`
  if not already present. Define `FilterState` type: `{ severity?: Severity[],
  scanner?: string, disposition?: Disposition[], filePattern?: string }`

- `vsix/src/models/types.ts` -- Verify `FindingRow`, `ScanSummary`, `ScanTarget`,
  `DispositionSummary` interfaces match what the database queries produce. Reconcile
  any differences between the mock types and the Prisma schema:
  - `FindingRow.scanTargetId` -- direct FK on Finding to ScanTarget
  - `FindingRow.notes` -- add to Prisma schema if not present
  - `FindingRow.aiAnalysis` and `FindingRow.suppression` -- keep nullable, always
    null for POC
  - `FindingRow.title` -- map from Finding's `title` field (in Prisma schema)

### Acceptance Criteria

1. `requestState` pushes real scan list and summary from the database
2. Selecting a scan loads its findings from the database
3. Findings are correctly shaped as `FindingRow[]` for the WebView
4. Summary counts are accurate (total, per-disposition)
5. Scan targets are correctly queried from the database with computed counts
6. Mock data imports (`getMockFindings`, `getMockScans`, `getMockSummary`) are
   removed from `findingsPanelManager.ts` and `sidebarWebviewProvider.ts`
7. Filter queries work (by severity, scanner, disposition, file pattern)

### References

- Functional design Section 4.4 (Finding List behavior)
- Functional design Section 4.6 (Cumulative triage view)
- Functional design Section 5.3 (WebView communication protocol -- `findingList`,
  `scanList`, `summary` messages)
- Technical design Section 6.2 (`selectScan` handler code sample)
- `vsix/src/mock/data.ts` (mock functions being replaced)
- `vsix/src/models/types.ts` (WebView-facing type definitions)
- `webview/src/App.tsx` lines 86-101 (reducer MESSAGE cases for stateUpdate,
  findingsUpdate, dispositionUpdated)
- `docs/docs/working/webview/app-mock/ux-as-built.md` (scan target derivation
  pattern, data flow)

---

## Spec 7: Finding Detail & Code Navigation

**Phase**: Finding Display
**Dependencies**: Spec 6 (Finding Queries)

### What It Builds

Real finding detail loading from the database and working code navigation. When the
user clicks a finding, full details are loaded. Clicking a file path opens the file
in VS Code at the correct line.

### Implementation Scope

**Existing files to modify:**

- `vsix/src/services/findings.ts` (from Spec 6) -- Add:
  - `getFindingDetail(findingId: string)` -- Query a single finding with all fields.
    Returns `FindingRow` (full detail shape)

- `vsix/src/providers/findingsPanelManager.ts` -- Replace mock in `selectFinding`
  handler:
  - Call `FindingsService.getFindingDetail()` instead of `getMockFindingDetail()`
  - Push `findingDetail` message with real data
  - Code navigation (`navigateToCode`) already works -- it uses
    `vscode.window.showTextDocument` with a selection range. Update the file path
    to be relative to the project root: `path.join(project.rootPath, filePath)`.
    The current mock implementation already does this but with mock paths that
    won't exist. With real findings from SARIF, the paths will be real workspace
    files.

### Key Implementation Note

Code navigation is **already implemented** in `findingsPanelManager.ts` lines
92-108. It handles the `navigateToCode` message by creating a `vscode.Uri`,
checking if the file exists, and opening it with a selection range. The only change
needed is ensuring the file path is correctly resolved relative to the project root
(which it already does using the raw `filePath` from the message). With real SARIF
data, the paths will correspond to actual workspace files.

### Acceptance Criteria

1. Clicking a finding in the list loads full detail from the database
2. Finding detail includes all fields: severity, title, description, rule ID,
   scanner, file path, line range, code snippet, disposition
3. Clicking a file path in finding detail opens the file in VS Code editor
4. The editor cursor is positioned at the correct start line
5. If the file doesn't exist (e.g., file was deleted after scan), a helpful
   message is shown

### References

- Functional design Section 4.5 (Finding Detail behavior -- Tier 1, 2, 3)
- Functional design Section 7.4 (Navigate to Code interaction flow)
- Technical design Section 6.2 (`navigateToCode` handler code sample)
- `vsix/src/providers/findingsPanelManager.ts` lines 92-108 (existing
  code navigation implementation)
- `webview/src/components/FindingDetailView.tsx` (WebView detail component)

---

## Spec 8: Finding Triage

**Phase**: Triage & Polish
**Dependencies**: Spec 6 (Finding Queries -- for data flow)

### What It Builds

Real disposition persistence. When the user sets a disposition (Pending, Fix,
Suppress, Defer) on a finding, it is saved to the database and the summary is
recomputed.

### Implementation Scope

**Existing files to modify:**

- `vsix/src/services/findings.ts` (from Spec 6) -- Add:
  - `setDisposition(findingId: string, disposition: Disposition)` -- Update the
    finding's disposition in the database. Return the updated finding.
  - `setNotes(findingId: string, notes: string)` -- Update the finding's notes
    in the database. Return the updated finding. (The WebView mock has notes
    support via `TriageNotes` component; the database needs a `notes` text field
    on Finding.)

- `vsix/src/providers/findingsPanelManager.ts` -- Replace mock in `setDisposition`
  handler:
  - Call `FindingsService.setDisposition()` instead of mock `updateDisposition()`
  - After update: recompute summary via `FindingsService.getSummary()`, push both
    `dispositionUpdated` and `stateUpdate` (with updated summary) to WebView
  - Add `setNotes` message handler if not present

- `vsix/src/models/messages.ts` -- Add `setNotes` to `WebviewToExtMessage` if
  not already present: `{ type: 'setNotes'; payload: { findingId: string;
  notes: string } }`

- `webview/src/types/messages.ts` -- Mirror any new message types

### Key Design Decisions

- Disposition changes are immediate and persisted on every change (no save button)
- The disposition state machine is simple: any state can transition to any other
  state (see functional design Section 3.3 state diagram)
- Notes are plain text (500 char limit enforced in WebView `TriageNotes` component)
- `notes` field needs to be added to the Prisma schema's Finding model if not
  already there

### Acceptance Criteria

1. Setting a disposition on a finding persists it to the database
2. The finding list reflects the new disposition immediately
3. The summary bar updates counts after a disposition change
4. Disposition survives extension reload (persisted in DB)
5. Setting notes on a finding persists to the database
6. All four dispositions work: PENDING, FIX, SUPPRESS, DEFER

### References

- Functional design Section 4.6 (Finding Triage behavior)
- Functional design Section 3.3 (Disposition state machine)
- Functional design Section 7.3 (Triage a Finding interaction flow)
- `vsix/src/providers/findingsPanelManager.ts` lines 81-89 (existing mock
  disposition handler)
- `vsix/src/mock/data.ts` `updateDisposition()` (mock function being replaced)
- `webview/src/components/TriageControls.tsx` (disposition button group)
- `webview/src/components/TriageNotes.tsx` (notes textarea)
- `webview/src/App.tsx` lines 146-155 (reducer SET_DISPOSITION handler)

---

## Spec 9: Scan History & Management

**Phase**: Triage & Polish
**Dependencies**: Spec 5 (Scan Execution), Spec 6 (Finding Queries)

### What It Builds

Real scan history display and scan deletion. The sidebar tree view and WebView scan
history show real scans from the database. Users can delete completed scans with
cascade deletion of findings.

### Implementation Scope

**Existing files to modify:**

- `vsix/src/providers/scanTreeProvider.ts` -- Replace mock data:
  - Constructor accepts `PrismaClient` and `projectId`
  - `getChildren()` queries `db.scan.findMany()` ordered by `startedAt` DESC
    instead of calling `getMockScans()`
  - Tree items show real scan data (date, status, finding count, source directory)
  - `refresh()` re-fires the tree data changed event (already implemented)

- `vsix/src/services/findings.ts` (from Spec 6) -- Add:
  - `deleteScan(scanId: string)` -- Delete a scan and cascade delete its findings.
    The Prisma schema has `onDelete: Cascade` on the Finding to Scan relation, so
    deleting a Scan automatically removes its findings.

- `vsix/src/providers/findingsPanelManager.ts` -- Add `deleteScan` message handler:
  - Call `FindingsService.deleteScan()`
  - Push updated `stateUpdate` (new scan list + summary) to WebView
  - Call `ScanTreeProvider.refresh()` to update sidebar tree

- `vsix/src/models/messages.ts` -- Add `deleteScan` to `WebviewToExtMessage`:
  `{ type: 'deleteScan'; payload: { scanId: string } }`

- `webview/src/types/messages.ts` -- Mirror the new message type

- `webview/src/App.tsx` -- Add reducer handling for the `deleteScan` action and
  any response messages (the `stateUpdate` handler already exists and will
  update the scan list)

### Acceptance Criteria

1. Sidebar tree view shows real scans from the database
2. Scans are ordered most recent first
3. Tree items show correct status icons (check, error, circle-slash, sync~spin)
4. Clicking a tree item opens the findings panel for that scan
5. Deleting a scan removes it and its findings from the database
6. After deletion, tree view and WebView scan list update
7. WebView scan history page shows real scan data
8. `getMockScans()` import is removed from `scanTreeProvider.ts`

### References

- Functional design Section 4.3 (Scan History behavior)
- Technical design Section 3.6 (`scanTreeProvider.ts` code sample)
- Functional design Section 5.4 screen description (WebView scan list)
- `vsix/src/providers/scanTreeProvider.ts` (existing tree provider to modify)
- `webview/src/components/ScanHistoryView.tsx` (WebView scan history component)
- `webview/src/components/ScanDetailView.tsx` (WebView scan detail component)
- `webview/src/components/ScanCard.tsx` (scan card component)

---

## Spec 10: Settings, Admin & Application Lifecycle

**Phase**: Triage & Polish
**Dependencies**: Spec 1 (Database), Spec 3 (Project Lifecycle)

### What It Builds

VS Code configuration properties, application reset, migration upgrades on
activation, and application info display.

### Implementation Scope

**Existing files to modify:**

- `vsix/package.json` -- Add `contributes.configuration` section with all settings
  documented in functional design Section 4.7.1 and technical design Section 7:
  - `ashWorkbench.ashPath` (string, default `"ash"`)
  - `ashWorkbench.ashMode` (enum: `local`/`container`, default `"local"`)
  - `ashWorkbench.defaultSeverityThreshold` (enum: CRITICAL/HIGH/MEDIUM/LOW/INFO,
    default `"LOW"`)
  - `ashWorkbench.defaultSourceDir` (string, default `"."`)
  - `ashWorkbench.scanTimeout` (number, default `600`)
  - `ashWorkbench.llm.provider` (enum: `bedrock`, default `"bedrock"`)
  - `ashWorkbench.llm.region` (string, default `"us-east-1"`)
  - `ashWorkbench.llm.modelId` (string, default
    `"anthropic.claude-sonnet-4-20250514"`)

**New files to create:**

- `vsix/src/services/admin.ts` -- `AdminService` class with:
  - `getApplicationInfo(db, context)` -- Returns extension version (from
    `package.json`), database schema version (from `_ash_migrations` table),
    database stats (project count, scan count, finding count)
  - `resetApplication(db)` -- Drop and recreate all tables, reinitialize schema
    by running all migrations from scratch. Clear in-memory state.

**Existing files to modify:**

- `vsix/src/services/database.ts` (from Spec 1) -- Enhance migration runner:
  - On activation: read schema version, compare to expected, run pending
    migrations if behind
  - On migration failure: show error with retry/reset options
  - On fresh install: run all migrations, create meta table

- `vsix/src/commands/index.ts` -- Register new commands:
  - `ashWorkbench.resetApplication` -- Show confirmation dialog, call
    `AdminService.resetApplication()`, reload WebView

- `vsix/src/providers/findingsPanelManager.ts` -- Add message handlers:
  - `requestApplicationInfo` -- Call `AdminService.getApplicationInfo()`, push
    `applicationInfo` message to WebView
  - `resetApplication` -- Show VS Code confirmation dialog, call
    `AdminService.resetApplication()`, push `applicationReset` message

- `vsix/src/models/messages.ts` -- Add new message types:
  - `ExtToWebviewMessage`: `applicationInfo` (version, schema version, stats),
    `applicationReset` (empty)
  - `WebviewToExtMessage`: `requestApplicationInfo`, `resetApplication`

- `webview/src/types/messages.ts` -- Mirror new message types

### Acceptance Criteria

1. All configuration properties appear in VS Code Settings UI under "ASH Workbench"
2. `ashWorkbench.ashPath` is read by the scanner service when spawning ASH
3. Reset application deletes all data and reinitializes the database
4. Reset shows a confirmation dialog before proceeding
5. After reset, extension behaves as first-run (project creation prompt)
6. Application info shows extension version and database stats
7. Migrations run automatically on activation when schema is behind
8. Migration failure shows error with reset/retry options

### References

- Functional design Section 4.7 (Settings & Administration -- all subsections)
- Functional design Section 7.5 (Reset Application interaction flow)
- Functional design Section 7.6 (Application Upgrade interaction flow)
- Technical design Section 7 (VS Code Extension Manifest -- configuration)
- Technical design Section 4.3 (Migration Strategy)
- `vsix/package.json` (existing manifest to extend)
- Constitution Principle I (contribution points in `package.json`)

---

## Implementation Order

```
Phase 1: Foundation (Specs 1-3, partially parallelizable)
  Spec 1: Database Layer     --+
  Spec 2: SARIF Parser       --+-- Can run in parallel (no dependencies)
                                |
  Spec 3: Project Lifecycle  <--+-- Depends on Spec 1

Phase 2: Scan Execution (Specs 4-5, sequential)
  Spec 4: Scanner Service    <---- Depends on Spec 1 + 2
  Spec 5: Scan E2E           <---- Depends on Spec 3 + 4

Phase 3: Finding Display (Specs 6-7, sequential)
  Spec 6: Finding Queries    <---- Depends on Spec 1 (+ Spec 5 for real data)
  Spec 7: Finding Detail     <---- Depends on Spec 6

Phase 4: Triage & Polish (Specs 8-10, partially parallelizable)
  Spec 8: Finding Triage     <---- Depends on Spec 6
  Spec 9: Scan History       <---- Depends on Spec 5 + 6
  Spec 10: Settings & Admin  <---- Depends on Spec 1 + 3
```

Specs 8, 9, and 10 can be implemented in any order once their dependencies are met.

## Mock Data Removal

Mock data is removed incrementally as each spec replaces mock calls with real
queries. The `vsix/src/mock/data.ts` file can be deleted after Spec 9 is
complete (the last spec that references mock functions). The
`webview/src/mock-data.ts` file remains useful for standalone WebView
development and the Kitchen Sink, but the `App.tsx` initializer should switch
from mock-seeded state to empty state + message-driven population after the
scan execution specs are complete.

## Type Reconciliation

The current `vsix/src/models/types.ts` was designed for the mock app and has
some fields that diverge from the Prisma schema in the technical design:

| Field | Current Mock Type | Prisma Schema | Resolution |
|-------|------------------|---------------|------------|
| `FindingRow.scanTargetId` | Present | Present (FK to ScanTarget) | Direct map |
| `FindingRow.notes` | Present | Not in schema | Add `notes String @default("")` to Finding model |
| `FindingRow.title` | Present | Present | Direct map |
| `FindingRow.aiAnalysis` | Present (nullable) | Not in schema | Keep on type, always null in POC |
| `FindingRow.suppression` | Present (nullable) | Not in schema | Keep on type, always null in POC |
| `FindingRow.firstDetectedAt` | Present | Not in schema | Map from Finding's `createdAt` or Scan's `startedAt` |
| `ScanSummary.scanTargetId` | Present | Present (FK to ScanTarget) | Direct map |
| `ScanTarget` | Full interface | Database entity | Direct map (enriched with computed counts at query time) |

These reconciliations happen primarily in Spec 6 (Finding Queries) where the
database query results are mapped to WebView-facing types.
