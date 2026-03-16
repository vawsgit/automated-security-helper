---
title: app-mock-plan
---

# ○ ASH Workbench Mock Application Implementation Plan

## 1. Executive Summary

Build the complete ASH Workbench UI as a production-grade React application with hardcoded mock data. The mock replaces the current minimal prototype (3 views) with 7 fully realized views covering the entire scan-triage-remediate workflow. Components, types, and file locations are production-grade from day one -- the only change when the backend connects is swapping the data source from local imports to extension host postMessage.

Key decisions: use the existing `editorPanel` context (no new context), replace current `FindingList` and `FindingDetail` with new implementations, build all components directly in `components/`, extend `types.ts` with AI and suppression types immediately, use TanStack React Table for the findings table. Simultaneously implement the "Cool Triage" color system: centralize all color mappings into a shared theme module, shift disposition badges to tinted cool-tone style, and refine severity badge colors.

Reference: [`app-mock-research.md`](./app-mock-research.md) for detailed layouts, type definitions, and architectural decisions. [`app-theme-research.md`](./app-theme-research.md) for color system analysis and the recommended Option A palette.

## 2. What Will Be Done

### Color System (from [`app-theme-research.md`](./app-theme-research.md))
- Create `src/lib/theme-colors.ts` as the single source of truth for all semantic color mappings
- Implement Option A "Cool Triage": tinted cool-tone disposition badges (teal FIX, indigo SUPPRESS, slate DEFER) vs solid warm-tone severity badges
- Shift HIGH severity from `bg-orange-600` to `bg-orange-700` for better contrast
- Refactor `SeverityBadge.tsx`, `DispositionBadge.tsx`, `SidebarDashboard.tsx` to import from centralized theme module
- Eliminate all 5 duplicated color map definitions across 4 files

### Types and Data
- Extend `FindingRow` with `notes`, `firstDetectedAt`, `aiAnalysis`, `suppression` fields
- Add new types: `AiAnalysis`, `RiskAssessment`, `RiskLevel`, `SuggestedFix`, `AiReference`, `SuppressionData`
- Create `webview/src/mock-data.ts` with comprehensive hardcoded data (18+ findings, 4 scans, AI analysis for 3-4 findings, suppression data for suppressed findings)
- Mirror type changes to `vsix/src/models/types.ts`

### State Machine
- Expand `ViewState` from 3 values to 7: `loading`, `dashboard`, `findingList`, `findingDetail`, `scanHistory`, `scanProgress`, `empty`
- Add `viewHistory` stack and `NAVIGATE`/`BACK` actions to the reducer
- Add mock-phase data initialization in App.tsx (import from `mock-data.ts`, populate state on mount)

### Views (7 total)
1. **DashboardView** -- Project overview: summary cards, triage progress bar, severity distribution chart, quick actions
2. **FindingsView** -- TanStack React Table with severity/disposition/scanner filters, sorting, pagination, row selection, batch action bar
3. **FindingDetailView** -- Triage workspace: disposition controls, notes, code block, AI analysis panel (collapsible), suppression panel (conditional)
4. **ScanHistoryView** -- Scan card list with completed/failed/cancelled/running variants, active scan card
5. **ScanProgressView** -- Centered scan monitoring with per-scanner status checklist, elapsed timer
6. **EmptyStateView** -- First-run welcome, zero findings, scan failed states
7. **SidebarDashboard** -- Enhanced: active scan indicator, recent scans list, triage progress text

### Shared Components (12 new)
- `DevNav` -- Dev-only view selector bar (temporary)
- `SummaryCard` -- Reusable stat card with title/body/footer
- `TriageProgressBar` -- Segmented progress bar (disposition-colored)
- `SeverityChart` -- Horizontal bar chart for severity distribution
- `TriageControls` -- Disposition button group with active state
- `TriageNotes` -- Collapsible textarea for triage annotations
- `CodeBlock` -- Line-numbered code display with line highlighting
- `AiAnalysisPanel` -- Accordion-based AI analysis card
- `SuppressionPanel` -- Justification textarea + `.ash.yaml` preview
- `ScanCard` -- Scan history card with status variants
- `ScannerProgress` -- Scanner checklist with completion status icons
- `FindingNavigation` -- Previous/next arrows for stepping through filtered findings

