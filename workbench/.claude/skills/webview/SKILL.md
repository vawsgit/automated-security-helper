---
name: webview
description: "Develop features, fix bugs, and write code for the ASH Workbench React WebView application (the webview/ directory). Use this skill when the user asks to 'add a component', 'build a screen', 'style the UI', 'add a ShadCN component', 'write a sink demo', 'add a Kitchen Sink demo', 'update the finding list', 'change the sidebar dashboard', 'work on the webview', 'add a filter', 'theme a component', 'fix the dark mode', or any request involving React/TSX code in webview/src/. Also trigger when the user mentions 'ShadCN', 'Tailwind', 'React component', 'webview state', 'useReducer', 'postMessage' (from the webview side), 'index.css', 'VS Code theme variables', 'severity badge', 'disposition badge', 'SinkPage', 'sink-registry', or references specific webview/ files. Do NOT use for the extension host (vsix/ directory), VS Code API providers, commands, services, or documentation writing (docs/ directory)."
---

# ASH Workbench WebView Development

You are developing the React WebView application for ASH Workbench -- a VS Code extension that provides a GUI for the Automated Security Helper (ASH) security scanning CLI. The WebView is a pure renderer: it receives state from the extension host via `postMessage`, displays it, and sends user actions back. All business logic, data fetching, and VS Code API access belong to the extension host.

## Project Context

ASH Workbench is a monorepo with two build targets sharing a root workspace:

- **`webview/`** -- React WebView app (Vite + React 19 + Tailwind CSS v4 + ShadCN/ui) -- **this is your scope**
- **`vsix/`** -- VS Code extension host (TypeScript, Node.js) -- out of scope for this skill
- **`docs/`** -- Docusaurus documentation site -- out of scope

The WebView is a single Vite-built React app that renders inside VS Code in multiple contexts. One build, one bundle, loaded in all places. An `init` message from the extension host tells the app which context it's running in.

## Current webview/ Structure

```
webview/
  package.json              # Dependencies, build scripts
  vite.config.ts            # Vite + React + Tailwind, fixed output filenames, @/ alias
  tsconfig.json             # Project references, @/ path alias
  eslint.config.js          # Flat config: react-hooks, react-refresh, typescript-eslint
  src/
    main.tsx                # React root mount (StrictMode + createRoot)
    App.tsx                 # Context-aware root: useReducer state machine, message handling
    index.css               # Tailwind v4 import + VS Code theme variable mappings
    hooks/
      useVSCodeAPI.ts       # postMessage bridge + useMessages hook (singleton)
    types/
      types.ts              # Data model types (COPIED from vsix/src/models/types.ts)
      messages.ts           # Message protocol types (COPIED from vsix/src/models/messages.ts)
    components/
      SidebarDashboard.tsx  # Compact sidebar view with scan button, triage summary
      FindingList.tsx       # Full-width finding table with severity/disposition/scanner filters
      FindingDetail.tsx     # Finding detail view with disposition controls, code location
      SeverityBadge.tsx     # Color-coded severity badge (5 levels)
      DispositionBadge.tsx  # Styled disposition badge (4 states)
      ui/                   # ShadCN auto-generated components (do not hand-edit)
    pages/
      sink/                 # Kitchen Sink component showcase (dev-only)
        SinkPage.tsx        # Main page: search state, filters registry, renders grid
        sink-registry.ts    # Central registry of all demo components
        components/
          component-wrapper.tsx  # Card wrapper + ComponentErrorBoundary
          sink-header.tsx        # Sticky header with title, separator, search input
        demos/              # One demo file per component (22 files)
    lib/
      utils.ts              # cn() utility (clsx + tailwind-merge)
```

## Build & Development

```bash
cd webview
npm run build             # tsc -b && vite build (output to dist/)
npm run lint              # ESLint
npm run dev               # Vite dev server (build feedback only -- cannot render without VS Code)
```

After any webview change, copy the build to the extension:

```bash
cd vsix && npm run build:webview    # Builds webview + copies dist/ to vsix/webview-dist/
```

Then reload the Extension Development Host (`Ctrl+R` / `Cmd+R`).

There is **no HMR** for webview content. The extension loads static built assets from `vsix/webview-dist/`.

**Debug:** Press F5 in VS Code (from the `vsix/` workspace) to launch an Extension Development Host. The sidebar and editor panels load the webview automatically. Run "ASH: Open Kitchen Sink" from the Command Palette for the component showcase.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| Components | ShadCN/ui (installed via `npx shadcn@latest add`) |
| Table | TanStack React Table |
| Utility | `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` |
| TypeScript | Strict mode, ES2023 target |

