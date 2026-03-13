# ASH Workbench WebView

React application that renders inside VS Code webview panels. A single Vite build produces the bundle; the extension host loads it in two contexts (sidebar and editor area), differentiated by an `init` message.

## Setup

```bash
cd webview
npm install
```

## Build

```bash
npm run build    # tsc -b && vite build -> dist/
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
| `src/components/ui/` | ShadCN auto-generated components |
| `components.json` | ShadCN configuration (style: default, aliases: `@/`) |
| `vite.config.ts` | Vite + React + Tailwind plugin, `@` alias, fixed output filenames |
| `.npmrc` | `legacy-peer-deps=true` |

## Components

### Application Components

| Component | Context | Purpose |
|---|---|---|
| `SidebarDashboard` | sidebar | Project name, Run Scan button, triage summary badges, severity breakdown, View Findings button |
| `FindingList` | editorPanel | Full-width findings table with severity/disposition/scanner filters; local filter state |
| `FindingDetail` | editorPanel | Finding detail view with disposition controls, code snippet, clickable file path |
| `SeverityBadge` | both | Color-coded badge: red (CRITICAL), orange (HIGH), yellow (MEDIUM), blue (LOW), gray (INFO) |
| `DispositionBadge` | both | Color-coded badge: gray (PENDING), green (FIX), purple (SUPPRESS), amber (DEFER) |

### ShadCN UI Components

Installed via `npx shadcn@latest add <name> --yes`. Located in `src/components/ui/`.

| Component | Used By |
|---|---|
| `badge` | SeverityBadge, DispositionBadge, SidebarDashboard, FindingList |
| `button` | SidebarDashboard, FindingDetail |
| `card` | *(available, not yet used)* |
| `select` | *(available, not yet used)* |
| `separator` | SidebarDashboard, FindingDetail |
| `table` | FindingList |

## App State Machine

`App.tsx` uses `useReducer` with two dimensions of state:

**Context** (set by `init` message from extension host):
- `unknown` -- initial state, renders loading spinner
- `sidebar` -- renders `SidebarDashboard`
- `editorPanel` -- renders `FindingList` or `FindingDetail`

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

## Integration Points

- **Extension host** -- communicates via `postMessage` / `onDidReceiveMessage`. Message types defined in `src/types/messages.ts`.
- **vsix build** -- `vsix/package.json` `build:webview` script builds this project and copies output to `vsix/webview-dist/`.
- **HTML loader** -- `vsix/src/providers/webviewHtml.ts` generates the HTML shell that loads `webview-dist/assets/index.js` and `index.css`.

## Related

- See [CLAUDE.md](./CLAUDE.md) for conventions.
- Developer docs: `docs/docs/developer-docs/architecture/webview-application.md` (dual-context rendering, theme integration, extending components).
- Message protocol: `docs/docs/developer-docs/architecture/message-protocol.md` (handshake, message types, routing).
- Build pipeline: `docs/docs/developer-docs/architecture/build-pipeline.md` (sibling layout, copy bridge, dev workflow).
