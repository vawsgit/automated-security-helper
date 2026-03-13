---
title: sink-integration-research
draft: true
sidebar_label: Sink Integration Research
sidebar_position: 4
---

# Kitchen Sink Integration Research

## Overview

This document provides detailed guidance for integrating a Kitchen Sink component showcase into the ASH Workbench webview. The goal is a developer-facing example gallery accessible within the VS Code extension, showing how every UI component renders against VS Code's native theme. Builders can navigate to this showcase to see real component rendering without leaving the extension.

The research analyzes the shadcn v4 reference implementation (`/sink` route in `apps/v4`), the as-built documentation (`kitchen-sink-as-built.md`), and the current webview architecture to produce a concrete, actionable integration plan.

## Architecture

### Reference Implementation: shadcn v4 Sink

The shadcn v4 sink is a Next.js App Router application with the following structure:

```
sink/
  layout.tsx               # SidebarProvider + header bar + fonts
  page.tsx                 # Index page - grid of all registry:ui demos
  [name]/page.tsx          # Detail page - single component by URL param
  component-registry.ts    # Central registry (51 ui + 4 page demos)
  components/
    component-wrapper.tsx  # Card wrapper + error boundary
    app-sidebar.tsx        # Collapsible sidebar with registry nav
    app-breadcrumbs.tsx    # Context-aware breadcrumbs
    theme-selector.tsx     # Multi-axis theme picker
    *-demo.tsx             # 51 individual component demos
  (pages)/
    forms/                 # Full-page form demo
    react-hook-form/       # Form library integration demo
    ...
```

Key patterns from the reference:

- **Component registry** (`component-registry.ts:62-435`): A `Record<string, ComponentConfig>` mapping slug keys to `{ name, component, type, href, className?, label? }`. This is the single source of truth for all demos.
- **ComponentWrapper** (`component-wrapper.tsx:7-31`): Wraps each demo in a bordered card with a header showing the title-cased name. Includes a class-based `ComponentErrorBoundary` that catches render errors per-demo.
- **Index page** (`page.tsx:14-35`): Filters registry for `registry:ui` items, renders each in a `ComponentWrapper` inside a `@container grid` layout.
- **Detail page** (`[name]/page.tsx:35-54`): Looks up component by URL param, renders full-width with `p-6` padding. Redirects on miss.
- **Demo pattern**: Each demo is a single named export function (e.g., `ButtonDemo`) in a `*-demo.tsx` file. Demos show component variations (sizes, variants, states) using flex layouts with gaps. All data is hardcoded inline.
- **Layout**: Standalone `SidebarProvider` with collapsible sidebar, sticky header with breadcrumbs, mode toggle, and theme selector.
- **Theme system**: `ActiveThemeProvider` context manages `document.body` class toggling across 4 axes (sizes, colors, fonts, radius). Persists to localStorage.

### Current Webview Architecture

The webview at `webview/src/` is a Vite + React 19 + Tailwind CSS v4 application:

- **No URL routing**: Navigation is state-machine-based via `useReducer` in `App.tsx:36-81`. The extension host sends `init` messages to set context (`sidebar` or `editorPanel`), and the webview renders the appropriate component tree.
- **Dual context**: A single bundle serves two UI contexts differentiated by the `init` message. The `sidebar` context renders `SidebarDashboard`; the `editorPanel` context renders `FindingList` or `FindingDetail`.
- **VS Code theme integration**: `index.css:5-25` maps `--vscode-*` CSS variables to ShadCN design tokens (`--background`, `--foreground`, `--primary`, etc.). Components automatically adopt the active VS Code theme.
- **Extension host dependency**: `useVSCodeAPI.ts:12` calls `acquireVsCodeApi()` at module scope. This function only exists inside a VS Code webview iframe. The app cannot run in a regular browser.
- **ShadCN components installed** (6 total): `badge`, `button`, `card`, `select`, `separator`, `table` (in `src/components/ui/`).
- **Application components** (5 total): `SidebarDashboard`, `FindingList`, `FindingDetail`, `SeverityBadge`, `DispositionBadge`.
- **CSP constraints**: The extension host generates HTML with strict CSP (`webviewHtml.ts:17`): `default-src 'none'; style-src ... 'unsafe-inline'; script-src 'nonce-...'`. No external resources (fonts, images, scripts) are permitted.
- **Fixed output filenames**: Vite must produce `assets/index.js` and `assets/index.css` with no content hashing (`vite.config.ts:14-18`). The extension host hardcodes these paths.

