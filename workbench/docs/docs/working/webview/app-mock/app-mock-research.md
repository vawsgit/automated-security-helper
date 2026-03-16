---
title: App Mock Research
---

# App Mock Research: Comprehensive UI Design for ASH Workbench

Deep design research for a complete mock implementation of the ASH Workbench application. This document defines the navigation hierarchy, page inventory, and detailed layouts for every screen -- covering the full user workflow from scan initiation through triage, remediation, suppression, and AI-assisted analysis.

The mock replaces the current minimal prototype (SidebarDashboard + FindingList + FindingDetail) with the comprehensive production application UI, built with hardcoded data initially but designed from day one to become the real app. Components, types, and file structure are production-grade -- the only thing that changes when the backend connects is swapping hardcoded imports for extension host messages.

## 1. Current State

### 1.1 What Exists Today

The current webview has three editor panel views and one sidebar view:

| View | Component | File | What It Does |
|---|---|---|---|
| Sidebar | `SidebarDashboard` | `components/SidebarDashboard.tsx` | Project name, Run Scan button, triage summary badges, severity breakdown, View Findings button |
| Finding List | `FindingList` | `components/FindingList.tsx` | Findings table with severity/disposition/scanner filter toggles |
| Finding Detail | `FindingDetail` | `components/FindingDetail.tsx` | Breadcrumb, severity badge, disposition button group, description, clickable code location |
| Kitchen Sink | `SinkPage` | `pages/sink/SinkPage.tsx` | Dev-only component showcase with search filter and demo grid |

The App.tsx state machine (`App.tsx:10-20`) routes between views using two state dimensions:
- **context**: `sidebar` | `editorPanel` | `sink` | `unknown`
- **view**: `loading` | `findingList` | `findingDetail`

Mock data lives in `vsix/src/mock/data.ts` (18 findings across 8 scanners with varied severities and dispositions). The extension host serves this data via postMessage -- the webview has no embedded mock data.

### 1.2 What's Missing

The current prototype shows the core scan-triage loop but lacks:

1. **Dashboard/overview** -- No project health summary, no at-a-glance triage progress
2. **Scan management** -- No scan history view, no progress indicator, no scan configuration
3. **AI analysis** -- No explanation panel, no suggested fixes, no risk assessment
4. **Suppression workflow** -- No justification capture, no `.ash.yaml` preview
5. **Batch operations** -- No multi-select, no bulk disposition
6. **Triage notes** -- No way to annotate triage decisions
7. **Navigation** -- No way to switch between dashboard/findings/scans without going back to sidebar
8. **Empty/error states** -- No first-run experience, no "no scans yet" state

### 1.3 Design Philosophy: Mock as Production

Unlike the Kitchen Sink (which is permanently dev-only), the mock is the production application built with hardcoded data. The Kitchen Sink pattern (dev-only context, hardcoded data, error boundaries) informs the development approach, but the mock's components, types, and file structure are designed as the real thing.

**Key principle:** Every component, type, and view built for the mock will be the production component. The only change when connecting the backend is replacing hardcoded data imports with props sourced from extension host messages. No "mock-to-production migration" step -- the mock IS production, just with fake data.

## 2. Design Constraints

### 2.1 VS Code Webview Constraints

- **No URL routing** -- webviews don't have a URL bar. Navigation must be state-driven.
- **Panel title is extension-controlled** -- the webview can't change the editor tab title dynamically.
- **Two surface shapes** -- sidebar (narrow, ~280px) and editor panel (full-width, any height).
- **CSS variables for theming** -- `--vscode-*` variables provide the active theme. Components must adapt.
- **No persistent state** -- webview is destroyed when panel closes (no `retainContextWhenHidden` for sidebar). State must be re-fetched on mount.

### 2.2 Design Principles

- **Extension host owns state** -- the webview is a pure renderer. During the mock phase, data is hardcoded in the webview; when the backend connects, the same components receive data via props from the App.tsx reducer (fed by postMessage).
- **Single React app, multiple contexts** -- one Vite build, context determined by init message.
- **Mock evolves to production** -- the mock is not a throwaway prototype. Components, types, and file locations are production-grade from day one. The only change is the data source.
- **VS Code-native patterns** -- breadcrumb navigation, tree views for hierarchy, detail panels for content. No heavy custom navigation frameworks.
- **Iterative disclosure** -- show summary first, let users drill into detail. Don't overwhelm.

## 3. Navigation Hierarchy

### 3.1 Real App Navigation Model

In the production app, navigation is driven by the extension host:

```
Sidebar (always visible)
  WebView: SidebarDashboard (compact summary + actions)
  Tree View: Scan History (native VS Code tree, clickable items)

Editor Panel (opens on demand, one view at a time)
  Dashboard View ← "Open Workbench" command
  Finding List   ← Click "View Findings" or click a scan in tree
  Finding Detail ← Click a finding row
  Scan Progress  ← Automatically shown during active scan
```

The editor panel has no tabs. View transitions happen through:
- Extension host messages (sidebar action pushes a view)
- Local dispatch (SELECT_FINDING, BACK_TO_LIST)
- Breadcrumb back-navigation

### 3.2 Expanded Editor Panel Navigation

The production `editorPanel` context is expanded from two views (findingList, findingDetail) to a full view system. The App.tsx `ViewState` type grows to encompass all application views:

```
editorPanel views:
  dashboard       ← Default when opening workbench
  findings        ← Finding list with filters + batch
  findingDetail   ← Full triage workspace
  scanHistory     ← Scan management
  scanProgress    ← Active scan monitoring
  empty           ← First-run / no-data states
```

During the mock phase, a **development-only view selector** (a simple nav bar at the top of the editor panel) lets developers quickly switch between all views without needing the sidebar or extension host to drive navigation. This dev nav is stripped when the backend connects and real navigation takes over.