## Coding Conventions

- **TypeScript strict mode** -- all strict type-checking enabled
- **Named exports** for all components (not default) -- the only exceptions are `App` and `SinkPage` (default exports for root/lazy-loading)
- **Props interfaces** defined in the same file, immediately above the component
- **Import paths:** Use `@/components/ui/*` for ShadCN, `@/lib/utils` for utilities, relative paths for app components and hooks
- **Type imports:** Use `import type { ... }` for type-only imports
- **File naming:** PascalCase for app components (`FindingList.tsx`), kebab-case for ShadCN UI and sink demos (`button.tsx`, `badge-demo.tsx`)
- **Class merging:** Always use the `cn()` utility from `@/lib/utils` when combining Tailwind classes with props

## Architecture Patterns

### Context-Driven Rendering (No Router)

The webview uses a `useReducer` state machine in `App.tsx` -- not React Router. The extension host sends an `init` message with a `context` discriminator to control which UI renders:

| Context | Renders |
|---|---|
| `unknown` | Loading spinner (before `init` arrives) |
| `sidebar` | `SidebarDashboard` |
| `editorPanel` + `findingList` view | `FindingList` |
| `editorPanel` + `findingDetail` view | `FindingDetail` |
| `sink` | `SinkPage` (dev-only Kitchen Sink) |

### State Machine (App.tsx)

```typescript
interface AppState {
  context: 'sidebar' | 'editorPanel' | 'sink' | 'unknown';
  scanId: string | undefined;
  scans: ScanSummary[];
  summary: DispositionSummary;
  findings: FindingRow[];
  selectedFinding: FindingRow | undefined;
  view: ViewState; // 'loading' | 'findingList' | 'findingDetail'
}
```

Three action types:
- `MESSAGE` -- processes inbound `ExtToWebviewMessage` from the extension host
- `SELECT_FINDING` -- local navigation (user clicked a finding row)
- `BACK_TO_LIST` -- local navigation (user clicked the back breadcrumb)

All extension host messages flow through the `MESSAGE` action, which switches on `msg.type` inside the reducer.

### Message Protocol

The extension host and WebView communicate exclusively via typed `postMessage`. Types are discriminated unions defined in `webview/src/types/messages.ts`.

**Extension Host -> WebView (`ExtToWebviewMessage`):**

| Type | Payload | Purpose |
|---|---|---|
| `init` | `{ context: 'sidebar' \| 'editorPanel' \| 'sink' }` | Set the rendering context |
| `stateUpdate` | `{ scans, summary }` | Sidebar dashboard data |
| `findingsUpdate` | `{ scanId, findings }` | Finding list for editor panel |
| `findingDetail` | `FindingRow` | Single finding detail |
| `dispositionUpdated` | `{ findingId, disposition }` | Confirms a disposition change |

**WebView -> Extension Host (`WebviewToExtMessage`):**

| Type | Payload | Purpose |
|---|---|---|
| `requestState` | *(none)* | Request initial state (sent on mount) |
| `startScan` | *(none)* | User clicked "Run Scan" |
| `openFindings` | `{ scanId }` | User clicked "View Findings" |
| `selectFinding` | `{ findingId }` | User clicked a finding row |
| `setDisposition` | `{ findingId, disposition }` | User changed a disposition |
| `navigateToCode` | `{ filePath, startLine }` | User clicked a file path link |
| `openSink` | *(none)* | Request to open Kitchen Sink panel |

**Handshake:** On mount, the app sends `requestState`. The host responds with `init` (setting context) then context-appropriate data.

### useVSCodeAPI Hook

`hooks/useVSCodeAPI.ts` wraps the VS Code WebView API:

- `acquireVsCodeApi()` is called **once** at module scope -- it's a singleton and can never be called again
- `postMessage(msg)`: sends a typed `WebviewToExtMessage` to the extension host
- `useMessages(handler)`: React hook that registers a `message` event listener and cleans up on unmount

### Component Pattern

Application components receive data via props and use `postMessage()` for user actions:

```typescript
import { postMessage } from '../hooks/useVSCodeAPI';
import type { FindingRow, Disposition } from '../types/types';

interface FindingDetailProps {
  finding: FindingRow;
  onBack: () => void;
}

export function FindingDetail({ finding, onBack }: FindingDetailProps) {
  // Render UI, use postMessage() for extension host communication
  // Use onBack() for local navigation (dispatches BACK_TO_LIST in App.tsx)
}
```