### Critical Constraints

| Constraint | Source | Impact |
|---|---|---|
| No React Router | Webview architecture | Sink navigation must use internal component state, not URL routing |
| `acquireVsCodeApi()` at module scope | `useVSCodeAPI.ts:12` | App cannot render outside VS Code; sink must be accessible inside the webview |
| Strict CSP | `webviewHtml.ts:17` | No external resources; only demo what we already have |
| Fixed output filenames | `vite.config.ts:14-18` | Single bundle; sink code must be tree-shakeable or gated |
| VS Code controls theme | `index.css` variable mapping | No theme selector needed; components render with the user's actual VS Code theme |
| `localResourceRoots` | `sidebarWebviewProvider.ts:27`, `findingsPanelManager.ts:27` | Only resources under `webview-dist/` are loadable |

## Detailed Findings

### 1. Navigation Strategy: Context-Based Routing

The webview's state machine in `App.tsx` already handles context switching via the `init` message. The sink fits naturally as a third context.

**Current state model** (`App.tsx:9-19`):

```typescript
interface AppState {
  context: 'sidebar' | 'editorPanel' | 'unknown';
  // ... other fields
  view: ViewState;
}
```

**Proposed extension**:

```typescript
interface AppState {
  context: 'sidebar' | 'editorPanel' | 'sink' | 'unknown';
  // ... existing fields
  view: ViewState;
  sinkView: 'index' | 'detail';
  sinkSelectedComponent: string | undefined;
}
```

When `context === 'sink'`, `App.tsx` renders the sink component tree. Sink-internal navigation (index grid vs. single component detail) is managed by `sinkView` and `sinkSelectedComponent` state fields, dispatched via local reducer actions (`SINK_SELECT_COMPONENT`, `SINK_BACK_TO_INDEX`). No React Router dependency is needed.

### 2. How the Sink Gets Activated

Three mechanisms, all compatible:

**A. VS Code command** (primary): Register a command `ashWorkbench.openKitchenSink` in `vsix/package.json` that creates a new `WebviewPanel` and sends `{ type: 'init', payload: { context: 'sink' } }`. This is the most discoverable path for developers.

**B. Dev-only sidebar link**: Add a link in `SidebarDashboard.tsx` (visible only when `import.meta.env.DEV` is true) that sends a message to the extension host requesting the sink panel. The extension host creates a new panel and sends the `sink` init message.

**C. Direct panel creation**: The `FindingsPanelManager` pattern in `findingsPanelManager.ts` can be replicated as a `SinkPanelManager` that creates a dedicated panel for the sink.

**Recommendation**: Option A + C. A `SinkPanelManager` class mirrors the existing `FindingsPanelManager` pattern. The command provides discoverability. The sidebar link (Option B) can be added later as a convenience.

### 3. Layout: Simplified for VS Code Context

The reference sink uses a full sidebar layout with `SidebarProvider`, `AppSidebar`, team switcher, breadcrumbs, etc. This is unnecessary and counterproductive for the VS Code webview:

- The sidebar components (`Sidebar`, `SidebarProvider`, `SidebarInset`, etc.) are NOT installed and would require 10+ new ShadCN component installations.
- VS Code already provides its own sidebar, activity bar, and navigation. A nested sidebar inside the webview would be confusing.
- The goal is to show how components look in the VS Code context, not to replicate a standalone web application layout.

**Recommended layout**: A single-page layout with a sticky header and a scrollable content area:

```
+------------------------------------------------------+
| Header: "Kitchen Sink" title | Search | Back to App  |
+------------------------------------------------------+
| Content area (scrollable):                           |
|   Index: grid of component cards                     |
|   Detail: single component full-width                |
+------------------------------------------------------+
```

The header includes:
- Title ("Kitchen Sink" or component name on detail view)
- A search/filter input (functional, filtering the registry client-side)
- A "Back to App" link on detail views (or close panel)

This matches the existing webview aesthetic (simple layouts, VS Code grey background, no competing navigation chrome).