```
Editor Panel (editorPanel context)
  ┌─────────────────────────────────────┐
  │ [Dev Nav: view selector bar]         │  ← dev-only, removed in production
  ├─────────────────────────────────────┤
  │                                     │
  │    Content Area                     │
  │    (selected view)                  │
  │                                     │
  └─────────────────────────────────────┘
```

### 3.3 Complete View Inventory

| # | View | Context | Component | Description |
|---|---|---|---|---|
| 1 | Sidebar Dashboard | sidebar | `SidebarDashboard` | Compact summary for sidebar panel |
| 2 | Project Dashboard | editorPanel | `DashboardView` | Project overview with scan summary and triage progress |
| 3 | Finding List | editorPanel | `FindingsView` | Filterable/sortable finding table with batch controls |
| 4 | Finding Detail | editorPanel | `FindingDetailView` | Full triage workspace: disposition, code, AI, suppression |
| 5 | Scan History | editorPanel | `ScanHistoryView` | All scans with metadata, actions, and active scan progress |
| 6 | Scan Progress | editorPanel | `ScanProgressView` | Active scan monitoring with scanner-level progress |
| 7 | Empty State | editorPanel | `EmptyStateView` | First-run experience: no project, no scans |

All components are production components. During mock phase they import hardcoded data; in production they receive data as props from the App.tsx reducer.

## 4. Detailed Page Layouts

### 4.1 Sidebar Dashboard (Compact)

**Purpose:** Quick-glance project health and primary actions. Always visible in the sidebar.

**Width:** ~280px (VS Code sidebar default)

**Layout (top to bottom):**

```
PROJECT HEADER
  Project name (h2, semibold)
  Workspace path (xs, muted)

PRIMARY ACTION
  [Run Scan] button (full-width, primary variant)

────── separator ──────

ACTIVE SCAN (conditional - shown when scan is running)
  "Scanning..." label with spinner icon
  Elapsed time counter
  [Cancel] button (destructive variant, sm)

────── separator ──────

TRIAGE SUMMARY
  Section label: "Triage Summary" (xs, uppercase, tracking-wide)
  Badge row (flex-wrap):
    [PENDING: 8] gray
    [FIX: 4] green
    [SUPPRESS: 2] purple
    [DEFER: 2] amber
  Progress text: "8 of 18 findings triaged (44%)"

────── separator ──────

SEVERITY BREAKDOWN
  Section label: "Severity" (xs, uppercase, tracking-wide)
  Badge row (flex-wrap):
    [CRITICAL: 2] red
    [HIGH: 4] orange
    [MEDIUM: 6] yellow
    [LOW: 4] blue
    [INFO: 2] gray
  (Only shows non-zero counts)

────── separator ──────

RECENT SCANS
  Section label: "Recent Scans" (xs, uppercase, tracking-wide)
  Compact scan list (last 3):
    Icon + date + finding count, one per line
    ✓ green = completed
    ✗ red = failed
    ⟳ animated = running
  Each item is clickable (opens findings in editor)

────── separator ──────

ACTIONS
  [View All Findings] button (secondary, full-width)
```

**New vs Current:**
- Adds: Active scan indicator, recent scans list, triage progress text, conditional sections
- Changes: Better spacing, section labels consistent with the rest of the app
- Reuses: `SeverityBadge`, `DispositionBadge`, `Button`, `Badge`, `Separator`

### 4.2 Project Dashboard

**Purpose:** At-a-glance project health. The default view when opening the workbench editor panel.

**Trigger:** User runs "ASH: Open Workbench" command, or no scan is selected.

**Layout:**

```
HEADER BAR (sticky, h-12)
  Breadcrumb: "ASH Workbench"
  Right: [Run Scan] button

──────────────────────────────────

CONTENT (scrollable, p-4, max-w-5xl, flex flex-col gap-6)

  ROW 1: Summary Cards (grid, 2 columns on md+, 1 on sm)

    CARD: Project Info
      Title: project name
      Body:
        Workspace path (mono, muted, truncated)
        Total scans count
        Last scan date + status
        "Created: [date]"

    CARD: Latest Scan
      Title: "Latest Scan"
      Body:
        Date + time
        Status badge (✓ Completed / ✗ Failed / ⟳ Running)
        Duration (e.g., "5m 22s")
        Finding count
        Severity mini-badges: [C:2][H:4][M:6][L:4][I:2]
      Footer:
        [View Findings] link-button

  ROW 2: Triage Progress

    CARD: Triage Progress (full-width)
      Title: "Triage Progress"
      Body:
        Progress bar (segmented by disposition color):
          Green (FIX) + Purple (SUPPRESS) + Amber (DEFER) + Gray (PENDING)
        Stats row below bar:
          "10 of 18 triaged (56%)"
          "8 pending attention"
        Badge summary row:
          [PENDING: 8] [FIX: 4] [SUPPRESS: 2] [DEFER: 2]

  ROW 3: Severity Distribution

    CARD: Severity Distribution (full-width)
      Title: "Severity Distribution"
      Body:
        Horizontal bar chart (one bar per severity level):
          CRITICAL ████████       2 (11%)     red-700
          HIGH     ████████████   4 (22%)     orange-600
          MEDIUM   ████████████████ 6 (33%)   yellow-600
          LOW      ████████████   4 (22%)     blue-600
          INFO     ████████       2 (11%)     gray-500
        (Each bar is a div with percentage width, bg-color, rounded)

  ROW 4: Quick Actions

    Horizontal button row:
      [Run New Scan] primary
      [View All Findings] secondary
      [Scan History] secondary/outline
```

**Components needed:**
- New: `SummaryCard` (reusable card with title/body/footer)
- New: `TriageProgressBar` (segmented progress bar)
- New: `SeverityDistributionChart` (horizontal bars)
- Reuse: `Card`, `Badge`, `Button`, `SeverityBadge`, `DispositionBadge`