**Key rule:** The WebView never holds business logic or fetches data. It sends user actions via `postMessage`, the extension host processes them, and pushes state back.

### Domain Color Maps

Severity and disposition use explicit color mappings via `Record<EnumType, string>` objects:

```typescript
const severityStyles: Record<Severity, string> = {
  CRITICAL: 'bg-red-700 text-white hover:bg-red-800',
  HIGH: 'bg-orange-600 text-white hover:bg-orange-700',
  MEDIUM: 'bg-yellow-600 text-white hover:bg-yellow-700',
  LOW: 'bg-blue-600 text-white hover:bg-blue-700',
  INFO: 'bg-gray-500 text-white hover:bg-gray-600',
};
```

These intentionally use hardcoded Tailwind colors (not theme tokens) because they represent semantic meaning that must be consistent across themes.

### Data Model

Types defined in `webview/src/types/types.ts`:

| Type | Values |
|---|---|
| `ScanStatus` | `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `Severity` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO` |
| `Disposition` | `PENDING`, `FIX`, `SUPPRESS`, `DEFER` |

Key interfaces: `ScanSummary`, `FindingRow`, `DispositionSummary`.

## VS Code Theme Integration

`index.css` maps VS Code's CSS custom properties to ShadCN/Tailwind design tokens. This is what makes components inherit the active VS Code theme automatically.

**How it works:**
1. VS Code injects `--vscode-*` CSS variables into the webview iframe
2. VS Code sets a class on `<body>`: `.vscode-dark`, `.vscode-light`, or `.vscode-high-contrast`
3. `index.css` maps `--vscode-*` to ShadCN tokens (e.g., `--background: var(--vscode-editor-background, ...)`)
4. Tailwind's dark variant is remapped: `@custom-variant dark (&:is(.vscode-dark *))` so `dark:` utilities work with VS Code's body class
5. `color-scheme: dark` is set on `.vscode-dark` and `.vscode-high-contrast` for native browser controls

**Key mappings:**

| ShadCN Token | VS Code Variable |
|---|---|
| `--background` | `--vscode-editor-background` |
| `--foreground` | `--vscode-editor-foreground` |
| `--primary` | `--vscode-button-background` |
| `--border` | `--vscode-panel-border` |
| `--ring` | `--vscode-focusBorder` |
| `--destructive` | `--vscode-errorForeground` |
| `--muted-foreground` | `--vscode-descriptionForeground` |

**Theme rules:**
- Use semantic Tailwind tokens (`bg-background`, `text-foreground`, `bg-primary`) for theme-dependent colors
- Domain-specific colors (severity, disposition) use hardcoded Tailwind classes -- this is intentional
- For one-off VS Code variables without a Tailwind mapping, use inline `style={{ ... }}` with `var(--vscode-*)` directly
- Never remove `color-scheme: dark` from `index.css` -- without it, native input icons (calendar, clock, search clear) become invisible in dark themes

## ShadCN Components

24 ShadCN components are installed in `src/components/ui/`. Do not hand-edit these files -- they are auto-generated.

### Adding a ShadCN Component

```bash
cd webview && npx shadcn@latest add <component-name> --yes
```

**Use the ShadCN MCP tools** when inspecting or adding components:

| Tool | Purpose |
|---|---|
| `mcp__shadcn__view_items_in_registries` | View component source and dependencies before installing |
| `mcp__shadcn__get_item_examples_from_registries` | Get official example usage for reference |
| `mcp__shadcn__get_add_command_for_items` | Get the exact CLI install command |
| `mcp__shadcn__search_items_in_registries` | Search for a component by name |
| `mcp__shadcn__list_items_in_registries` | List all available components |

**Workflow:**
1. `mcp__shadcn__view_items_in_registries` -- inspect source and dependencies
2. `mcp__shadcn__get_item_examples_from_registries` -- get official examples
3. `mcp__shadcn__get_add_command_for_items` -- get install command
4. Run the install command from `webview/`
5. Add a Kitchen Sink demo (see below)

## Kitchen Sink

The Kitchen Sink is a dev-only component showcase at `pages/sink/`. It renders 22 component demos in a scrollable grid.

### How It Works

- Activated via `init` message with `context: 'sink'` from `SinkPanelManager`
- `SinkPage.tsx` owns state: a `searchFilter` via `useState`
- `sink-registry.ts` is the single source of truth for all demos
- Each demo is wrapped in `ComponentWrapper` with a `ComponentErrorBoundary`
- The command "ASH: Open Kitchen Sink" is only registered in development mode

