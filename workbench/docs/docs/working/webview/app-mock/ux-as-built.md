---
title: Mock App UX As-Built
---

# Mock App UX As-Built

Comprehensive reference for the ASH Workbench mock WebView application as
implemented in `webview/src/`. This document captures the complete UX
architecture, every view and component, the data flow, navigation model,
state management, and the conventions that govern extension of the UI.

## Overview

The mock app is a fully interactive React WebView that simulates the
end-to-end security triage workflow: scanning a codebase, reviewing
findings, triaging dispositions, and tracking progress. It operates
entirely on hardcoded mock data with no extension host connection,
allowing rapid UI iteration in the Vite dev server or inside VS Code.

The app renders in three mutually exclusive contexts:

1. **Editor Panel** -- The primary workspace. Full dashboard, finding
   list/detail, scan history, scan progress, and empty state views.
2. **Sidebar** -- A compact read-only dashboard showing triage progress,
   severity breakdown, and scan targets.
3. **Kitchen Sink** -- A component gallery for visual testing (not
   documented here; see the sink as-built).

Context is determined by the `init` message from the extension host. In
mock mode (no `init` received), the app defaults to the editor panel
context with the dashboard view.

## Architecture

### State Machine

All application state lives in a single `useReducer` in `App.tsx:336`.
The reducer is the **only** place state transitions happen. There is no
React Context, no external state library, and no component-local state
for authoritative data (only UI-local concerns like filter selections).

```
AppState {
  context       -> which rendering mode (sidebar | editorPanel | sink)
  view          -> current ViewState enum
  viewHistory   -> stack for back-navigation
  project       -> Project metadata (name, rootPath)
  scanId        -> currently selected scan
  scans         -> all ScanSummary records
  summary       -> aggregated DispositionSummary
  findings      -> all FindingRow records
  selectedFinding -> finding for detail view
  targetPath    -> scan-in-progress target
  scanTargets   -> scan target directory list
  selectedScanTargetId -> active target filter
}
```

**ViewState enum**: `loading | dashboard | findingList | findingDetail |
scanHistory | scanDetail | scanProgress | empty`

**Action types**: `MESSAGE | NAVIGATE | SELECT_FINDING | SELECT_SCAN |
VIEW_SCAN_DETAIL | SET_DISPOSITION | SET_NOTES | START_SCAN |
SELECT_SCAN_TARGET | CLEAR_SCAN_TARGET | BACK | BACK_TO_LIST`

### Navigation Model

Navigation uses a **history stack** (`viewHistory: ViewState[]`). Every
`NAVIGATE`, `SELECT_FINDING`, `SELECT_SCAN`, `VIEW_SCAN_DETAIL`, and
`START_SCAN` action pushes the current view onto the stack before
transitioning. The `BACK` action pops the stack (defaulting to
`dashboard` if empty). `BACK_TO_LIST` is a special shortcut that clears
the stack and jumps directly to `findingList`.

Breadcrumbs are rendered via `AppBreadcrumb` on every view, providing
clickable navigation back to parent views (Dashboard > Findings >
Detail).

### Scan Target Filtering

The concept of **scan targets** is central. A scan target is a directory
that has been scanned (e.g., workspace root, `backend/`, `infra/`). When
a scan target is selected (`selectedScanTargetId`), the findings and
scans passed to views are filtered to only that target. This filtering
happens via `useMemo` in the `EditorPanel` component
(`App.tsx:207-219`).

The `CLEAR_SCAN_TARGET` action removes the filter. Navigating back to
the dashboard also clears it (via `navigateDashboard` which dispatches
both `CLEAR_SCAN_TARGET` and `NAVIGATE`).

### Data Flow