### New ShadCN Components
- Install `scroll-area`, `breadcrumb`, `toggle-group`, `collapsible`

## 3. What Will NOT Be Done

- **Backend integration** -- No postMessage wiring, no extension host changes (beyond type sync)
- **Real scan execution** -- Scan progress view shows mock data, not a real ASH CLI process
- **AI inference** -- Mock data only; no LLM calls or API integration
- **Suppression file generation** -- The `.ash.yaml` preview is static; no file system writes
- **Settings/preferences UI** -- Deferred to a future iteration
- **Tests** -- This phase is pure UI construction; tests come when backend connects
- **Responsive mobile layout** -- VS Code webviews are desktop-only
- **Kitchen Sink demos for new components** -- Deferred entirely; the mock app itself serves as the living demo. Add sink demos opportunistically in a future pass.

## 4. Files to Modify

```
webview/src/
  App.tsx                           MODIFY  Expand ViewState, reducer, routing, mock data init
  mock-data.ts                      CREATE  Hardcoded data for all views
  lib/
    theme-colors.ts                 CREATE  Centralized severity + disposition color maps (Option A)
  types/
    types.ts                        MODIFY  Add AiAnalysis, SuppressionData, extend FindingRow
    messages.ts                     MODIFY  Add new message types for future backend
  components/
    DevNav.tsx                      CREATE  Dev-only view selector (temporary)
    DashboardView.tsx               CREATE  Project overview
    FindingsView.tsx                CREATE  TanStack findings table (replaces FindingList)
    FindingDetailView.tsx           CREATE  Triage workspace (replaces FindingDetail)
    ScanHistoryView.tsx             CREATE  Scan management
    ScanProgressView.tsx            CREATE  Active scan monitoring
    EmptyStateView.tsx              CREATE  First-run / empty states
    SummaryCard.tsx                 CREATE  Reusable stat card
    TriageProgressBar.tsx           CREATE  Segmented progress bar
    SeverityChart.tsx               CREATE  Horizontal severity bars
    TriageControls.tsx              CREATE  Disposition button group
    TriageNotes.tsx                 CREATE  Collapsible notes textarea
    CodeBlock.tsx                   CREATE  Line-numbered code display
    AiAnalysisPanel.tsx             CREATE  AI analysis accordion
    SuppressionPanel.tsx            CREATE  Suppression justification + yaml
    ScanCard.tsx                    CREATE  Scan history card
    ScannerProgress.tsx             CREATE  Scanner status checklist
    FindingNavigation.tsx           CREATE  Previous/next finding arrows
    SeverityBadge.tsx               MODIFY  Refactor to use theme-colors.ts
    DispositionBadge.tsx            MODIFY  Refactor to use theme-colors.ts (tinted cool-tone style)
    SidebarDashboard.tsx            MODIFY  Theme refactor + add active scan, recent scans, triage progress
    FindingList.tsx                 DELETE  Replaced by FindingsView
    FindingDetail.tsx               DELETE  Replaced by FindingDetailView
    ui/                             (install new ShadCN components)
  pages/
    sink/                           (unchanged -- sink demos deferred)

vsix/src/
  models/types.ts                   MODIFY  Mirror new types from webview
  mock/data.ts                      MODIFY  Add new fields to existing mock data
```

## 5. Implementation Phases

### ○ Phase 1: Foundation -- Types, mock data, and state machine

Establish the data layer and navigation infrastructure that all subsequent phases depend on.

**Step 1.1: Install new ShadCN components**
- Run `npx shadcn@latest add scroll-area breadcrumb toggle-group collapsible --yes` in the webview directory
- Verify components appear in `components/ui/`

**Step 1.2: Create centralized theme color module**
- Create `webview/src/lib/theme-colors.ts` with the Option A color palette from `app-theme-research.md` Section 9.2
- Define `severityColor: Record<Severity, { base: string; hover: string }>` with solid-fill styles:
  - CRITICAL: `bg-red-700 text-white` (unchanged)
  - HIGH: `bg-orange-700 text-white` (deepened from orange-600)
  - MEDIUM: `bg-yellow-600 text-white` (unchanged)
  - LOW: `bg-blue-600 text-white` (unchanged)
  - INFO: `bg-gray-500 text-white` (unchanged)