### Adding a Kitchen Sink Demo

**1. Create the demo file** at `src/pages/sink/demos/{name}-demo.tsx`:

```typescript
import { MyComponent } from '@/components/ui/my-component';

export function MyComponentDemo() {
  return (
    <div className="flex flex-wrap gap-4">
      <MyComponent>Default</MyComponent>
      <MyComponent variant="secondary">Secondary</MyComponent>
      {/* Exercise all variants, sizes, states */}
    </div>
  );
}
```

**Rules:**
- One demo per file, named export (not default)
- No `postMessage` calls -- demos are pure visual components
- All demo data hardcoded inline -- no external data dependencies
- Exercise all variants and states of the component
- Import UI components from `@/components/ui/*`, app components from `@/components/*`

**2. Register in sink-registry.ts:**

```typescript
import { MyComponentDemo } from './demos/my-component-demo';

export const sinkRegistry: Record<string, SinkComponentConfig> = {
  // ... existing entries
  'my-component': { name: 'My Component', component: MyComponentDemo, type: 'ui' },
};
```

| Field | Value |
|---|---|
| `type` | `'ui'` for ShadCN primitives, `'app'` for ASH-specific components |
| `className` | Optional. Use `'w-full'` if the demo needs full width (e.g., tables) |
| `label` | Optional. Set to `'New'` for recently added components |

**3. Build and verify:**

```bash
cd vsix && npm run build:webview
```

Then F5, open the Kitchen Sink, confirm the demo renders in both dark and light themes.

## Extending the WebView

### Adding a New Screen

1. Create the component in `webview/src/components/`
2. Add a new `view` state value to `ViewState` type in `App.tsx`
3. Add a reducer case to transition to the new view
4. Add the render branch in `App.tsx`

### Adding a New Message

1. Add the message variant to the appropriate type in `vsix/src/models/messages.ts`
2. **Copy the updated types to `webview/src/types/messages.ts`** -- these files must stay in sync
3. Add the handler in the relevant extension host provider
4. Add the reducer case in `App.tsx` if it's an inbound message
5. Add the `postMessage()` call in the relevant React component if it's an outbound message

### Shared Type Changes

Types in `webview/src/types/` are manually copied from `vsix/src/models/`. When modifying `types.ts` or `messages.ts`, **update both locations**. The copy approach is intentional for the prototype.

## Critical Constraints

1. **WebView is a pure renderer** -- never put business logic or data fetching here. Send user actions via `postMessage`, receive state updates from the extension host.
2. **`acquireVsCodeApi()` is a singleton** -- called once at module scope in `useVSCodeAPI.ts`. No other module should ever call it. The app cannot run outside a VS Code webview iframe.
3. **Strict CSP** -- no external images, fonts, or scripts. Only locally bundled resources are allowed. The VS Code font is inherited via `--vscode-font-family`.
4. **Fixed Vite output filenames** -- `dist/assets/index.js` and `dist/assets/index.css`. The extension host hardcodes these paths in `webviewHtml.ts`. Do not change the Vite output config without updating the HTML generator.
5. **`color-scheme: dark` is critical** -- removing it from `index.css` makes native input icons invisible in dark themes.
6. **`@custom-variant dark` is critical** -- removing it breaks all `dark:` Tailwind prefixes in VS Code context.
7. **Type files must stay in sync** -- `webview/src/types/messages.ts` and `vsix/src/models/messages.ts` must be identical. Same for `types.ts`.
8. **Build requires copy step** -- after any webview change: `cd vsix && npm run build:webview`.
9. **ShadCN `ui/` files are auto-generated** -- do not hand-edit files in `components/ui/`. Re-run the add command to update them.

## Design Documents

For detailed specifications, read these before implementing major features:

- **What the app does:** `docs/docs/developer-docs/architecture/design/functional-design.md`
- **How it's built:** `docs/docs/developer-docs/architecture/design/technical-design.md`
- **WebView overview:** `docs/docs/developer-docs/webview/README.md`
- **Kitchen Sink guide:** `docs/docs/developer-docs/webview/kitchen-sink.md`
- **Message protocol:** `docs/docs/developer-docs/architecture/message-protocol.md`
- **Build pipeline:** `docs/docs/developer-docs/architecture/build-pipeline.md`
- **Extension host (context):** `docs/docs/developer-docs/architecture/extension-host.md`