### 4.3 Finding List

**Purpose:** Browse, filter, and batch-triage findings. The primary working view.

**Trigger:** User clicks "View Findings" from sidebar/dashboard, or clicks a scan in history.

**Layout:**

```
HEADER BAR (sticky, h-12)
  Breadcrumb: "ASH Workbench > Findings"
  Scan context: "Scan: Mar 12, 2:30 PM" (or "All Findings")
  Right: [Run Scan] button

──────────────────────────────────

FILTER TOOLBAR (sticky below header, border-b, py-2, px-4)

  Row 1: Severity toggle chips
    Label: "Severity:"
    Chips: [CRITICAL] [HIGH] [MEDIUM] [LOW] [INFO]
    (toggle on/off, active = filled, inactive = outline + opacity-30)

  Row 2: Disposition toggle chips
    Label: "Status:"
    Chips: [PENDING] [FIX] [SUPPRESS] [DEFER]
    (same toggle pattern)

  Row 3: Additional filters
    Scanner dropdown: [All Scanners ▾]
    File search input: [Search files... 🔍]

  STATS BAR (flex justify-between, text-xs, muted)
    Left: "18 total · 14 shown"
    Right: "8 pending · 4 fix · 2 suppress · 2 defer"

──────────────────────────────────

FINDINGS TABLE (flex-1, overflow-auto)

  Table header:
    [ ☐ ] Select all checkbox
    Severity (w-20, sortable)
    Title (flex-1, sortable)
    File (w-48, sortable)
    Scanner (w-24, sortable)
    Disposition (w-24, sortable)
    Actions (w-12)

  Table rows (clickable, hover highlight):
    [ ☐ ] Row checkbox
    [CRITICAL] SeverityBadge
    "Hard-coded AWS access key" (truncate, font-medium)
    "src/config/aws.ts:15" (mono, xs, muted, truncate)
    "detect-secrets" (xs)
    [PENDING] DispositionBadge
    [...] Dropdown (Quick triage: Fix/Suppress/Defer)

  Empty state (when filters exclude everything):
    Centered: "No findings match the current filters"
    [Clear Filters] button

──────────────────────────────────

BATCH ACTION BAR (sticky bottom, shown when rows selected, border-t, py-2, px-4)
  Left: "3 findings selected"
  Right: [Set Disposition ▾] dropdown (PENDING/FIX/SUPPRESS/DEFER)
  Right: [Deselect All]

PAGINATION (if > 50 findings)
  "Page 1 of 2" with Previous/Next buttons
```

**Key differences from current FindingList:**
- Adds: checkbox column, batch actions bar, pagination, stats bar, file search input, sortable columns, per-row action dropdown
- Changes: filter toggles use consistent chip pattern for both severity and disposition
- Reuses: `Table`, `Badge`, `SeverityBadge`, `DispositionBadge`, `Button`, `Checkbox`, `Input`, `DropdownMenu`, `Select`

**Table implementation:** Use `@tanstack/react-table` (already a dependency from the Tasks demo). This gives us sorting, filtering, row selection, and pagination for free.

### 4.4 Finding Detail

**Purpose:** The primary triage workspace. View a finding's full context, make a triage decision, review AI analysis, and configure suppression.

**Trigger:** User clicks a finding row in the list.

**Layout:**