- Define `dispositionColor: Record<Disposition, { tinted: string; solid: string; hover: string }>` with cool-toned tinted styles:
  - PENDING: gray tinted (`bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300`)
  - FIX: teal tinted (`bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300`)
  - SUPPRESS: indigo tinted (`bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300`)
  - DEFER: slate tinted (`bg-slate-200 text-slate-800 dark:bg-slate-700/40 dark:text-slate-300`)
- Each disposition also gets a `solid` variant for active/selected states in TriageControls

**Step 1.3: Refactor existing components to use theme module**
- Refactor `SeverityBadge.tsx`: remove local `severityStyles` map, import `severityColor` from `theme-colors.ts`
- Refactor `DispositionBadge.tsx`: remove local `dispositionStyles` map, import `dispositionColor` from `theme-colors.ts`, use `tinted` + `hover` fields
- Refactor `SidebarDashboard.tsx`: remove local `severityColors` and `dispositionColors` maps, import from `theme-colors.ts`
- Verify Kitchen Sink badge demos still render correctly after refactor

**Step 1.4: Extend type definitions**
- Add to `webview/src/types/types.ts`:

  - `RiskLevel` type (`'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'`)
  - `AiReference` interface (`title`, `url`)
  - `SuggestedFix` interface (`description`, `diffText`, `language`)
  - `RiskAssessment` interface (`exploitability`, `exploitabilityRationale`, `impact`, `impactRationale`, `likelihood`, `likelihoodRationale`)
  - `AiAnalysis` interface (`explanation`, `riskAssessment`, `suggestedFix`, `references`)
  - `SuppressionData` interface (`justification`, `yamlEntry`, `expiresAt`, `createdAt`)
  - Extend `FindingRow`: add `notes: string`, `firstDetectedAt: string`, `aiAnalysis: AiAnalysis | null`, `suppression: SuppressionData | null`
- Mirror all changes to `vsix/src/models/types.ts`

**Step 1.5: Create `webview/src/mock-data.ts`**
- Port mock data from `vsix/src/mock/data.ts`
- Extend all 18 findings with new fields (`notes`, `firstDetectedAt`, `aiAnalysis`, `suppression`)
- Add rich `AiAnalysis` mock data for 3-4 key findings (f-001 hard-coded key, f-002 SQL injection, f-003 XSS)
- Add `SuppressionData` for suppressed findings (f-009, f-015)
- Export: `mockProject`, `mockScans`, `mockFindings`, `mockSummary`
- Export helpers: `updateMockDisposition()`, `updateMockNotes()`

**Step 1.6: Expand App.tsx state machine**
- Expand `ViewState`: add `'dashboard' | 'scanHistory' | 'scanProgress' | 'empty'`
- Add `viewHistory: ViewState[]` to `AppState`
- Add `project: Project` to `AppState`
- Add new actions: `NAVIGATE` (push view history, set view), `BACK` (pop history), `SELECT_SCAN`, `SET_NOTES`
- Update `initialState` to load from `mock-data.ts` imports
- On mount: if mock data has scans, default to `dashboard` view; otherwise show `empty`
- Remove `requestState` postMessage on mount during mock phase (data is local)

**Step 1.7: Build DevNav component**
- Create `components/DevNav.tsx`
- Horizontal bar at top of editor panel with buttons for each view: Dashboard, Findings, Finding Detail, Scan History, Scan Progress, Empty
- Render conditionally (only when data comes from mock imports, not from extension host)
- Simple `onClick` dispatching `NAVIGATE` actions

**Step 1.8: Update App.tsx routing**
- In the `editorPanel` block, add a view router switch:
  - `dashboard` -> `DashboardView` (placeholder div initially)
  - `findingList` -> `FindingsView` (placeholder)
  - `findingDetail` -> `FindingDetailView` (placeholder)
  - `scanHistory` -> `ScanHistoryView` (placeholder)
  - `scanProgress` -> `ScanProgressView` (placeholder)
  - `empty` -> `EmptyStateView` (placeholder)
