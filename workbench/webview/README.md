# ASH Workbench WebView

React application that renders inside VS Code webview panels. A single Vite build produces the bundle; the extension host loads it in three contexts (sidebar, editor panel, kitchen sink), differentiated by an `init` message.

## Setup

```bash
cd webview
npm install
```

## Build

```bash
npm run build    # tsc -b && vite build -> dist/
npm run dev      # Vite dev server (limited use -- requires VS Code webview host)
npm run lint     # ESLint
```

Output: `dist/assets/index.js` and `dist/assets/index.css` (fixed filenames, no hashing).

The vsix build pipeline copies `dist/` to `vsix/webview-dist/` automatically via `npm run build` in `vsix/`.

## Contents

| File/Directory | Purpose |
|---|---|
| `src/main.tsx` | React root mount (`StrictMode` + `createRoot`) |
| `src/App.tsx` | Context-aware root with `useReducer` state machine, `EditorPanel` layout |
| `src/index.css` | Tailwind import + VS Code theme variable mappings |
| `src/mock-data.ts` | Hardcoded mock data for all views (project, scans, findings, scan targets, AI analysis, suppressions) |
| `src/hooks/useVSCodeAPI.ts` | `postMessage()` and `useMessages()` hook wrapping `acquireVsCodeApi` |
| `src/types/types.ts` | Data model types (copy of `vsix/src/models/types.ts`) |
| `src/types/messages.ts` | Message protocol types (copy of `vsix/src/models/messages.ts`) |
| `src/lib/utils.ts` | `cn()` utility (clsx + tailwind-merge) |
| `src/lib/theme-colors.ts` | Centralized color maps for severity and disposition badges/bars |
| `src/components/` | Application components -- views and shared UI (see below) |
| `src/components/ui/` | ShadCN auto-generated primitives (see catalog below) |
| `src/pages/sink/` | Kitchen Sink component showcase (see section below) |
| `components.json` | ShadCN configuration (style: default, base color: neutral, aliases: `@/`) |
| `vite.config.ts` | Vite + React + Tailwind plugin, `@` alias, fixed output filenames |
| `.npmrc` | `legacy-peer-deps=true` |

## App State Machine

`App.tsx` uses `useReducer` with two dimensions of state:

**Context** (set by `init` message from extension host):
- `unknown` -- initial state, renders editor panel with dashboard (mock mode default)
- `sidebar` -- renders `SidebarDashboard`
- `editorPanel` -- renders `EditorPanel` (dashboard, findings, scans, etc.)
- `sink` -- renders `SinkPage` (dev builds only)

**ViewState** (editor panel navigation, 8 states):
- `loading` -- waiting for data
- `dashboard` -- project overview with summary cards and scan targets
- `findingList` -- filterable/sortable data table of findings
- `findingDetail` -- single finding with triage, code, AI analysis
- `scanHistory` -- list of past and active scans
- `scanDetail` -- single scan with severity chart and scanner breakdown
- `scanProgress` -- live scan with progress bar and scanner checklist
- `empty` -- welcome, no-findings, or scan-failed empty states

Navigation uses a **history stack** (`viewHistory: ViewState[]`). Every navigation action pushes the current view before transitioning. `BACK` pops the stack. Breadcrumbs provide visual navigation.

**Scan target filtering**: When a scan target is selected, findings and scans are filtered to that target via `useMemo` in `EditorPanel`. Navigating to the dashboard clears the filter.

## Application Components

### View Components (one per ViewState)