```
HEADER BAR (sticky, h-12)
  Breadcrumb: "Findings > Hard-coded AWS access key"
  Left: [← Back] button (returns to list)
  Right: [Previous Finding] [Next Finding] navigation arrows

──────────────────────────────────

CONTENT (scrollable, p-4, max-w-4xl, flex flex-col gap-6)

  SECTION 1: Finding Header
    Row 1: [CRITICAL] badge + "Hard-coded AWS access key" (text-lg, semibold)
    Row 2: Metadata chips (text-xs, muted):
      Rule: `AWSKeyDetector` (code style)
      Scanner: detect-secrets
      First detected: Mar 12, 2026
      Scan: Mar 12, 2:30 PM

  ══════ separator ══════

  SECTION 2: Disposition Controls
    Section label: "TRIAGE DECISION" (xs, uppercase, tracking-wide)

    Button group (4 buttons, horizontal):
      [PENDING]  gray,   active = filled + ring
      [FIX]      green,  active = filled + ring
      [SUPPRESS] purple, active = filled + ring
      [DEFER]    amber,  active = filled + ring
    (Clicking a button immediately sets the disposition)

    Triage Notes (optional, collapsible):
      Label: "Notes" with expand/collapse toggle
      Textarea (2-3 lines):
        Placeholder: "Add notes about this triage decision..."
      Character count: "0 / 500"
      (Notes persist with the finding)

  ══════ separator ══════

  SECTION 3: Description
    Section label: "DESCRIPTION" (xs, uppercase, tracking-wide)
    Body text (text-sm):
      "A hard-coded AWS access key was detected. This could allow
       unauthorized access to AWS resources if the source code is exposed."

  ══════ separator ══════

  SECTION 4: Code Location
    Section label: "LOCATION" (xs, uppercase, tracking-wide)

    File link row:
      📄 icon + clickable file path (link color, underline):
        "src/config/aws.ts"
      Line range: "Line 15" (or "Lines 15-17")
      [Open in Editor] button (ghost, sm)

    Code block (pre, mono, rounded, bordered):
      Line numbers on left (muted):
        14 │
        15 │ const ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
        16 │
      Background: var(--vscode-textCodeBlock-background)
      Highlighted line (15): subtle background tint

  ══════ separator ══════

  SECTION 5: AI Analysis (future-ready, shown with mock data)
    Section label: "AI ANALYSIS" (xs, uppercase, tracking-wide)
    Powered by badge: "⚡ Claude" (xs, muted)

    Card with sections:

      EXPLANATION
        "This finding detects a literal AWS access key ID
         (AKIA...) embedded directly in source code. Hard-coded
         credentials pose a significant risk because..."
        (2-3 paragraphs of plain-language explanation)

      ────── inner separator ──────

      RISK ASSESSMENT
        Severity rationale:
          "● Exploitability: HIGH -- The key can be extracted by
             anyone with read access to the repository."
          "● Impact: HIGH -- An AWS access key provides programmatic
             access to AWS services scoped to the key's IAM policy."
          "● Likelihood: MEDIUM -- Depends on repository access controls."

      ────── inner separator ──────

      SUGGESTED FIX
        Explanation text:
          "Replace the hard-coded key with an environment variable
           or AWS Secrets Manager reference:"

        Code diff block (pre, mono, rounded):
          ```diff
          - const ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
          + const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
          ```

        Action buttons:
          [Apply Fix] primary, sm (would apply the diff)
          [Copy Fix] secondary, sm
          [Regenerate] ghost, sm

      ────── inner separator ──────

      REFERENCES
        Bulleted list of links (would be real URLs in production):
          "● AWS Security Best Practices: Managing Access Keys"
          "● CWE-798: Use of Hard-coded Credentials"
          "● OWASP: Credential Management Cheat Sheet"

  ══════ separator ══════

  SECTION 6: Suppression (conditional -- shown when disposition = SUPPRESS)
    Section label: "SUPPRESSION" (xs, uppercase, tracking-wide)

    Alert/info box:
      "This finding is marked for suppression. Provide a justification
       to document the risk acceptance decision."

    Justification textarea:
      Label: "Justification" (required indicator)
      Textarea (3-4 lines):
        Placeholder: "Explain why this finding is acceptable..."
      Example: "This is a test/demo access key used only in the
                development environment. It has no permissions and
                is rotated weekly."

    ASH Suppression Entry Preview:
      Label: ".ash.yaml entry"
      Code block (pre, mono, rounded, readonly):
        ```yaml
        suppressions:
          - rule_id: AWSKeyDetector
            file: src/config/aws.ts
            reason: "Test key for development environment"
            expires: 2026-06-12  # 90-day review
        ```

      Action buttons:
        [Copy to Clipboard] secondary, sm
        [Generate Entry] primary, sm (would create the file)
```

**New components needed:**
- `TriageControls` -- disposition button group with active state
- `TriageNotes` -- collapsible textarea for triage annotations
- `CodeBlock` -- line-numbered code display with highlighting
- `AiAnalysisPanel` -- expandable AI analysis card with sub-sections
- `SuppressionPanel` -- justification + yaml preview
- `FindingNavigation` -- previous/next arrows for stepping through findings

**Reuse from existing:** `SeverityBadge`, `DispositionBadge`, `Button`, `Separator`, `Card`, `Textarea`, `Badge`, `Alert`

### 4.5 Scan History

**Purpose:** View all scans, manage scan lifecycle, launch new scans.

**Trigger:** User clicks "Scan History" from dashboard or navigates via breadcrumb.

**Layout:**

```
HEADER BAR (sticky, h-12)
  Breadcrumb: "ASH Workbench > Scans"
  Right: [Run New Scan] button (primary)

──────────────────────────────────

CONTENT (scrollable, p-4, max-w-5xl, flex flex-col gap-4)

  ACTIVE SCAN CARD (conditional -- shown when a scan is running)
    Card with accent border (primary color):
      Header: "Active Scan" with animated spinner icon
      Body:
        Target: "/src"
        Elapsed: "2:15" (live counter)
        Progress bar (indeterminate or percentage if available)
        Scanner status list (compact):
          ✓ detect-secrets (0.8s)
          ✓ bandit (1.2s)
          ⟳ checkov (running...)
          ⟳ semgrep (running...)
          ○ cdk-nag (queued)
          ○ cfn-nag (queued)
          ○ grype (queued)
          ○ npm-audit (queued)
      Footer:
        [Cancel Scan] button (destructive variant)

  ────── separator (only if active scan shown) ──────

  SCAN HISTORY LIST
    Section label: "Completed Scans" (text-sm, semibold)

    Card list (vertical stack, gap-3):

      SCAN CARD (for each scan):
        Left section:
          Status icon: ✓ green (completed) / ✗ red (failed) / ○ gray (cancelled)
          Date + time (font-medium)
          Duration badge: "5m 22s" (muted)
        Center section:
          Source directory: "/src" (mono, xs)
          Finding count: "18 findings"
          Severity mini-badges: [C:2][H:4][M:6][L:4][I:2]
        Right section:
          [View Findings] button (secondary, sm)
          [Delete] button (ghost, sm, with confirmation dialog)

      FAILED SCAN CARD (variant):
        Status icon: ✗ red
        Error message in muted text:
          "Error: ASH CLI not found at /usr/local/bin/ash"
        [Delete] button only (no "View Findings")

      CANCELLED SCAN CARD (variant):
        Status icon: ○ gray
        "Cancelled by user" text
        [Delete] button only

  EMPTY STATE (when no scans exist):
    Centered card:
      Icon: shield or scan icon
      Title: "No scans yet"
      Body: "Run your first security scan to detect vulnerabilities"
      [Run Scan] button (primary)
```

**Components needed:**
- `ScanCard` -- reusable card for a single scan with status variants
- `ActiveScanCard` -- variant with progress bar and scanner list
- `ScannerProgressList` -- list of scanners with completion status

### 4.6 Scan Progress (Inline View)

**Purpose:** Full-screen scan monitoring during an active scan. Shown automatically when user initiates a scan from the editor panel.