- Wrap editor panel content with `DevNav` at top
- Remove imports for old `FindingList` and `FindingDetail`

**Step 1.9: Sync vsix mock data**
- Update `vsix/src/mock/data.ts` to include new fields on all `FindingRow` entries (set `notes: ''`, `firstDetectedAt`, `aiAnalysis: null`, `suppression: null`)
- Ensure the extension host prototype still compiles

**Step 1.10: Delete old components**
- Delete `components/FindingList.tsx` and `components/FindingDetail.tsx`
- Verify build succeeds with placeholder views

**Verification:** `npm run build` passes in both `webview/` and `vsix/`. DevNav renders in the editor panel. Clicking DevNav buttons switches between placeholder views. Kitchen Sink badge demos render with new colors (tinted disposition badges, solid severity badges). No duplicate color maps remain in component files.

### ○ Phase 2: Core Views -- Dashboard and findings list

Build the two most important views: the project dashboard and the findings table.

**Step 2.1: Build `SummaryCard`**
- Reusable card component: `title` (string), `children` (body), optional `footer` (ReactNode)
- Uses ShadCN `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`
- Consistent padding and styling

**Step 2.2: Build `TriageProgressBar`**
- Props: `counts: Record<Disposition, number>`, `total: number`
- Segmented bar using `dispositionColor` solid values: teal (FIX), indigo (SUPPRESS), slate (DEFER), gray (PENDING)
- Percentage-width div segments inside a rounded container
- Stats text below: "X of Y triaged (Z%)"

**Step 2.3: Build `SeverityChart`**
- Props: `counts: Record<Severity, number>`
- Horizontal bar chart: one row per severity level
- Label (left), bar (percentage width with severity color), count + percentage (right)

**Step 2.4: Build `DashboardView`**
- Sticky header with breadcrumb "ASH Workbench" and Run Scan button
- Scrollable content with `max-w-5xl`:
  - Row 1: 2-column grid -- Project Info card + Latest Scan card
  - Row 2: Full-width `TriageProgressBar` card
  - Row 3: Full-width `SeverityChart` card
  - Row 4: Quick action buttons (Run Scan, View Findings, Scan History)
- All data from props (sourced from AppState, which reads mock-data.ts)

**Step 2.5: Build `FindingsView` with TanStack React Table**
- Reference pattern: `pages/sink/demos/tasks-demo.tsx`
- Column definitions: select checkbox, severity, title, file, scanner, disposition, actions dropdown
- Filter toolbar: severity toggle chips (`ToggleGroup`), disposition toggle chips, scanner `Select`, file search `Input`
- Stats bar: "X total, Y shown" + disposition breakdown
- Sorting on severity, title, file, scanner, disposition columns
- Row selection via checkboxes
- Pagination (50 per page)
- Row click navigates to finding detail (dispatch `SELECT_FINDING`)
- Per-row action dropdown: quick-set disposition (Fix/Suppress/Defer)

**Step 2.6: Build batch action bar**
- Sticky bottom bar, conditionally shown when `table.getSelectedRowModel().rows.length > 0`
- "N findings selected" text
- Disposition dropdown (PENDING/FIX/SUPPRESS/DEFER) -- applies to all selected
- Deselect All button

**Step 2.7: Wire DashboardView and FindingsView into App.tsx**
- Replace placeholder divs with real components
- Pass data from AppState as props
- Wire navigation: Dashboard "View Findings" -> dispatch `NAVIGATE` to `findingList`

**Verification:** Dashboard shows project summary with real mock data. Findings table renders 18 findings with working filters, sorting, selection, and batch actions.

### ○ Phase 3: Detail View -- The triage workspace

Build the finding detail page with all its sub-components.

**Step 3.1: Build `TriageControls`**
- Props: `disposition: Disposition`, `onDispositionChange: (d: Disposition) => void`
- 4 buttons in a row: PENDING (gray), FIX (teal), SUPPRESS (indigo), DEFER (slate)
- Uses `dispositionColor` from `theme-colors.ts`: active button gets `solid` style, inactive gets `tinted` + `hover`
- Clicking immediately fires the callback