### 4. Component Registry: Adapted for Webview

The reference registry pattern translates directly. The key change is that `href` becomes a registry key for state-machine navigation, not a URL path.

**Reference pattern** (`component-registry.ts:62-71`):

```typescript
type ComponentConfig = {
  name: string
  component: React.ComponentType
  className?: string
  type: "registry:ui" | "registry:page"
  href: string           // URL path like "/sink/button"
  label?: string
}
```

**Adapted pattern for webview**:

```typescript
type SinkComponentConfig = {
  name: string;
  component: React.ComponentType;
  className?: string;
  type: 'ui' | 'app';    // "app" replaces "page" — demos of application components
  label?: string;
}

const sinkRegistry: Record<string, SinkComponentConfig> = {
  badge: { name: 'Badge', component: BadgeDemo, type: 'ui' },
  button: { name: 'Button', component: ButtonDemo, type: 'ui' },
  // ...
};
```

Changes from reference:
- Remove `href` (navigation is state-based, keyed by the registry key)
- Rename `registry:ui` / `registry:page` to `ui` / `app` (simpler, no Next.js registry naming)
- Add `app` type for application-specific component demos (SeverityBadge, DispositionBadge, FindingList patterns)

### 5. Component Wrapper: Direct Translation

The `ComponentWrapper` from the reference (`component-wrapper.tsx:7-66`) translates almost directly. It needs no Next.js-specific code:

```typescript
function ComponentWrapper({ name, className, children }: {
  name: string; className?: string; children: React.ReactNode;
}) {
  return (
    <ComponentErrorBoundary name={name}>
      <div className={cn("flex w-full flex-col rounded-lg border", className)}>
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium">{getComponentName(name)}</div>
        </div>
        <div className="flex flex-1 items-center gap-2 p-4">{children}</div>
      </div>
    </ComponentErrorBoundary>
  );
}
```

The `ComponentErrorBoundary` class component and `getComponentName` utility can be copied verbatim from the reference.

### 6. Demo Component Pattern: Translation Guide

Each reference demo imports from `@/registry/new-york-v4/ui/*`. In the webview, imports come from `@/components/ui/*`. The translation is mechanical:

| Reference Import | Webview Import |
|---|---|
| `@/registry/new-york-v4/ui/button` | `@/components/ui/button` |
| `@/registry/new-york-v4/ui/badge` | `@/components/ui/badge` |
| `@/registry/new-york-v4/ui/card` | `@/components/ui/card` |
| `@/lib/utils` | `@/lib/utils` (same) |

**What to strip from reference demos**:
- `"use client"` directives (Vite has no RSC)
- `next/image` `Image` component (replace with `<img>` or omit if external URL)
- `next/link` `Link` component (replace with `<button>` or `<a>` with onClick)
- External image URLs (skip demos that rely on external images)
- External font references (VS Code provides the font)

**What to keep verbatim**:
- The JSX structure and className values
- Tailwind utility classes
- Lucide icon imports
- Hardcoded demo data
- The overall component variation pattern (showing sizes, variants, states)

**Example translation** (button-demo):

Reference (`button-demo.tsx:5-105`) imports from `@/registry/new-york-v4/ui/button`. The webview version changes only the import path:

```typescript
// Reference:
import { Button } from "@/registry/new-york-v4/ui/button"

// Webview:
import { Button } from "@/components/ui/button"
```

The JSX body remains identical. The button will render with VS Code theme colors because `--primary` maps to `--vscode-button-background` in `index.css:12`.

### 7. ShadCN Components: What's Available vs. What's Needed

**Currently installed** (6 components in `src/components/ui/`):

| Component | ShadCN Version | Notes |
|---|---|---|
| `badge` | Standard (older) | Missing `ghost`, `link` variants and `asChild` prop that v4 demos use |
| `button` | Standard (older) | Missing `xs`, `icon-xs`, `icon-sm`, `icon-lg` sizes that v4 demos use |
| `card` | Standard (older) | Full featured, compatible |
| `select` | Standard (older) | Full featured, compatible |
| `separator` | Standard (older) | Full featured, compatible |
| `table` | Standard (older) | Full featured, compatible |