**Trigger:** Scan initiated from editor panel context.

**Layout:**

```
HEADER BAR (sticky, h-12)
  Breadcrumb: "ASH Workbench > Scanning..."
  Right: [Cancel Scan] button (destructive)

──────────────────────────────────

CONTENT (centered, max-w-lg, flex flex-col items-center gap-6, py-12)

  SCAN ICON
    Large shield icon with animated pulse/scan effect (64px)

  TITLE
    "Security Scan in Progress" (text-xl, semibold)

  TARGET INFO
    "Scanning: /src" (muted)
    "Mode: local" (muted)

  ELAPSED TIME
    "Elapsed: 2:15" (text-2xl, mono, font-light)
    (Live counter, updates every second)

  PROGRESS BAR
    Full-width, indeterminate animation
    (If ASH provides percentage, show determinate progress)

  SCANNER STATUS
    Card with scanner checklist:
      ✓ detect-secrets       0.8s    (green check)
      ✓ bandit               1.2s    (green check)
      ⟳ checkov             running  (animated spinner)
      ⟳ semgrep            running  (animated spinner)
      ○ cdk-nag             queued   (gray circle)
      ○ cfn-nag             queued   (gray circle)
      ○ grype               queued   (gray circle)
      ○ npm-audit           queued   (gray circle)

  CANCEL BUTTON
    [Cancel Scan] (destructive, centered)

  LOG OUTPUT (collapsible)
    Label: "Scanner Output" with expand toggle
    Scrollable text area showing stdout/stderr (mono, xs)
```

### 4.7 Empty/First-Run States

**Purpose:** Guide new users through setup when no project or scans exist.

**Empty Dashboard (no scans):**
```
Centered card (max-w-md):
  Shield icon (48px, muted)
  Title: "Welcome to ASH Workbench"
  Body: "Run your first security scan to detect vulnerabilities
         in your codebase."
  Steps:
    1. Ensure ASH CLI is installed
    2. Click "Run Scan" to analyze your code
    3. Review and triage findings
  [Run First Scan] button (primary, lg)
  [Configure Settings] link (muted)
```

**Empty Finding List (scan completed, zero findings):**
```
Centered card (max-w-md):
  Checkmark icon (48px, green)
  Title: "No Findings"
  Body: "No security issues were detected in this scan."
  [Return to Dashboard] button (secondary)
```

**Error State (scan failed):**
```
Centered card (max-w-md):
  Alert icon (48px, destructive)
  Title: "Scan Failed"
  Body: error message from ASH CLI
  [View Logs] link
  [Try Again] button (primary)
  [Check Settings] link (muted)
```

## 5. Implementation Architecture

### 5.1 Expanding the `editorPanel` Context

The mock uses the existing `editorPanel` context -- not a new context. The App.tsx `ViewState` type expands from 3 views to 7:

```
App.tsx context routing (unchanged):
  'unknown'     -> Loading spinner
  'sidebar'     -> SidebarDashboard
  'editorPanel' -> View router (expanded)
  'sink'        -> SinkPage

editorPanel ViewState (expanded):
  'loading'        -> Loading spinner (existing)
  'dashboard'      -> DashboardView          NEW
  'findingList'    -> FindingsView           REPLACES current FindingList
  'findingDetail'  -> FindingDetailView      REPLACES current FindingDetail
  'scanHistory'    -> ScanHistoryView        NEW
  'scanProgress'   -> ScanProgressView       NEW
  'empty'          -> EmptyStateView         NEW
```

During mock development, a `DevNav` component renders at the top of the editor panel to let developers switch between views directly. This component is conditionally rendered (e.g., based on a `__DEV__` flag or the presence of mock data) and will be removed when real navigation is wired up.

The existing `FindingsPanelManager` on the extension host side continues to work -- it sends `init` with `context: 'editorPanel'` and the expanded view state handles the rest.

### 5.2 File Structure

Components are built in their production locations from day one. No `pages/mock/` staging area.

```
webview/src/
  App.tsx                     # Expanded ViewState + reducer (modified)
  mock-data.ts                # Hardcoded data (temporary, removed when backend connects)
  types/
    types.ts                  # Extended with AiAnalysis, SuppressionData, notes, etc.
    messages.ts               # Extended with new message types
  components/
    SidebarDashboard.tsx      # Enhanced (Section 4.1)
    DashboardView.tsx         # NEW: Project overview (Section 4.2)
    FindingsView.tsx          # NEW: Replaces FindingList (Section 4.3)
    FindingDetailView.tsx     # NEW: Replaces FindingDetail (Section 4.4)
    ScanHistoryView.tsx       # NEW: Scan management (Section 4.5)
    ScanProgressView.tsx      # NEW: Active scan monitoring (Section 4.6)
    EmptyStateView.tsx        # NEW: First-run / empty states (Section 4.7)
    DevNav.tsx                # NEW: Dev-only view selector (temporary)
    SummaryCard.tsx           # NEW: Reusable stat card
    TriageProgressBar.tsx     # NEW: Segmented triage progress
    SeverityChart.tsx         # NEW: Horizontal severity bars
    TriageControls.tsx        # NEW: Disposition button group
    TriageNotes.tsx           # NEW: Collapsible notes textarea
    CodeBlock.tsx             # NEW: Line-numbered code display
    AiAnalysisPanel.tsx       # NEW: AI analysis card
    SuppressionPanel.tsx      # NEW: Suppression justification + yaml
    ScanCard.tsx              # NEW: Scan history card
    ScannerProgress.tsx       # NEW: Scanner checklist with status
    FindingNavigation.tsx     # NEW: Previous/next finding arrows
    SeverityBadge.tsx         # Existing (unchanged)
    DispositionBadge.tsx      # Existing (unchanged)
    ui/                       # Existing ShadCN primitives (unchanged)
  pages/
    sink/                     # Existing Kitchen Sink (unchanged)
```