**Step 3.2: Build `TriageNotes`**
- Props: `notes: string`, `onNotesChange: (notes: string) => void`
- Collapsible section (ShadCN `Collapsible`)
- Textarea with placeholder "Add notes about this triage decision..."
- Character count: "X / 500"

**Step 3.3: Build `CodeBlock`**
- Props: `code: string`, `startLine: number`, `highlightLines?: number[]`
- Line-numbered display with `--vscode-textCodeBlock-background`
- Highlighted lines get a subtle background tint
- Monospace font, `text-xs`

**Step 3.4: Build `AiAnalysisPanel`**
- Props: `analysis: AiAnalysis | null`
- Render nothing if `null`
- ShadCN `Accordion` with sub-sections:
  - Explanation (plain text paragraphs)
  - Risk Assessment (exploitability/impact/likelihood with RiskLevel badges)
  - Suggested Fix (description + diff-style code block + action buttons)
  - References (bulleted link list)
- Collapsed by default

**Step 3.5: Build `SuppressionPanel`**
- Props: `suppression: SuppressionData | null`, `disposition: Disposition`
- Only visible when `disposition === 'SUPPRESS'`
- Alert info box explaining suppression
- Justification textarea (pre-filled from `suppression.justification`)
- `.ash.yaml` entry preview code block (readonly)
- Copy to Clipboard button

**Step 3.6: Build `FindingNavigation`**
- Props: `findings: FindingRow[]`, `currentId: string`, `onNavigate: (id: string) => void`
- Previous/Next arrow buttons
- "X of Y" counter
- Steps through the provided findings array (which is the current filtered list)

**Step 3.7: Build `FindingDetailView`**
- Sticky header: breadcrumb ("Findings > finding title"), Back button, `FindingNavigation`
- Scrollable content with `max-w-4xl`:
  - Section 1: Finding header -- severity badge + title + metadata chips (rule, scanner, first detected, scan date)
  - Section 2: `TriageControls` + `TriageNotes`
  - Section 3: Description text
  - Section 4: Code location -- clickable file path + `CodeBlock`
  - Section 5: `AiAnalysisPanel`
  - Section 6: `SuppressionPanel`
- Wire disposition changes to dispatch `SET_DISPOSITION` (updates mock state)
- Wire "Open in Editor" to dispatch `navigateToCode` postMessage

**Step 3.8: Wire FindingDetailView into App.tsx**
- Replace placeholder, pass `selectedFinding`, `findings` (for navigation), handlers
- Ensure BACK action returns to findingList
- Pass filtered findings list to `FindingNavigation`

**Verification:** Click a finding row -> detail view renders with all sections. Disposition buttons toggle. AI panel expands for findings with mock AI data. Suppression panel shows for SUPPRESS disposition. Previous/next arrows work.

### ○ Phase 4: Scan Management and Empty States

Build the remaining views for scan lifecycle and first-run experience.

**Step 4.1: Build `ScannerProgress`**
- Props: `scanners: Array<{ name: string; status: 'completed' | 'running' | 'queued'; duration?: string }>`
- List of scanner names with status icons: green check (completed), animated spinner (running), gray circle (queued)
- Duration shown for completed scanners

**Step 4.2: Build `ScanCard`**
- Props: `scan: ScanSummary`, `onViewFindings?: () => void`, `onDelete?: () => void`
- Card with: status icon, date/time, duration, source directory, finding count, severity mini-badges
- Variants: completed (green check, View Findings button), failed (red X, error message), cancelled (gray circle)
- Delete button with ShadCN `Dialog` confirmation

**Step 4.3: Build `ScanHistoryView`**
- Sticky header: breadcrumb "ASH Workbench > Scans", Run New Scan button
- Active Scan Card (conditional): accent border, spinner, elapsed time, `ScannerProgress`, Cancel button
- Completed Scans: vertical stack of `ScanCard` components
- Wire "View Findings" to dispatch `SELECT_SCAN` -> navigate to findingList

