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
| `src/App.tsx` | Context-aware root with `useReducer` state machine |
| `src/index.css` | Tailwind import + VS Code theme variable mappings |
| `src/hooks/useVSCodeAPI.ts` | `postMessage()` and `useMessages()` hook wrapping `acquireVsCodeApi` |
| `src/types/types.ts` | Data model types (copy of `vsix/src/models/types.ts`) |
| `src/types/messages.ts` | Message protocol types (copy of `vsix/src/models/messages.ts`) |
| `src/lib/utils.ts` | `cn()` utility (clsx + tailwind-merge) |
| `src/components/` | Application components (see below) |
| `src/components/ui/` | ShadCN auto-generated primitives (see catalog below) |
| `src/pages/sink/` | Kitchen Sink component showcase (see section below) |
| `components.json` | ShadCN configuration (style: default, base color: neutral, aliases: `@/`) |
| `vite.config.ts` | Vite + React + Tailwind plugin, `@` alias, fixed output filenames |
| `.npmrc` | `legacy-peer-deps=true` |

## ShadCN Component System

This project uses [ShadCN/ui](https://ui.shadcn.com) as its component library. ShadCN components are not installed as a package -- they are code-generated into `src/components/ui/` and become owned source files. The configuration lives in `components.json`.

### Installed ShadCN Components

| Component | File | Key Consumers |
|---|---|---|
| `accordion` | `ui/accordion.tsx` | Kitchen Sink |
| `alert` | `ui/alert.tsx` | Kitchen Sink |
| `badge` | `ui/badge.tsx` | SeverityBadge, DispositionBadge, SidebarDashboard, FindingList |
| `button` | `ui/button.tsx` | SidebarDashboard, FindingDetail |
| `card` | `ui/card.tsx` | Kitchen Sink |
| `checkbox` | `ui/checkbox.tsx` | Kitchen Sink |
| `dialog` | `ui/dialog.tsx` | Kitchen Sink |
| `dropdown-menu` | `ui/dropdown-menu.tsx` | Kitchen Sink |
| `input` | `ui/input.tsx` | Kitchen Sink |
| `label` | `ui/label.tsx` | Kitchen Sink |
| `progress` | `ui/progress.tsx` | Kitchen Sink |
| `select` | `ui/select.tsx` | Kitchen Sink |
| `separator` | `ui/separator.tsx` | SidebarDashboard, FindingDetail, SinkHeader |
| `skeleton` | `ui/skeleton.tsx` | Kitchen Sink |
| `switch` | `ui/switch.tsx` | Kitchen Sink |
| `table` | `ui/table.tsx` | FindingList |
| `tabs` | `ui/tabs.tsx` | Kitchen Sink |
| `textarea` | `ui/textarea.tsx` | Kitchen Sink |
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
| `badge-demo` | `ui` | All badge variants (default, secondary, destructive, outline) + pill counters |
| `button-demo` | `ui` | All sizes (sm, default, lg, icon) x all variants + disabled state |
| `card-demo` | `ui` | Header/content/footer combos, bordered variants |
| `select-demo` | `ui` | Grouped items, large list, disabled state |
| `separator-demo` | `ui` | Horizontal + vertical orientations |
| `table-demo` | `ui` | Full table with header, body, footer, caption |
| `severity-badge-demo` | `app` | All 5 severity levels (CRITICAL through INFO) |
| `disposition-badge-demo` | `app` | All 4 dispositions (PENDING, FIX, SUPPRESS, DEFER) |

### Adding a New Component Demo

1. Create `src/pages/sink/demos/{name}-demo.tsx` with a single named export
2. Import and register in `src/pages/sink/sink-registry.ts`
3. Set `type: 'ui'` for ShadCN primitives, `type: 'app'` for application components

Demo rules:
- One demo per file, named export (e.g., `export function InputDemo()`)
- Show component variations: sizes, variants, states (default, disabled, error)
- All data hardcoded inline -- no extension host message calls
- Import UI components from `@/components/ui/*`, app components from `@/components/*`

## Application Components

| Component | Context | Purpose |
|---|---|---|
| `SidebarDashboard` | sidebar | Project name, Run Scan button, triage summary badges, severity breakdown, View Findings button |
| `FindingList` | editorPanel | Full-width findings table with severity/disposition/scanner filters; local filter state |
| `FindingDetail` | editorPanel | Finding detail view with disposition controls, code snippet, clickable file path |
| `SeverityBadge` | both | Color-coded badge: red (CRITICAL), orange (HIGH), yellow (MEDIUM), blue (LOW), gray (INFO) |
| `DispositionBadge` | both | Color-coded badge: gray (PENDING), green (FIX), purple (SUPPRESS), amber (DEFER) |

## App State Machine

`App.tsx` uses `useReducer` with two dimensions of state:

**Context** (set by `init` message from extension host):
- `unknown` -- initial state, renders loading spinner
- `sidebar` -- renders `SidebarDashboard`
- `editorPanel` -- renders `FindingList` or `FindingDetail`
- `sink` -- renders `SinkPage` (dev builds only, via `React.lazy`)

**View** (editor panel navigation):
- `loading` -- waiting for findings data
- `findingList` -- showing the findings table
- `findingDetail` -- showing a single finding

Transitions: `init` sets context, `findingsUpdate` sets view to `findingList`, `SELECT_FINDING` sets view to `findingDetail`, `BACK_TO_LIST` returns to `findingList`.

## VS Code Theme Integration

`index.css` maps `--vscode-*` CSS variables to ShadCN design tokens (`--background`, `--foreground`, `--primary`, etc.). Components automatically adapt to the active VS Code theme without any JavaScript.

Key mappings:
- `--background` / `--foreground` -> `--vscode-editor-background` / `--vscode-editor-foreground`
- `--primary` -> `--vscode-button-background`
- `--border` -> `--vscode-panel-border`
- `--ring` -> `--vscode-focusBorder`

This means the Kitchen Sink shows components as they actually render in the user's VS Code environment -- no separate theme selector needed.

## Integration Points

- **Extension host** -- communicates via `postMessage` / `onDidReceiveMessage`. Message types defined in `src/types/messages.ts`.
- **vsix build** -- `vsix/package.json` `build:webview` script builds this project and copies output to `vsix/webview-dist/`.
- **HTML loader** -- `vsix/src/providers/webviewHtml.ts` generates the HTML shell that loads `webview-dist/assets/index.js` and `index.css`.
- **SinkPanelManager** -- `vsix/src/providers/sinkPanelManager.ts` creates the kitchen sink webview panel and sends the `sink` init message.

## Related

- See [CLAUDE.md](./CLAUDE.md) for conventions.
- Developer docs: `docs/docs/developer-docs/architecture/webview-application.md` (dual-context rendering, theme integration, extending components).