The old `FindingList.tsx` and `FindingDetail.tsx` are replaced by `FindingsView.tsx` and `FindingDetailView.tsx`. This is a clean replacement, not a parallel copy.

### 5.3 Expanded App State Machine

The existing App.tsx `AppState` and reducer grow to support the full view inventory:

```typescript
type ViewState =
  | 'loading'
  | 'dashboard'
  | 'findingList'
  | 'findingDetail'
  | 'scanHistory'
  | 'scanProgress'
  | 'empty';

interface AppState {
  context: 'sidebar' | 'editorPanel' | 'sink' | 'unknown';
  view: ViewState;
  scanId: string | undefined;
  scans: ScanSummary[];
  summary: DispositionSummary;
  findings: FindingRow[];
  selectedFinding: FindingRow | undefined;
  // New fields for expanded navigation:
  viewHistory: ViewState[];              // Stack for back-navigation
}
```

New reducer actions:
- `NAVIGATE` -- push current view to history, switch to target view
- `SELECT_SCAN` -- set scanId, navigate to findingList
- `SELECT_FINDING` -- set finding, navigate to findingDetail
- `BACK` -- pop viewHistory, return to previous view
- `BACK_TO_LIST` -- (existing) shortcut back to findingList

During mock phase, the reducer also handles mock-specific data mutations (e.g., updating disposition in local state). These handlers are replaced by postMessage calls when the backend connects.

### 5.4 Data Model: Types Added to `types.ts`

New types are added directly to `webview/src/types/types.ts` (and mirrored to `vsix/src/models/types.ts`). These are production types, not mock-only extensions.

**Extended `FindingRow`:**

```typescript
export interface FindingRow {
  // Existing fields (unchanged):
  id: string;
  scanId: string;
  title: string;
  description: string;
  severity: Severity;
  disposition: Disposition;
  scanner: string;
  ruleId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  // New fields:
  notes: string;                         // Triage annotation text
  firstDetectedAt: string;               // ISO date string
  aiAnalysis: AiAnalysis | null;         // AI-generated analysis (nullable)
  suppression: SuppressionData | null;   // Suppression details (nullable)
}
```

**New `AiAnalysis` type:**

```typescript
export interface AiAnalysis {
  explanation: string;                   // Plain-language vulnerability explanation
  riskAssessment: RiskAssessment;        // Structured risk breakdown
  suggestedFix: SuggestedFix | null;     // Code fix suggestion (nullable)
  references: AiReference[];             // External reference links
}

export interface RiskAssessment {
  exploitability: RiskLevel;
  exploitabilityRationale: string;
  impact: RiskLevel;
  impactRationale: string;
  likelihood: RiskLevel;
  likelihoodRationale: string;
}

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface SuggestedFix {
  description: string;                   // What the fix does
  diffText: string;                      // Unified diff format
  language: string;                      // Language for syntax highlighting
}

export interface AiReference {
  title: string;
  url: string;                           // Could be CWE, OWASP, vendor docs
}
```

**New `SuppressionData` type:**

```typescript
export interface SuppressionData {
  justification: string;                 // Why this finding is acceptable
  yamlEntry: string;                     // Generated .ash.yaml suppression entry
  expiresAt: string | null;              // ISO date for review deadline (nullable)
  createdAt: string;                     // When suppression was created
}
```

### 5.4.1 Mock Data Module

`webview/src/mock-data.ts` contains all hardcoded data for the mock phase. This file is temporary -- it will be deleted when the backend connects and real data flows through postMessage.

```typescript
import type { Project, ScanSummary, FindingRow, DispositionSummary, AiAnalysis, SuppressionData } from './types/types';

export const mockProject: Project;
export const mockScans: ScanSummary[];             // 4 scans (completed x2, failed, running)
export const mockFindings: FindingRow[];            // 18+ findings with full data including AI + suppression
export const mockSummary: DispositionSummary;       // Computed from findings

// Helper for mock-phase state mutations (replaced by postMessage in production)
export function updateMockDisposition(findingId: string, disposition: Disposition): FindingRow | undefined;
export function updateMockNotes(findingId: string, notes: string): FindingRow | undefined;
```

The mock data is ported from `vsix/src/mock/data.ts` and extended with the new fields (`notes`, `firstDetectedAt`, `aiAnalysis`, `suppression`). AI analysis mock data is provided for 3-4 key findings to demonstrate the panel; the rest have `aiAnalysis: null`.

### 5.5 Component Reuse Strategy

| Component | Source | Mock Usage |
|---|---|---|
| `SeverityBadge` | Existing (`components/`) | All views |
| `DispositionBadge` | Existing (`components/`) | All views |
| `Badge`, `Button`, `Card`, `Table` | Existing (`components/ui/`) | All views |
| `Separator`, `Input`, `Select` | Existing (`components/ui/`) | Filter bars, forms |
| `Checkbox`, `DropdownMenu` | Existing (`components/ui/`) | Finding list |
| `Progress` | Existing (`components/ui/`) | Dashboard, scan progress |
| `Tabs` | Existing (`components/ui/`) | View selector (if using tabs pattern) |
| `Textarea` | Existing (`components/ui/`) | Triage notes, suppression justification |
| `Alert` | Existing (`components/ui/`) | Error states, suppression info |
| `Dialog` | Existing (`components/ui/`) | Delete confirmation |
| `Tooltip` | Existing (`components/ui/`) | Icon buttons, truncated text |
| `Skeleton` | Existing (`components/ui/`) | Loading states |
| `Accordion` | Existing (`components/ui/`) | Collapsible sections in detail view |
| `Switch` | Existing (`components/ui/`) | Toggle sidebar preview |