**Step 4.4: Build `ScanProgressView`**
- Centered layout with large scan icon (animated pulse)
- Title: "Security Scan in Progress"
- Target info + mode info (muted text)
- Elapsed time counter (text-2xl, mono) -- use `useState` + `setInterval` for live counter
- Indeterminate progress bar (ShadCN `Progress`)
- `ScannerProgress` checklist
- Cancel Scan button
- Collapsible log output area (ShadCN `Collapsible` + scrollable pre)

**Step 4.5: Build `EmptyStateView`**
- Props: `variant: 'welcome' | 'noFindings' | 'scanFailed'`, `errorMessage?: string`
- Centered card with icon, title, body, action buttons
- Welcome: shield icon, "Welcome to ASH Workbench", setup steps, Run First Scan button
- No Findings: checkmark icon, "No Findings", Return to Dashboard button
- Scan Failed: alert icon, error message, Try Again + Check Settings buttons

**Step 4.6: Wire all views into App.tsx**
- Replace remaining placeholders
- Wire DevNav to render all views
- Ensure NAVIGATE/BACK actions work for scan history and scan progress

**Verification:** All 7 views render with mock data. DevNav allows switching between all views. Scan history shows 4 scan cards. Scan progress shows animated mock state. Empty states display correctly.

### ○ Phase 5: Sidebar Enhancement and Polish

Enhance the sidebar and add finishing touches.

**Step 5.1: Enhance `SidebarDashboard`**
- Add active scan indicator section (conditional, shown when a scan has `RUNNING` status):
  - "Scanning..." label with spinner, elapsed time, Cancel button
- Add recent scans list (last 3 scans):
  - Status icon + date + finding count per row, clickable
- Add triage progress text: "X of Y findings triaged (Z%)"
- Section labels: consistent `text-xs font-semibold uppercase tracking-wide` style

**Step 5.2: Theme verification**
- Test all views in VS Code dark, light, and high-contrast themes
- Verify severity badges use solid warm-tone colors from `severityColor` (red, orange, yellow, blue, gray)
- Verify disposition badges use tinted cool-tone colors from `dispositionColor` (teal, indigo, slate, gray)
- Verify tinted disposition badges render correctly on both light and dark backgrounds (the `/40` opacity values in dark mode)
- Verify no component still contains local color map definitions (all import from `theme-colors.ts`)
- Fix any theme-breaking styles

**Step 5.3: Navigation wiring**
- Verify all click handlers, breadcrumbs, and back buttons route correctly
- Dashboard -> Findings (View All Findings button)
- Dashboard -> Scan History (Scan History button)
- Findings -> Finding Detail (row click)
- Finding Detail -> Findings (Back button, breadcrumb)
- Finding Detail -> next/prev finding (navigation arrows)
- Scan History -> Findings (View Findings on scan card)

**Step 5.4: Update developer documentation**
- Update `webview/README.md` with expanded component inventory
- Update `webview/CLAUDE.md` if needed
- Update `docs/docs/developer-docs/webview/README.md` with new view architecture

**Verification:** Full end-to-end walkthrough: open dashboard -> browse findings -> triage a finding -> check AI analysis -> view scan history -> see scan progress -> return to dashboard. All navigations work. All themes look correct.

## 6. KISS Opportunities

### 6.1 Skip Pagination Initially
- **Impact:** Simplifies FindingsView by ~30 lines
- **Pros:** 18 mock findings fit in a single page; TanStack pagination can be added later with 2 lines of config
- **Cons:** Won't exercise pagination UI during mock phase
- **Steps:** Omit `getPaginationRowModel()` and pagination controls. Add when real data produces 50+ findings.

### 6.2 Static Elapsed Time in Scan Progress
- **Impact:** Avoids `setInterval` timer complexity
- **Pros:** The scan progress is purely visual in mock phase; a static "2:15" communicates the design
- **Cons:** Less realistic feel
- **Steps:** Show a fixed elapsed time string instead of a live counter. Add live counter when real scans are wired.

### 6.3 Inline Small Components
- **Impact:** Reduces file count by 3-4
- **Pros:** `SummaryCard`, `FindingNavigation`, and `ScannerProgress` are small enough to inline in their parent view
- **Cons:** Harder to reuse or demo independently
- **Steps:** Start inline; extract to separate files only if reuse is needed.