**Phase 1 demos** (using only installed components):

- `badge-demo` — show all 4 existing variants (default, secondary, destructive, outline)
- `button-demo` — show existing 4 sizes (default, sm, lg, icon) and 6 variants
- `card-demo` — simplified version of reference (no Avatar, no Image dependencies)
- `select-demo` — fruit picker, disabled state, large list
- `separator-demo` — horizontal + vertical, directly from reference
- `table-demo` — invoice table, directly from reference
- `severity-badge-demo` — showcase the 5 severity color badges (app component)
- `disposition-badge-demo` — showcase the 4 disposition color badges (app component)

**Phase 2** (install additional ShadCN components as needed):

Priority new installations (each via `npx shadcn@latest add <name> --yes`):

| Component | Why | Demo Complexity |
|---|---|---|
| `input` | Fundamental form control | Low |
| `label` | Pairs with input/select | Low |
| `dialog` | Common overlay pattern | Medium |
| `tooltip` | Essential for icon-only buttons | Low |
| `switch` | Settings/toggle pattern | Low |
| `checkbox` | Form pattern | Low |
| `alert` | Feedback pattern | Low |
| `tabs` | Layout pattern | Medium |
| `accordion` | Collapsible content | Medium |
| `progress` | Loading states | Low |
| `skeleton` | Loading placeholders | Low |
| `textarea` | Multi-line input | Low |

### 8. Theme Considerations: VS Code Native

The reference sink's theme system (`ActiveThemeProvider`, `ThemeSelector`) is **not needed**. The purpose of the ASH Workbench sink is different from the shadcn reference:

| | shadcn Reference | ASH Workbench Sink |
|---|---|---|
| **Purpose** | Show components across many design themes | Show components as they render in VS Code |
| **Theme source** | `ActiveThemeProvider` context, 4 axes | VS Code's active color theme |
| **Dark/light** | `ModeSwitcher` toggle | Inherits from VS Code (`vscode-dark` / `vscode-light` body class) |
| **Fonts** | Inter, Noto Sans, Nunito Sans, Figtree | VS Code's configured font (`--vscode-font-family`) |

The VS Code theme integration in `index.css` means components automatically render with correct colors, backgrounds, borders, and focus rings for any VS Code theme. **This is the feature, not a limitation.** Developers want to see how components actually look in context.

One useful addition: display the current VS Code theme name and color scheme in the sink header, so developers know which theme they're previewing. This can be read from VS Code CSS variables or injected via message.

### 9. Index Page: Grid Layout

The reference uses `@container grid` (`page.tsx:16`):

```tsx
<div className="@container grid flex-1 gap-4 p-4">
```

This uses CSS container queries so the grid responds to the container width, not viewport width. This is especially useful in VS Code where the webview panel can be resized independently.

**Adaptation**: Use the same pattern. Tailwind CSS v4 supports `@container` natively. The grid will respond to the webview panel width, which is exactly what we want.

### 10. Detail View: State-Machine Navigation

The reference uses Next.js dynamic routes (`[name]/page.tsx`). The webview adaptation uses state:

```typescript
// In the reducer:
case 'SINK_SELECT_COMPONENT': {
  const config = sinkRegistry[action.componentKey];
  if (config) {
    return { ...state, sinkView: 'detail', sinkSelectedComponent: action.componentKey };
  }
  return state;
}
case 'SINK_BACK_TO_INDEX':
  return { ...state, sinkView: 'index', sinkSelectedComponent: undefined };
```

The detail view renders the selected component at full width with `p-6` padding, matching the reference's `[name]/page.tsx:50`:

```tsx
<div className="p-6">
  <Component />
</div>
```

A breadcrumb-style back link at the top provides navigation:

```tsx
<div className="flex items-center gap-2 text-xs">
  <button className="opacity-70 hover:opacity-100 underline" onClick={onBackToIndex}>
    Kitchen Sink
  </button>
  <span className="opacity-50">&gt;</span>
  <span>{componentName}</span>
</div>
```

This mirrors the existing breadcrumb pattern in `FindingDetail.tsx:25-34`.

### 11. Dev-Only Gating

The reference uses `import.meta.env.DEV` at the route level for tree-shaking. The webview can use the same Vite environment variable:

```typescript
// In App.tsx, the sink import and context handler:
const SinkPage = import.meta.env.DEV
  ? React.lazy(() => import('./pages/sink/SinkPage'))
  : null;

// In the render:
if (state.context === 'sink' && SinkPage) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SinkPage />
    </React.Suspense>
  );
}
```

With `React.lazy` and the `import.meta.env.DEV` guard, Vite will completely eliminate the sink code from production builds. The lazy import also means the sink module tree (all demo files, registry) is only loaded when the sink context is active.

**On the extension side**, the `ashWorkbench.openKitchenSink` command should also be conditionally registered or hidden based on a development flag.

### 12. Message Protocol Extension

The message protocol (`messages.ts`) needs two additions:

**Extension to Webview** (add to `ExtToWebviewMessage`):

```typescript
| { type: 'init'; payload: { context: 'sink' } }
```

**Webview to Extension** (add to `WebviewToExtMessage`):

```typescript
| { type: 'openSink' }
```

The `openSink` message lets the sidebar webview request a sink panel (for the dev-only link). The extension host's `SinkPanelManager` handles this by creating a new `WebviewPanel` with the `sink` context.

### 13. File Organization

**Proposed directory structure** under `webview/src/`:

```
src/
  pages/
    sink/
      SinkPage.tsx              # Root sink component (layout + routing state)
      SinkIndexPage.tsx         # Grid of all demo cards
      SinkDetailPage.tsx        # Single component detail view
      sink-registry.ts          # Component registry
      components/
        component-wrapper.tsx   # Card wrapper + error boundary
        sink-header.tsx         # Sticky header with title + search + back link
      demos/
        badge-demo.tsx          # One file per component demo
        button-demo.tsx
        card-demo.tsx
        select-demo.tsx
        separator-demo.tsx
        table-demo.tsx
        severity-badge-demo.tsx
        disposition-badge-demo.tsx
```

This keeps sink code isolated under `pages/sink/` and follows the reference's one-file-per-demo convention. The `pages/` directory is new but establishes a pattern for future multi-page layouts.

## Patterns and Conventions

### Demo File Convention

Each demo file exports a single named component:

```typescript
// demos/button-demo.tsx
import { Button } from '@/components/ui/button';

export function ButtonDemo() {
  return (
    <div className="flex flex-col gap-6">
      {/* Variation groups */}
    </div>
  );
}
```

Rules:
- One demo per file, named `{component-name}-demo.tsx` (kebab-case)
- Named export, not default export (e.g., `export function ButtonDemo()`)
- No external data dependencies (all demo data inline)
- No extension host message calls (demos are pure visual components)
- Import UI components from `@/components/ui/*`
- Import app components from `@/components/*`

### Registry Convention

```typescript
// sink-registry.ts
export const sinkRegistry: Record<string, SinkComponentConfig> = {
  // Key is kebab-case, matches filename without "-demo"
  badge: { name: 'Badge', component: BadgeDemo, type: 'ui' },
  // ...
};
```

New component addition checklist:
1. Create `demos/{name}-demo.tsx`
2. Import and register in `sink-registry.ts`
3. Set `type: 'ui'` for ShadCN primitives, `type: 'app'` for application components

### CSS Compatibility

All Tailwind utilities used in the reference demos are compatible with Tailwind CSS v4. Key utilities that work:

- Flex/grid layouts: `flex`, `grid`, `gap-*`, `flex-wrap`
- Sizing: `w-full`, `max-w-sm`, `h-*`, `size-*`
- Spacing: `p-*`, `px-*`, `py-*`, `space-*`
- Typography: `text-sm`, `font-medium`, `leading-none`, `tracking-tight`
- Borders: `border`, `border-b`, `rounded-lg`, `rounded-full`
- Colors: `bg-*`, `text-*`, `opacity-*`
- Container queries: `@container`, `@md:*`
- State variants: `hover:*`, `focus:*`, `disabled:*`, `data-[state=*]:*`

The VS Code theme variable mappings in `index.css` ensure that semantic color tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.) render correctly.

## Configuration and Environment