| Component | File | View | Description |
|---|---|---|---|
| `DashboardView` | `DashboardView.tsx` | `dashboard` | Summary cards (findings, targets, triage progress), scan target list, quick actions |
| `FindingsView` | `FindingsView.tsx` | `findingList` | `@tanstack/react-table` with sort, filter, multi-select, batch triage |
| `FindingDetailView` | `FindingDetailView.tsx` | `findingDetail` | Header, triage controls, description, code location, AI analysis, suppression |
| `ScanHistoryView` | `ScanHistoryView.tsx` | `scanHistory` | Active scan card, completed scan list, target filter tabs |
| `ScanDetailView` | `ScanDetailView.tsx` | `scanDetail` | Scan metadata, severity chart, scanner results, view-findings action |
| `ScanProgressView` | `ScanProgressView.tsx` | `scanProgress` | Progress bar, scanner checklist, collapsible log output |
| `EmptyStateView` | `EmptyStateView.tsx` | `empty` | Three variants: welcome, noFindings, scanFailed |
| `SidebarDashboard` | `SidebarDashboard.tsx` | sidebar context | Compact single-column: scan button, targets, triage, severity |

### Shared Components

| Component | File | Purpose |
|---|---|---|
| `AppBreadcrumb` | `AppBreadcrumb.tsx` | Clickable breadcrumb segments for view navigation |
| `SeverityBadge` | `SeverityBadge.tsx` | Color-coded badge for CRITICAL/HIGH/MEDIUM/LOW/INFO |
| `DispositionBadge` | `DispositionBadge.tsx` | Color-coded badge for PENDING/FIX/SUPPRESS/DEFER |
| `SummaryCard` | `SummaryCard.tsx` | Card wrapper with title/content/footer slots |
| `ScanCard` | `ScanCard.tsx` | Card for a single scan in history lists |
| `ScanTargetCard` | `ScanTargetCard.tsx` | Card for a scan target: findings, severity, triage progress |
| `ScanTargetPicker` | `ScanTargetPicker.tsx` | Dialog for selecting scan target directory |
| `TriageControls` | `TriageControls.tsx` | Four-button disposition selector with active state |
| `TriageNotes` | `TriageNotes.tsx` | Collapsible textarea for triage notes (500 char limit) |
| `TriageProgressBar` | `TriageProgressBar.tsx` | Stacked bar showing disposition distribution |
| `SeverityChart` | `SeverityChart.tsx` | Horizontal bar chart for severity counts |
| `ScannerProgress` | `ScannerProgress.tsx` | Scanner status checklist (completed/running/queued) |
| `CodeBlock` | `CodeBlock.tsx` | Code display with line numbers and highlight support |
| `AiAnalysisPanel` | `AiAnalysisPanel.tsx` | Accordion: explanation, risk assessment, suggested fix, references |
| `SuppressionPanel` | `SuppressionPanel.tsx` | Suppression justification, YAML entry, expiry |
| `FindingNavigation` | `FindingNavigation.tsx` | Prev/Next buttons for stepping through findings |
| `DevNav` | `DevNav.tsx` | Development-only navigation bar (will be removed for production) |

## ShadCN Component System