**Recommendation:** Apply 6.1 and 6.2 during initial implementation. Keep 6.3 as-is (separate files) since the research explicitly calls for reusable components. Kitchen Sink demos are deferred entirely -- the mock app itself is the best living demo; sink demos can be added opportunistically in a future pass.

## 7. Code Implementation Samples

### 7.1 Expanded ViewState and Reducer Actions

```typescript
// App.tsx -- expanded types
type ViewState =
  | 'loading' | 'dashboard' | 'findingList' | 'findingDetail'
  | 'scanHistory' | 'scanProgress' | 'empty';

interface AppState {
  context: 'sidebar' | 'editorPanel' | 'sink' | 'unknown';
  view: ViewState;
  viewHistory: ViewState[];
  project: Project;
  scanId: string | undefined;
  scans: ScanSummary[];
  summary: DispositionSummary;
  findings: FindingRow[];
  selectedFinding: FindingRow | undefined;
}

type AppAction =
  | { type: 'MESSAGE'; payload: ExtToWebviewMessage }
  | { type: 'NAVIGATE'; view: ViewState }
  | { type: 'SELECT_FINDING'; findingId: string }
  | { type: 'SELECT_SCAN'; scanId: string }
  | { type: 'SET_DISPOSITION'; findingId: string; disposition: Disposition }
  | { type: 'SET_NOTES'; findingId: string; notes: string }
  | { type: 'BACK' }
  | { type: 'BACK_TO_LIST' };
```

### 7.2 NAVIGATE / BACK Reducer Logic

```typescript
case 'NAVIGATE':
  return {
    ...state,
    viewHistory: [...state.viewHistory, state.view],
    view: action.view,
  };

case 'BACK': {
  const history = [...state.viewHistory];
  const prev = history.pop() ?? 'dashboard';
  return { ...state, viewHistory: history, view: prev };
}
```

### 7.3 FindingsView Column Definitions (TanStack)

```typescript
const columns: ColumnDef<FindingRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
      />
    ),
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
  },
  { accessorKey: 'title', header: 'Title' },
  {
    accessorKey: 'filePath',
    header: 'File',
    cell: ({ row }) => (
      <span className="font-mono text-xs opacity-70">
        {row.original.filePath}:{row.original.startLine}
      </span>
    ),
  },
  { accessorKey: 'scanner', header: 'Scanner' },
  {
    accessorKey: 'disposition',
    header: 'Status',
    cell: ({ row }) => (
      <DispositionBadge disposition={row.original.disposition} />
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>{/* Quick triage: Fix/Suppress/Defer */}</DropdownMenu>
    ),
  },
];
```

### 7.4 TriageControls Component (uses centralized theme)

```typescript
import { dispositionColor } from '@/lib/theme-colors';

interface TriageControlsProps {
  disposition: Disposition;
  onDispositionChange: (d: Disposition) => void;
}

// Uses filled-for-active / tinted-for-inactive pattern from theme-colors.ts
// Active button:   dispositionColor[d].solid  (e.g., bg-teal-600 text-white)
// Inactive button: dispositionColor[d].tinted + dispositionColor[d].hover

const dispositions: Disposition[] = ['PENDING', 'FIX', 'SUPPRESS', 'DEFER'];

function TriageControls({ disposition, onDispositionChange }: TriageControlsProps) {
  return (
    <div className="flex gap-2">
      {dispositions.map((d) => (
        <Button
          key={d}
          className={disposition === d
            ? dispositionColor[d].solid
            : `${dispositionColor[d].tinted} ${dispositionColor[d].hover}`
          }
          onClick={() => onDispositionChange(d)}
        >
          {d}
        </Button>
      ))}
    </div>
  );
}
```

### 7.5 Centralized Theme Module