| Setting | Value | Source |
|---|---|---|
| Dev-only inclusion | `import.meta.env.DEV` | Vite environment variable |
| Sink context | `'sink'` | Extension host `init` message |
| VS Code theme | Automatic via CSS variables | `index.css` variable mappings |
| CSP | No external resources | `webviewHtml.ts:17` |
| Build output | `dist/assets/index.js` | `vite.config.ts` (unchanged) |

No new environment variables or configuration files are needed.

## Testing

The sink is a dev-only visual feature with no automated test path. Verification is manual:

1. Open VS Code with the extension in development mode
2. Run the `ASH: Open Kitchen Sink` command
3. Verify the index page renders all demo cards without errors
4. Click individual components to verify detail view rendering
5. Test with multiple VS Code themes (Dark+, Light+, High Contrast, custom themes)
6. Verify the production build (`npm run build`) does NOT include sink code
7. Verify the sink panel creation doesn't interfere with sidebar or findings panel functionality

## Issues and Risks

### ShadCN Component Version Gap

The installed ShadCN components (badge, button, etc.) are proof-of-concept leftovers using an older version. The reference demos use features not present in these versions:

- `Badge`: v4 adds `ghost`, `link` variants and `asChild` prop (reference `badge-demo.tsx:13-14`)
- `Button`: v4 adds `xs`, `icon-xs`, `icon-sm`, `icon-lg` sizes (reference `button-demo.tsx:9-101`)

**Resolution**: Regenerate all 6 existing components to the latest version with `npx shadcn@latest add badge button card select separator table --yes --overwrite` before writing any demos. The old components are throwaway POC code. Use the ShadCN MCP server tools (`mcp__shadcn__view_items_in_registries`, `mcp__shadcn__get_item_examples_from_registries`) to inspect component APIs and pull official examples when writing demos.

### External Resource Dependencies in Reference Demos

Several reference demos depend on external resources (Unsplash images in `card-demo.tsx:125-129`, GitHub avatars in `card-demo.tsx:97-113`, `avatar-demo.tsx`). CSP blocks these, and there is no reason to work around it. Simply skip demo sections that require external images and only demo what we have. The card demo, for example, works fine without the image card variant.

### Bundle Size Impact

Even with `import.meta.env.DEV` gating and `React.lazy`, the sink adds dev-mode overhead:

- Demo files: ~50-100KB (TypeScript source, compressed)
- Additional ShadCN components (Phase 2): ~5-20KB per component

**Mitigation**: Vite's tree-shaking eliminates all sink code in production builds. Dev-mode bundle size is acceptable since it doesn't affect the shipped extension.

### Radix Portal and CSP

Some ShadCN components (Dialog, Select, Popover) use Radix portals that render content at the document root. In VS Code webviews, this works because:

- The `<div id="root">` is inside the webview iframe
- Portals render inside the same iframe
- CSP allows `'unsafe-inline'` styles (needed for Radix positioning)

The existing `Select` component already uses portals successfully in `FindingList.tsx`, confirming this is not a problem.

### No Hot Reload During Development

The webview loads static built assets from `webview-dist/`. During development:

- Changes to sink demos require `npm run build` in `webview/` and reloading the webview panel
- There is no HMR (Hot Module Replacement) for webview content

**Mitigation**: This is an existing limitation, not introduced by the sink. The `npm run watch` command can automate rebuilds on file change.

## Key Takeaways

1. **No React Router needed**: The sink plugs into the existing state machine via a new `'sink'` context. Internal navigation uses reducer actions, not URLs.

2. **No theme system needed**: The VS Code theme integration in `index.css` IS the theme system. The sink shows components as they actually render in the user's VS Code environment.

3. **Component demos translate mechanically**: Change `@/registry/new-york-v4/ui/*` to `@/components/ui/*`, remove `"use client"`, remove Next.js imports. The JSX structure and Tailwind classes transfer verbatim.

4. **Start with 8 demos**: The 6 installed ShadCN components + 2 app component demos provide immediate value. Additional components can be installed incrementally.

5. **Dev-only by default**: `import.meta.env.DEV` + `React.lazy` ensures zero production impact. Mirror the reference's gating strategy exactly.

6. **Only demo what we have**: Skip reference demo sections that require external images or fonts. The VS Code font and theme are the correct styling -- no workarounds needed.