This project uses [ShadCN/ui](https://ui.shadcn.com) as its component library. ShadCN components are not installed as a package -- they are code-generated into `src/components/ui/` and become owned source files. The configuration lives in `components.json`.

### Installed ShadCN Components

| Component | File | Key Consumers |
|---|---|---|
| `accordion` | `ui/accordion.tsx` | AiAnalysisPanel |
| `alert` | `ui/alert.tsx` | SuppressionPanel |
| `badge` | `ui/badge.tsx` | SeverityBadge, DispositionBadge, SidebarDashboard, ScanTargetCard |
| `breadcrumb` | `ui/breadcrumb.tsx` | AppBreadcrumb |
| `button` | `ui/button.tsx` | DashboardView, FindingsView, FindingDetailView, TriageControls, DevNav |
| `card` | `ui/card.tsx` | SummaryCard, ScanCard, ScanTargetCard, ScanDetailView |
| `checkbox` | `ui/checkbox.tsx` | FindingsView (row selection) |
| `collapsible` | `ui/collapsible.tsx` | TriageNotes, ScanProgressView (log output) |
| `dialog` | `ui/dialog.tsx` | ScanTargetPicker |
| `dropdown-menu` | `ui/dropdown-menu.tsx` | FindingsView (row actions, batch triage) |
| `input` | `ui/input.tsx` | FindingsView (search), ScanTargetPicker (custom path) |
| `label` | `ui/label.tsx` | Kitchen Sink |
| `progress` | `ui/progress.tsx` | ScanProgressView |
| `scroll-area` | `ui/scroll-area.tsx` | Kitchen Sink |
| `select` | `ui/select.tsx` | Kitchen Sink |
| `separator` | `ui/separator.tsx` | DashboardView, SidebarDashboard, FindingDetailView, ScanHistoryView |
| `skeleton` | `ui/skeleton.tsx` | Kitchen Sink |
| `switch` | `ui/switch.tsx` | Kitchen Sink |
| `table` | `ui/table.tsx` | FindingsView |
| `tabs` | `ui/tabs.tsx` | Kitchen Sink |
| `textarea` | `ui/textarea.tsx` | TriageNotes, SuppressionPanel |
| `toggle` | `ui/toggle.tsx` | Kitchen Sink |
| `toggle-group` | `ui/toggle-group.tsx` | Kitchen Sink |
| `tooltip` | `ui/tooltip.tsx` | Kitchen Sink |

### ShadCN MCP Server Tools

The project has a ShadCN MCP server configured (`.mcp.json`). Use these tools when working with components:

| Tool | When to Use |
|---|---|
| `mcp__shadcn__list_items_in_registries` | Browse all available ShadCN components before installing |
| `mcp__shadcn__search_items_in_registries` | Find a specific component by name |
| `mcp__shadcn__view_items_in_registries` | Inspect component source code, variants, and dependencies before installing |
| `mcp__shadcn__get_item_examples_from_registries` | Pull official usage examples -- use as starting point for demos and application code |
| `mcp__shadcn__get_add_command_for_items` | Get the exact CLI install command for a component |
| `mcp__shadcn__get_project_registries` | Check which registries the project is configured to use |
| `mcp__shadcn__get_audit_checklist` | Audit installed components for issues |

**Workflow for adding a new ShadCN component:**

1. `mcp__shadcn__view_items_in_registries` -- inspect source and dependencies
2. `mcp__shadcn__get_item_examples_from_registries` -- get official examples
3. `mcp__shadcn__get_add_command_for_items` -- get the install command
4. Run the install command (e.g., `cd webview && npx shadcn@latest add <name> --yes`)
5. Add a demo to the Kitchen Sink (see below)

### ShadCN Configuration

Key settings from `components.json`:

| Setting | Value |
|---|---|
| Style | `default` |
| RSC | `false` (Vite, not Next.js) |
| TSX | `true` |
| Base color | `neutral` |
| CSS variables | `true` (mapped to VS Code theme vars in `index.css`) |
| Icon library | `lucide` (`lucide-react`) |
| Component alias | `@/components` |
| UI alias | `@/components/ui` |
| Utils alias | `@/lib/utils` |
| Hooks alias | `@/hooks` |

## Kitchen Sink

The Kitchen Sink is a dev-only component showcase at `src/pages/sink/`. It renders every installed UI component and application component against the user's actual VS Code theme, providing a living style guide for builders.

### How It Works

The sink is a third webview context alongside sidebar and editor panel. The extension host sends `{ type: 'init', payload: { context: 'sink' } }` to activate it. Open via the `ASH: Open Kitchen Sink` VS Code command (dev builds only).

### Structure

| File | Purpose |
|---|---|
| `pages/sink/SinkPage.tsx` | Root component -- sticky header, search filter, grid layout |
| `pages/sink/sink-registry.ts` | Central registry mapping component keys to demo components |
| `pages/sink/components/component-wrapper.tsx` | Card wrapper with name header + `ComponentErrorBoundary` |
| `pages/sink/components/sink-header.tsx` | Sticky header with title and search input |
| `pages/sink/demos/*.tsx` | One demo file per component |

### Current Demos

| Demo | Type | What It Shows |
|---|---|---|
| `accordion-demo` | `ui` | Collapsible accordion items |
| `alert-demo` | `ui` | Alert variants |
| `badge-demo` | `ui` | All badge variants (default, secondary, destructive, outline) + pill counters |
| `button-demo` | `ui` | All sizes (sm, default, lg, icon) x all variants + disabled state |
| `card-demo` | `ui` | Header/content/footer combos, bordered variants |
| `checkbox-demo` | `ui` | Checkbox states |
| `dialog-demo` | `ui` | Modal dialog |
| `dropdown-menu-demo` | `ui` | Menu with items, separators |
| `input-demo` | `ui` | Input variants and states |
| `label-demo` | `ui` | Label with form elements |
| `progress-demo` | `ui` | Progress bar at various values |
| `select-demo` | `ui` | Grouped items, large list, disabled state |
| `separator-demo` | `ui` | Horizontal + vertical orientations |
| `skeleton-demo` | `ui` | Loading skeleton patterns |
| `switch-demo` | `ui` | Toggle switch states |
| `table-demo` | `ui` | Full table with header, body, footer, caption |
| `tabs-demo` | `ui` | Tab navigation |
| `textarea-demo` | `ui` | Textarea variants |
| `tooltip-demo` | `ui` | Tooltip on hover |
| `severity-badge-demo` | `app` | All 5 severity levels (CRITICAL through INFO) |
| `disposition-badge-demo` | `app` | All 4 dispositions (PENDING, FIX, SUPPRESS, DEFER) |
| `tasks-demo` | `app` | Tasks component (full width) |

### Adding a New Component Demo

1. Create `src/pages/sink/demos/{name}-demo.tsx` with a single named export
2. Import and register in `src/pages/sink/sink-registry.ts`
3. Set `type: 'ui'` for ShadCN primitives, `type: 'app'` for application components

Demo rules:
- One demo per file, named export (e.g., `export function InputDemo()`)
- Show component variations: sizes, variants, states (default, disabled, error)
- All data hardcoded inline -- no extension host message calls
- Import UI components from `@/components/ui/*`, app components from `@/components/*`

## VS Code Theme Integration

`index.css` maps `--vscode-*` CSS variables to ShadCN design tokens (`--background`, `--foreground`, `--primary`, etc.). Components automatically adapt to the active VS Code theme without any JavaScript.

Key mappings:
- `--background` / `--foreground` -> `--vscode-editor-background` / `--vscode-editor-foreground`
- `--primary` -> `--vscode-button-background`
- `--border` -> `--vscode-panel-border`
- `--ring` -> `--vscode-focusBorder`

Domain-specific colors (severity and disposition) are centralized in `src/lib/theme-colors.ts` and are the only hardcoded Tailwind color classes in the app. Everything else inherits from the VS Code theme.

`@custom-variant dark (&:is(.vscode-dark *))` remaps Tailwind's `dark:` prefix to VS Code's `.vscode-dark` body class.

## Integration Points

- **Extension host** -- communicates via `postMessage` / `onDidReceiveMessage`. Message types defined in `src/types/messages.ts`.
- **vsix build** -- `vsix/package.json` `build:webview` script builds this project and copies output to `vsix/webview-dist/`.
- **HTML loader** -- `vsix/src/providers/webviewHtml.ts` generates the HTML shell that loads `webview-dist/assets/index.js` and `index.css`.
- **SinkPanelManager** -- `vsix/src/providers/sinkPanelManager.ts` creates the kitchen sink webview panel and sends the `sink` init message.
- **FindingsPanelManager** -- `vsix/src/providers/findingsPanelManager.ts` creates the editor panel webview and sends the `editorPanel` init message.
- **SidebarWebviewProvider** -- `vsix/src/providers/sidebarWebviewProvider.ts` provides the sidebar webview and sends the `sidebar` init message.

## Related

- See [CLAUDE.md](./CLAUDE.md) for conventions.
- Developer docs: `docs/docs/developer-docs/webview/README.md` (dual-context rendering, theme integration, extending components).
- As-built reference: `docs/docs/working/webview/app-mock/ux-as-built.md` (complete mock app UX architecture and gotchas).