```typescript
// src/lib/theme-colors.ts -- single source of truth for semantic colors
import type { Severity, Disposition } from '@/types/types';

export const severityColor: Record<Severity, { base: string; hover: string }> = {
  CRITICAL: { base: 'bg-red-700 text-white',    hover: 'hover:bg-red-800' },
  HIGH:     { base: 'bg-orange-700 text-white',  hover: 'hover:bg-orange-800' },
  MEDIUM:   { base: 'bg-yellow-600 text-white',  hover: 'hover:bg-yellow-700' },
  LOW:      { base: 'bg-blue-600 text-white',    hover: 'hover:bg-blue-700' },
  INFO:     { base: 'bg-gray-500 text-white',    hover: 'hover:bg-gray-600' },
};

export const dispositionColor: Record<Disposition, {
  tinted: string;  // default state (badges, inactive buttons)
  solid: string;   // active/selected state (TriageControls active button)
  hover: string;   // hover for tinted state
}> = {
  PENDING:  {
    tinted: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
    solid:  'bg-gray-500 text-white',
    hover:  'hover:bg-gray-200 dark:hover:bg-gray-700/40',
  },
  FIX: {
    tinted: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    solid:  'bg-teal-600 text-white',
    hover:  'hover:bg-teal-200 dark:hover:bg-teal-800/40',
  },
  SUPPRESS: {
    tinted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    solid:  'bg-indigo-600 text-white',
    hover:  'hover:bg-indigo-200 dark:hover:bg-indigo-800/40',
  },
  DEFER: {
    tinted: 'bg-slate-200 text-slate-800 dark:bg-slate-700/40 dark:text-slate-300',
    solid:  'bg-slate-500 text-white',
    hover:  'hover:bg-slate-300 dark:hover:bg-slate-600/40',
  },
};
```

### 7.7 Mock Data Initialization in App.tsx

```typescript
import { mockProject, mockScans, mockFindings, mockSummary } from './mock-data';

const initialState: AppState = {
  context: 'unknown',
  view: 'loading',
  viewHistory: [],
  project: mockProject,
  scanId: mockScans[0]?.id,
  scans: mockScans,
  summary: mockSummary,
  findings: mockFindings,
  selectedFinding: undefined,
};
```

### 7.8 DevNav Component

```typescript
const DEV_VIEWS: { view: ViewState; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'findingList', label: 'Findings' },
  { view: 'findingDetail', label: 'Detail' },
  { view: 'scanHistory', label: 'Scans' },
  { view: 'scanProgress', label: 'Progress' },
  { view: 'empty', label: 'Empty' },
];

function DevNav({ currentView, onNavigate }: {
  currentView: ViewState;
  onNavigate: (v: ViewState) => void;
}) {
  return (
    <div className="flex gap-1 p-2 border-b bg-yellow-500/10">
      <span className="text-xs font-mono opacity-50 self-center mr-2">
        DEV
      </span>
      {DEV_VIEWS.map(({ view, label }) => (
        <Button
          key={view}
          variant={currentView === view ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onNavigate(view)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
```

## 8. Testing Strategy

### Mock Phase Testing (Manual)

Since the mock uses hardcoded data with no backend, testing is manual visual verification:

- **Per-phase verification** -- Each phase ends with a `npm run build` check and visual walkthrough
- **Theme matrix** -- Test dark, light, and high-contrast themes (Phase 5)
- **Navigation audit** -- Walk every navigation path: dashboard -> findings -> detail -> back (Phase 5)
- **Filter verification** -- Toggle each filter combination in FindingsView (Phase 2)
- **State consistency** -- Change disposition in detail view, verify it updates in the list (Phase 3)

### Future Testing (When Backend Connects)

- Unit tests for reducer actions (`NAVIGATE`, `BACK`, `SELECT_FINDING`, etc.)
- Component tests for `TriageControls`, `FindingNavigation`, `TriageProgressBar` (pure prop-driven components)
- Integration tests for the postMessage protocol (mock `acquireVsCodeApi`)

## 9. Documentation Steps

- Update `webview/README.md` with:
  - Expanded file inventory (18 new files)
  - Updated view architecture section (7 views)
  - New ShadCN component catalog entries
  - Mock data usage guide
- Update `webview/CLAUDE.md` if conventions change
- Update `docs/docs/developer-docs/webview/README.md` with expanded component inventory and view system
- Add header comment in `mock-data.ts` explaining the temporary nature and transition path