7. **Extension host needs a `SinkPanelManager`**: Follow the existing `FindingsPanelManager` pattern. Register a VS Code command for discoverability.

8. **Error boundaries are essential**: Copy the `ComponentErrorBoundary` from the reference. Each demo renders in isolation so a broken demo doesn't crash the showcase.

## Resolved Questions

### Activation UX

**Decision**: Visible to all users of the development build. The `import.meta.env.DEV` guard handles bundle exclusion; the VS Code command should be registered when `ExtensionMode.Development` is active and visible without any additional settings flag.

### Component Installation Strategy

**Decision**: Install all Phase 2 ShadCN components in a single batch upfront. This avoids incremental install churn and lets demo authors pick from the full palette immediately.

### Application Component Demos

**Decision**: Yes. The sink should include composite application pattern demos (mock `FindingList` with sample data, mock `SidebarDashboard`, filter bar patterns) in addition to ShadCN primitive demos. These go in the registry with `type: 'app'` and show how primitives compose into real ASH Workbench UI.

### Search Functionality

**Decision**: Yes. Implement a simple text filter in the sink header that filters registry entries by name. Given the smaller component count (~20-30 vs. 55+ in the reference), a basic client-side filter is sufficient.

## Recommended Implementation Plan

### Phase 1: Foundation - Sink infrastructure and first demos

1. **Add sink context to state machine** - Extend `AppState` type in `App.tsx` with `'sink'` context, `sinkView`, and `sinkSelectedComponent` fields; add reducer cases for `SINK_SELECT_COMPONENT` and `SINK_BACK_TO_INDEX`
2. **Extend message protocol** - Add `{ type: 'init'; payload: { context: 'sink' } }` to `ExtToWebviewMessage` and `{ type: 'openSink' }` to `WebviewToExtMessage` in both `webview/src/types/messages.ts` and `vsix/src/models/messages.ts`
3. **Create sink page infrastructure** - Build `SinkPage.tsx` (root component with layout and routing state), `SinkIndexPage.tsx` (grid), `SinkDetailPage.tsx` (single component), `sink-registry.ts`, `component-wrapper.tsx`, and `sink-header.tsx` under `src/pages/sink/`
4. **Wire sink into App.tsx** - Add `React.lazy` import gated by `import.meta.env.DEV` and render sink context in the main component tree
5. **Create Phase 1 demos** - Write 8 demo files: `badge-demo`, `button-demo`, `card-demo`, `select-demo`, `separator-demo`, `table-demo`, `severity-badge-demo`, `disposition-badge-demo`

### Phase 2: Extension host integration - Make the sink accessible

1. **Create `SinkPanelManager`** - New class in `vsix/src/providers/` following the `FindingsPanelManager` pattern; creates a `WebviewPanel` and sends `{ type: 'init', payload: { context: 'sink' } }`
2. **Register VS Code command** - Add `ashWorkbench.openKitchenSink` to `package.json` contributes and register in `extension.ts`
3. **Gate command visibility** - Make the command available only in development builds (check `ExtensionMode.Development` in activation)
4. **Add sidebar dev link** - Optional: add a "Kitchen Sink" link in `SidebarDashboard.tsx` gated by `import.meta.env.DEV` that sends `openSink` message

### Phase 3: Expand component coverage - Demo additional components and application patterns

1. **Batch-install all Phase 2 ShadCN components** - Run `npx shadcn@latest add input label dialog tooltip switch checkbox alert tabs accordion progress skeleton textarea --yes` in a single batch upfront
2. **Write demos for each new component** - One demo file per component following the established pattern, registered in `sink-registry.ts`
3. **Add application pattern demos** - Create composite demos showing how UI primitives compose into real ASH Workbench patterns: mock `FindingList` with sample data, mock `SidebarDashboard`, filter bar patterns, disposition controls. Register with `type: 'app'` in the registry

### Phase 4: Polish and documentation

1. **Add search/filter to sink header** - Client-side text filter over registry entries by name for quick component lookup
2. **Add VS Code theme info display** - Show current theme name and color scheme in the sink header
3. **Update developer docs** - Document the sink in `docs/docs/developer-docs/` with component addition instructions and demo conventions
4. **Update webview CLAUDE.md and README.md** - Add sink-related conventions and file inventory