All 19 ShadCN primitives and 3 existing app-specific components from the sink get exercised in realistic production contexts. The new components (TriageControls, CodeBlock, AiAnalysisPanel, etc.) are built directly in `components/` alongside these existing ones.

### 5.6 New ShadCN Components Needed

Before implementing the mock, these additional ShadCN components should be installed:

| Component | Purpose |
|---|---|
| `scroll-area` | Scrollable containers for scan list, finding list |
| `breadcrumb` | Navigation breadcrumbs in header |
| `toggle-group` | Severity/disposition filter chips (better than custom Badge toggles) |
| `collapsible` | Triage notes, scanner output, AI sections |
| `sheet` | Mobile-friendly sidebar overlay (optional) |
| `sonner` / `toast` | Action feedback (disposition changed, scan started) |

These are optional for the mock but recommended. The mock can use existing components with custom styling as a fallback.

## 6. Data Flow Comparison

### 6.1 Production App

```
Extension Host (owns state)
  │
  ├── postMessage: init → WebView sets context
  ├── postMessage: stateUpdate → WebView renders dashboard
  ├── postMessage: findingsUpdate → WebView renders list
  └── postMessage: findingDetail → WebView renders detail

WebView (pure renderer)
  │
  ├── postMessage: requestState → Extension fetches from DB
  ├── postMessage: setDisposition → Extension updates DB
  └── postMessage: navigateToCode → Extension opens editor
```

### 6.2 Mock Phase (Hardcoded Data)

```
App.tsx reducer (manages navigation + mock data)
  │
  ├── import: mock-data.ts -> All data available at import time
  ├── useReducer: AppState -> Manages views, selection, and data
  ├── local handlers: setDisposition -> Updates local state copy
  └── components receive data as props from AppState (same as production)
```

Components never import mock data directly. They receive data as props from App.tsx, exactly as they will in production. Only App.tsx (or a data-provider layer) knows the data is hardcoded. This means:
- View components are already production-ready
- No component code changes when the backend connects
- The switch happens entirely in the data layer

### 6.3 Transition: Mock to Production

The transition is minimal because components are already in production locations with production interfaces:

1. **Delete `mock-data.ts`** -- remove the hardcoded data file
2. **Update App.tsx reducer** -- replace mock data initialization with `requestState` / postMessage flow (the MESSAGE action handlers already exist for `stateUpdate`, `findingsUpdate`, etc.)
3. **Add new message types** -- extend `ExtToWebviewMessage` for new views (dashboard data, scan history, AI analysis)
4. **Wire postMessage calls** -- components already call action handlers; redirect these to `postMessage()` instead of local state mutations

No components move. No types change. No file restructuring.

## 7. Visual Design Notes

### 7.1 Color System

All colors derive from VS Code theme variables. Application-specific colors:

| Purpose | Light | Dark | Token |
|---|---|---|---|
| Critical severity | `red-700` | `red-700` | Direct Tailwind |
| High severity | `orange-600` | `orange-600` | Direct Tailwind |
| Medium severity | `yellow-600` | `yellow-600` | Direct Tailwind |
| Low severity | `blue-600` | `blue-600` | Direct Tailwind |
| Info severity | `gray-500` | `gray-500` | Direct Tailwind |
| Pending disposition | `gray-500` | `gray-500` | Direct Tailwind |
| Fix disposition | `green-600` | `green-600` | Direct Tailwind |
| Suppress disposition | `purple-600` | `purple-600` | Direct Tailwind |
| Defer disposition | `amber-600` | `amber-600` | Direct Tailwind |
| AI analysis accent | `blue-500` | `blue-400` | Custom |
| Code diff added | `green-900/20` | `green-500/20` | Custom |
| Code diff removed | `red-900/20` | `red-500/20` | Custom |

Note: The existing severity and disposition colors use hardcoded Tailwind classes (`bg-red-700 text-white`) which work in both light and dark themes because they're absolute colors, not theme-relative. This is intentional -- security severity should have consistent, recognizable colors regardless of theme.

### 7.2 Typography

All text inherits from VS Code theme variables (`--vscode-font-family`, `--vscode-font-size`). Additional:

| Element | Size | Weight | Class |
|---|---|---|---|
| Page title | text-lg | semibold | `text-lg font-semibold` |
| Section label | text-xs | semibold, uppercase | `text-xs font-semibold uppercase tracking-wide opacity-70` |
| Body text | text-sm | normal | `text-sm` |
| Muted text | text-xs | normal | `text-xs opacity-70` |
| Code | text-xs | mono | `text-xs font-mono` |
| Badge text | text-xs | medium | Inherited from Badge component |

### 7.3 Spacing

Consistent spacing using Tailwind's scale:

| Context | Padding | Gap |
|---|---|---|
| Page content | `p-4` | `gap-6` |
| Card content | `p-4` | `gap-3` |
| Section within page | -- | `gap-4` |
| Sidebar content | `p-3` | `gap-3` |
| Filter bar | `py-2 px-4` | `gap-2` |
| Badge row | -- | `gap-1.5` |
| Button row | -- | `gap-2` |

### 7.4 Layout Patterns

| Pattern | Implementation |
|---|---|
| Sticky header | `sticky top-0 z-10 border-b bg-[var(--background)]` |
| Scrollable content | `flex-1 overflow-y-auto` |
| Card grid | `grid grid-cols-1 md:grid-cols-2 gap-4` |
| Full-width card | `w-full` on the card |
| Centered empty state | `flex items-center justify-center min-h-[400px]` |
| Sidebar + content | `flex` with sidebar `w-72 border-r` and content `flex-1` |

## 8. Resolved Design Decisions

All questions from the initial research have been resolved. These decisions are authoritative for implementation.