```
mock-data.ts (hardcoded)
    |
    v
App.tsx useReducer (initialState populated from mock exports)
    |
    v
EditorPanel (derives filtered data via useMemo)
    |
    +---> DashboardView  (reads all data, dispatches navigate/scan actions)
    +---> FindingsView   (reads filtered findings, dispatches selection/triage)
    +---> FindingDetailView (reads selectedFinding, dispatches disposition/notes)
    +---> ScanHistoryView (reads filtered scans, dispatches scan selection)
    +---> ScanDetailView  (reads single scan + its findings)
    +---> ScanProgressView (static mock progress)
    +---> EmptyStateView   (static)
```

Disposition changes are **immediate and bidirectional**: when a user sets
a disposition, `SET_DISPOSITION` updates the findings array, the
selected finding (if it matches), recomputes the summary, and
recomputes scan targets. This happens in the reducer at
`App.tsx:146-155`.

## File Inventory

### Core Application

| File | Responsibility |
|------|---------------|
| `src/App.tsx` | Root component, `useReducer` state machine, context routing, `EditorPanel` layout |
| `src/mock-data.ts` | All hardcoded mock data (project, scans, findings, scan targets, AI analysis, suppressions) |
| `src/hooks/useVSCodeAPI.ts` | `acquireVsCodeApi()` wrapper, `postMessage()`, `useMessages()` hook |
| `src/types/types.ts` | Domain types: `Project`, `ScanSummary`, `FindingRow`, `ScanTarget`, `DispositionSummary`, `AiAnalysis`, `SuppressionData` |
| `src/types/messages.ts` | Message protocol: `ExtToWebviewMessage`, `WebviewToExtMessage` discriminated unions |
| `src/lib/theme-colors.ts` | Color maps for severity and disposition badges/bars |
| `src/lib/utils.ts` | `cn()` utility (clsx + tailwind-merge) |
| `src/index.css` | VS Code theme variable mapping, Tailwind v4 config, base styles |

### View Components (one per ViewState)

| File | View | Role |
|------|------|------|
| `src/components/DashboardView.tsx` | `dashboard` | Project overview: summary cards, scan targets, quick actions |
| `src/components/FindingsView.tsx` | `findingList` | Filterable/sortable data table of all findings with batch triage |
| `src/components/FindingDetailView.tsx` | `findingDetail` | Single finding: header, triage controls, code, AI analysis, suppression |
| `src/components/ScanHistoryView.tsx` | `scanHistory` | List of past scans with active scan indicator |
| `src/components/ScanDetailView.tsx` | `scanDetail` | Single scan: metadata, severity chart, scanner breakdown |
| `src/components/ScanProgressView.tsx` | `scanProgress` | Live scan progress: scanner checklist, progress bar, log output |
| `src/components/EmptyStateView.tsx` | `empty` | Welcome, no-findings, or scan-failed empty states |

### Shared UI Components

| File | Role |
|------|------|
| `src/components/AppBreadcrumb.tsx` | Reusable breadcrumb with clickable segments |
| `src/components/SeverityBadge.tsx` | Colored badge for CRITICAL/HIGH/MEDIUM/LOW/INFO |
| `src/components/DispositionBadge.tsx` | Colored badge for PENDING/FIX/SUPPRESS/DEFER |
| `src/components/SummaryCard.tsx` | Card wrapper with title/content/footer slots |
| `src/components/ScanCard.tsx` | Card for a single scan in history lists |
| `src/components/ScanTargetCard.tsx` | Card for a scan target showing findings, severity, triage progress |
| `src/components/ScanTargetPicker.tsx` | Dialog for selecting scan target directory |
| `src/components/TriageControls.tsx` | Four-button disposition selector with active state |
| `src/components/TriageNotes.tsx` | Collapsible textarea for triage notes (500 char limit) |
| `src/components/TriageProgressBar.tsx` | Stacked bar showing disposition distribution |
| `src/components/SeverityChart.tsx` | Horizontal bar chart for severity counts |
| `src/components/ScannerProgress.tsx` | Checklist of scanner status (completed/running/queued) |
| `src/components/CodeBlock.tsx` | Code display with line numbers and highlight support |
| `src/components/AiAnalysisPanel.tsx` | Accordion panel for AI explanation, risk assessment, fix, references |
| `src/components/SuppressionPanel.tsx` | Suppression justification, YAML entry, expiry display |
| `src/components/FindingNavigation.tsx` | Prev/Next navigation between findings in a list |
| `src/components/DevNav.tsx` | Development-only navigation bar for switching views directly |