### 8.1 Architecture

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Separate `mock` context or use `editorPanel`? | **Use `editorPanel`** | The mock evolves into the production app. Using the same context means components, state machine, and navigation are production-grade from day one. No migration step. |
| 2 | Mock in `pages/mock/` or replace existing components? | **Replace existing** | The mock IS the production app. New view components (`FindingsView`, `FindingDetailView`, etc.) replace the current `FindingList` and `FindingDetail` directly in `components/`. No parallel directory. |
| 3 | Shared components in `components/` or staging area? | **Directly in `components/`** | Since the mock is production code, all new components (TriageControls, CodeBlock, AiAnalysisPanel, etc.) go straight to `components/`. No staging, no promotion step. |

### 8.2 Data Model

| # | Question | Decision | Rationale |
|---|---|---|---|
| 4 | Extend `FindingRow` now or use mock-local type? | **Extend `types.ts` now** | New fields (`notes`, `firstDetectedAt`, `aiAnalysis`, `suppression`) are added to the shared `FindingRow` type immediately. Both `webview/src/types/types.ts` and `vsix/src/models/types.ts` are updated. No temporary mock types. |
| 5 | Define `AiAnalysis` type? | **Yes, define now** | Full type definition in `types.ts`: `AiAnalysis`, `RiskAssessment`, `RiskLevel`, `SuggestedFix`, `AiReference`. See Section 5.4 for complete type definitions. |
| 6 | Define `SuppressionData` type? | **Yes, define now** | Full type definition in `types.ts`: `SuppressionData` with justification, yamlEntry, expiresAt, createdAt. See Section 5.4 for complete type definitions. |

### 8.3 UI/UX

| # | Question | Decision | Rationale |
|---|---|---|---|
| 7 | Batch operations with TanStack Table? | **Use TanStack row selection** | The Tasks demo (`pages/sink/demos/tasks-demo.tsx`) already implements the checkbox + row selection pattern. Apply the same approach to the findings table with a batch action bar that appears when rows are selected. |
| 8 | AI analysis panel collapsible or always visible? | **Collapsible, collapsed by default** | Implemented as an accordion section. Keeps the triage decision area (disposition + notes) above the fold. Users expand the AI panel when they want deeper context. |
| 9 | Finding navigation based on filtered or all findings? | **Filtered list** | Previous/next arrows step through findings as they appear in the current filter view. If a user filters to "HIGH severity only", the arrows skip non-HIGH findings. |

## 9. Recommended Implementation Plan

### Phase 1: Foundation -- Types, data, and state machine

1. **Extend types** -- Add `AiAnalysis`, `SuppressionData`, `RiskAssessment`, and new `FindingRow` fields to `webview/src/types/types.ts` and `vsix/src/models/types.ts`
2. **Create mock-data.ts** -- Port existing mock data from `vsix/src/mock/data.ts` to `webview/src/mock-data.ts`, extend with new fields (notes, AI analysis, suppression data)
3. **Expand App.tsx state machine** -- Add new `ViewState` values (`dashboard`, `scanHistory`, `scanProgress`, `empty`), add `viewHistory` stack, add `NAVIGATE` / `BACK` actions
4. **Build DevNav component** -- Temporary dev-only view selector bar rendered at top of editor panel for view switching during mock phase
5. **Update vsix mock data** -- Sync `vsix/src/mock/data.ts` with the new type definitions so the extension host prototype still works

### Phase 2: Core views -- Dashboard and finding list

1. **Build DashboardView** -- Project overview with summary cards, triage progress, severity chart
2. **Build SummaryCard** -- Reusable card with title/body/footer slots
3. **Build TriageProgressBar** -- Segmented progress bar (disposition-colored segments)
4. **Build SeverityChart** -- Horizontal bar chart component
5. **Build FindingsView** -- TanStack React Table replacing current `FindingList`, with filters, sorting, pagination, row selection
6. **Build batch action bar** -- Sticky bottom bar with multi-select disposition controls
7. **Remove old FindingList.tsx** -- Replace with FindingsView in App.tsx routing

### Phase 3: Detail view -- The primary triage workspace

1. **Build FindingDetailView shell** -- Replaces current `FindingDetail`, with header, breadcrumb, scrollable section layout
2. **Build TriageControls** -- Disposition button group with active state and immediate feedback
3. **Build TriageNotes** -- Collapsible textarea for triage annotations
4. **Build CodeBlock** -- Line-numbered code display with line highlighting
5. **Build AiAnalysisPanel** -- Accordion-based panel: explanation, risk assessment, suggested fix with diff, references
6. **Build SuppressionPanel** -- Conditional section: justification textarea + `.ash.yaml` preview
7. **Build FindingNavigation** -- Previous/next arrows stepping through filtered list
8. **Remove old FindingDetail.tsx** -- Replace with FindingDetailView in App.tsx routing

### Phase 4: Scan management and empty states

1. **Build ScanHistoryView** -- Scan card list with completed/failed/cancelled/running variants
2. **Build ScanCard** -- Reusable card with status icon, metadata, severity badges, action buttons
3. **Build ScanProgressView** -- Centered scan monitoring with per-scanner status checklist
4. **Build ScannerProgress** -- Scanner status list component (completed/running/queued)
5. **Build EmptyStateView** -- Welcome screen, zero-findings, scan-failed states

### Phase 5: Sidebar enhancement and polish

1. **Enhance SidebarDashboard** -- Add active scan indicator, recent scans list, triage progress text
2. **Add Kitchen Sink demos** -- Register new app components (TriageControls, CodeBlock, AiAnalysisPanel, ScanCard, etc.) in the sink registry
3. **Theme verification** -- Test all views in dark, light, and high-contrast VS Code themes
4. **Wire navigation** -- Ensure all click handlers, breadcrumbs, and back buttons route correctly between views
5. **Document** -- Update developer docs with expanded component inventory and view architecture