### ShadCN UI Primitives (`src/components/ui/`)

Auto-generated, not hand-edited. Used throughout:
`accordion`, `alert`, `badge`, `breadcrumb`, `button`, `card`,
`checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `input`, `label`,
`progress`, `scroll-area`, `select`, `separator`, `switch`, `table`,
`tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`.

## Implementation Details

### View: Dashboard (`DashboardView.tsx`)

The landing page. Three-column grid of summary cards at the top:

1. **Total Findings** -- aggregate count with inline severity badges
2. **Scan Targets** -- count of targets + completed scans
3. **Triage Progress** -- stacked progress bar via `TriageProgressBar`

Below the grid: a list of `ScanTargetCard` components. Each card shows
the target's path, finding count, severity breakdown, and per-target
triage progress. Clicking a card dispatches `SELECT_SCAN_TARGET` which
filters findings and navigates to `findingList`.

A "Run Scan" button in the header opens the `ScanTargetPicker` dialog.
Quick action buttons at the bottom link to "All Findings" and "Scan
History".

### View: Findings List (`FindingsView.tsx`)

Built on `@tanstack/react-table` for sorting, filtering, and row
selection.

**Columns**: Checkbox (select), Severity (custom sort by
`severityOrder`), Title, File (mono, `path:line`), Scanner, Status
(disposition badge), Actions (dropdown menu).

**Filter toolbar**:
- Severity toggle buttons (click to include/exclude each level)
- Disposition toggle buttons (same pattern)
- Scanner dropdown (`<select>` styled with VS Code input variables)
- Free-text search (matches `filePath` and `title`, case-insensitive)

**Row selection and batch triage**: Checkboxes enable multi-select. When
rows are selected, a sticky bottom bar appears with a "Set Disposition"
dropdown for batch operations and a "Deselect All" button. Batch
disposition iterates over selected rows and dispatches `SET_DISPOSITION`
for each (`FindingsView.tsx:183-188`).

**Row click**: Navigates to `findingDetail` via `onSelectFinding`.

### View: Finding Detail (`FindingDetailView.tsx`)

Six sections separated by `<Separator>`:

1. **Header** -- Severity badge, title, rule ID (in code block),
   scanner, first-detected date, current disposition badge.
2. **Triage controls** -- Four buttons (PENDING/FIX/SUPPRESS/DEFER) via
   `TriageControls`. Collapsible notes textarea via `TriageNotes`.
3. **Description** -- Plain text paragraph.
4. **Location** -- Clickable file path (sends `navigateToCode` message),
   "Open in Editor" button, `CodeBlock` with line numbers and highlight.
5. **AI Analysis** (conditional) -- Accordion with Explanation, Risk
   Assessment (three risk badges with rationale), Suggested Fix (code
   diff), References (linked).
6. **Suppression** (conditional, only when disposition is SUPPRESS) --
   Alert, justification textarea (read-only), `.ash.yaml` entry with
   copy button, expiry date.

`FindingNavigation` in the header provides Prev/Next buttons with
"X of Y" counter for stepping through the findings list.

### View: Scan History (`ScanHistoryView.tsx`)

Shows active scan (if RUNNING) in a highlighted card with scanner
progress and View Details / Cancel buttons. Below: list of completed
scans as `ScanCard` components.

Target filter tabs appear when no target is selected and multiple
targets exist. A "Run New Scan" button opens the `ScanTargetPicker`.

### View: Scan Detail (`ScanDetailView.tsx`)

Metadata header (status, dates, duration, source directory). Two summary
cards: findings count with severity badges, scanner count. Severity
distribution horizontal bar chart via `SeverityChart`. Scanner results
checklist via `ScannerProgress`. "View N Findings" action button. Error
card for failed scans with a static error message.

### View: Scan Progress (`ScanProgressView.tsx`)

Centered layout with shield emoji, title, target path, static elapsed
time (`2:15`), progress bar (`Progress` component), scanner checklist,
Cancel button, and collapsible log output (static mock log lines).

### View: Empty State (`EmptyStateView.tsx`)

Three variants:
- **welcome** -- Shield emoji, install instructions (3 steps), "Run
  First Scan" button.
- **noFindings** -- Checkmark emoji, congratulatory message, "Return to
  Dashboard" button.
- **scanFailed** -- Warning emoji, error message, "Try Again" and
  "Check Settings" buttons.

### Sidebar (`SidebarDashboard.tsx`)

Compact single-column layout. Sections:
1. Title + project name
2. "Scan Workspace" button (sends `startScan` message)
3. Active scan indicator (animated pulse, cancel button)
4. Scan targets list (folder icon + name + finding count)
5. Triage progress (stacked bar + disposition badge counts)
6. Severity breakdown (badges from latest completed scan)
7. "View Findings" button (sends `openFindings` message)

### Dev Navigation (`DevNav.tsx`)

A yellow-tinted bar at the top of the editor panel, labeled "DEV".
Provides direct buttons for every view state (Dashboard, Findings,
Detail, Scans, Progress, Empty). Active view is highlighted. This is a
development aid; it will be removed when the extension host drives
navigation.

## Patterns and Conventions

### Component Structure

- One file per component, PascalCase filename
- Props interface defined above the component in the same file
- Named exports (no default exports except `App` and `SinkPage`)
- `import type { ... }` for type-only imports
- ShadCN imports use `@/components/ui/*` alias; app code uses relative
  paths

### Color System

Domain-specific colors are centralized in `src/lib/theme-colors.ts`:

**Severity** (`severityColor`): Each level has `base` (solid background)
and `hover` classes. CRITICAL=red-700, HIGH=orange-700, MEDIUM=yellow-600,
LOW=blue-600, INFO=gray-500.

**Disposition** (`dispositionColor`): Each state has `tinted` (light
background), `solid` (full color), and `hover` classes with explicit
light/dark mode variants. PENDING=gray, FIX=teal, SUPPRESS=indigo,
DEFER=slate.

These are the only hardcoded colors in the app. Everything else inherits
from VS Code theme variables mapped in `index.css`.

### Theme Integration (`index.css`)

- `@custom-variant dark (&:is(.vscode-dark *))` remaps Tailwind's
  `dark:` prefix to VS Code's `.vscode-dark` body class
- `:root` maps every ShadCN design token to a `--vscode-*` CSS variable
  with OKLCH fallbacks for non-VS-Code rendering
- `.vscode-dark` and `.vscode-high-contrast` set `color-scheme: dark`
- Body inherits `--vscode-font-family`, `--vscode-font-size`,
  `--vscode-font-weight`
- No external fonts, no custom color palettes beyond severity/disposition

### Data Table Pattern (`FindingsView.tsx`)

Uses `@tanstack/react-table` with:
- `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`
- Custom sort function for severity (by `severityOrder` rank, not
  alphabetical)
- `getRowId` set to `row.id` for stable selection
- Row selection managed via `rowSelection` state + `Checkbox` column
- Click handlers use `e.stopPropagation()` on interactive cells
  (checkboxes, dropdown menus) to prevent row-click navigation

### Message Protocol

Two discriminated unions in `src/types/messages.ts`:

**Extension -> WebView** (`ExtToWebviewMessage`): `init`, `stateUpdate`,
`findingsUpdate`, `findingDetail`, `dispositionUpdated`, `scanStarted`.

**WebView -> Extension** (`WebviewToExtMessage`): `requestState`,
`selectScan`, `selectFinding`, `setDisposition`, `navigateToCode`,
`startScan`, `openFindings`, `openSink`.

The `init` message determines context (sidebar/editorPanel/sink). In
mock mode, no `init` is received, so `context` stays `'unknown'` and
the app renders the editor panel.

### Mock Data Structure (`mock-data.ts`)

- 1 project, 7 scans, 26 findings across 3 scan targets
- Findings organized by scan target: `rootFindings` (18), `backendFindings` (5), `infraFindings` (3)
- 4 AI analysis objects (hard-coded key, SQL injection, XSS, S3 encryption)
- 2 suppression objects (security group, hardcoded port)
- Scanners represented: bandit, checkov, semgrep, detect-secrets, grype, cfn-nag, cdk-nag, npm-audit (all 8 ASH scanners)
- Severity distribution: 3 CRITICAL, 6 HIGH, 7 MEDIUM, 5 LOW, 3 INFO
- Dispositions: mix of PENDING, FIX, SUPPRESS, DEFER
- Mutation helpers (`updateMockDisposition`, `updateMockNotes`,
  `recomputeScanTargets`) return new arrays for immutable state updates

## Configuration and Environment

| Concern | Setting |
|---------|---------|
| VS Code API | `acquireVsCodeApi()` called once at module scope in `hooks/useVSCodeAPI.ts:12` |
| Vite dev server | Runs standalone but `acquireVsCodeApi` is undefined -- currently no fallback (will error) |
| Fixed output names | `dist/assets/index.js`, `dist/assets/index.css` (Vite config, no content hashing) |
| Import alias | `@` resolves to `src/` (tsconfig + vite config) |
| Peer dep workaround | `.npmrc` sets `legacy-peer-deps=true` |
| Tailwind version | v4 with `@tailwindcss/vite` plugin |

## Integration Points

### Extension Host (future, not yet wired)

- `postMessage()` sends `WebviewToExtMessage` to the extension host.
  Currently used in: `SidebarDashboard.tsx` (startScan, openFindings),
  `FindingDetailView.tsx` (navigateToCode). In mock mode these messages
  are silently dropped.
- `useMessages()` listens for `ExtToWebviewMessage` via
  `window.addEventListener('message')`. In mock mode no messages arrive,
  so the reducer's `MESSAGE` handler is never triggered.

### Types Shared with vsix/

`src/types/types.ts` and `src/types/messages.ts` are manual copies of
types defined in `vsix/src/models/types.ts`. These must be kept in sync
manually when either side changes.

## Maintenance and Gotchas

1. **`acquireVsCodeApi` crashes outside VS Code.** The call at
   `useVSCodeAPI.ts:12` happens at module import time. Running the app
   in a plain browser (e.g., `vite dev`) will throw immediately.
   Wrapping this in a try/catch with a no-op fallback would be needed
   for standalone dev server usage.

2. **Mock scanner lists are duplicated.** `ScanHistoryView.tsx:24-33`,
   `ScanProgressView.tsx:15-24`, and `ScanDetailView.tsx:48-57` each
   define their own `mockScanners` array with slightly different
   statuses (mixed completed/running/queued vs all completed). These
   are not shared.

3. **`recomputeSummary` is duplicated.** Both `App.tsx:50-56` and
   `mock-data.ts:482-488` (`computeSummary`) implement the same logic.
   They are kept separate because the reducer function and the mock data
   initializer have different module scopes.

4. **`formatDate` and `formatDuration` are duplicated.** Defined locally
   in `FindingDetailView.tsx:27-31`, `ScanCard.tsx:13-26`, and
   `ScanDetailView.tsx:19-32`. No shared utility.

5. **Disposition change recomputes scan targets.** Every
   `SET_DISPOSITION` action calls `recomputeScanTargets()` which
   rebuilds all three scan target objects by filtering the full findings
   array three times. This is O(3n) per disposition change. Fine for 26
   mock findings; may need optimization with real data.

6. **`BACK_TO_LIST` clears history.** `App.tsx:188-189` sets
   `viewHistory: []`, which means pressing Back after `BACK_TO_LIST`
   will go to `dashboard` (the fallback), not the actual previous view.
   This is intentional for the "exit detail" flow but could surprise if
   used elsewhere.

7. **Batch triage dispatches N actions.** `FindingsView.tsx:183-188`
   loops over selected rows and dispatches `onSetDisposition` for each.
   Each dispatch triggers a full reducer cycle including
   `recomputeScanTargets`. With many selections this is wasteful; a
   batch action type would be more efficient.

8. **ScanTargetPicker custom path goes nowhere useful.** The custom path
   input (`ScanTargetPicker.tsx:37-41`) accepts any string and calls
   `onStartScan`. In mock mode this starts a fake scan for an arbitrary
   path. The "In VS Code, this would open a folder picker dialog" note
   at line 127 documents the intended real behavior.

9. **`severityOrder` must match column sort.** The `FindingsView`
   severity column uses `severityOrder` from `theme-colors.ts` for
   custom sorting. If severity levels are added or reordered in the
   type, the sort map must be updated in sync.

10. **AI Analysis panel links are real URLs.** The mock AI analysis
    references contain real external URLs (OWASP, CWE, AWS docs).
    Inside a VS Code webview with strict CSP, clicking these will
    attempt to open in the default browser. This is the correct
    behavior, but the links are not wrapped in a VS Code command -- they
    rely on the webview's default link handling.

11. **Suppression YAML copy uses `navigator.clipboard`.** At
    `SuppressionPanel.tsx:43`, `navigator.clipboard.writeText()` is
    called directly. This may fail in VS Code webviews depending on CSP
    and focus state. The real implementation should use a VS Code command
    for clipboard access.

## Testing

There are no automated tests for the webview components. Testing is done
visually:

- **Kitchen Sink** (`pages/sink/SinkPage`) renders all component
  variants. Opened via the `ASH: Open Kitchen Sink` command in dev
  builds.
- **DevNav** provides direct view switching without needing to navigate
  through the app flow.
- **Vite dev server** (`npm run dev` in `webview/`) would allow rapid
  iteration but currently crashes due to the `acquireVsCodeApi` call
  (see gotcha #1).

## Key Takeaways

- **Single reducer, no external state** -- all state in `App.tsx`
  `useReducer`. Views are pure functions of state + dispatch callbacks.
- **8 view states** -- dashboard, findingList, findingDetail,
  scanHistory, scanDetail, scanProgress, empty, loading.
- **Scan target filtering** -- drives the finding/scan scope throughout
  the app. Clearing the target shows all data.
- **26 mock findings** across 3 scan targets covering all 8 ASH
  scanners, all 5 severity levels, and all 4 disposition states.
- **AI Analysis and Suppression** are conditionally rendered -- only
  appear when the finding has data. 4 of 26 findings have AI analysis;
  2 have suppression data.
- **Theme integration** via CSS custom properties mapped from
  `--vscode-*` variables. Only severity/disposition colors are
  hardcoded Tailwind classes.
- **`@tanstack/react-table`** powers the findings list with sort, filter,
  multi-select, and batch operations.
- **No router** -- navigation is a ViewState enum + history stack in
  the reducer. Breadcrumbs provide the visual navigation trail.
- **Types are manually synced** between `webview/src/types/` and
  `vsix/src/models/`. No shared package.
- **DevNav is temporary** -- the yellow development navigation bar at
  the top of every editor panel view will be removed when real extension
  host navigation is implemented.
