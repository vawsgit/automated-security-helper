---
title: sink-integration-plan
draft: true
sidebar_label: Sink Integration Plan
sidebar_position: 5
---

# :white_large_square: Kitchen Sink Integration Plan

## 1. Executive Summary

Add a dev-only Kitchen Sink component showcase to the ASH Workbench webview, accessible via a VS Code command. The sink renders every installed UI primitive and application component against the user's actual VS Code theme, giving builders a living reference without leaving the extension.

- **Architecture**: New `'sink'` webview context, activated by `SinkPanelManager` on the extension host side. `SinkPage` owns all its own state (index/detail navigation, search filter) via local `useState` -- fully isolated from the existing `App.tsx` reducer.
- **Gating**: `import.meta.env.DEV` + `React.lazy` on the webview side; `ExtensionMode.Development` on the extension host side. Zero production bundle impact.
- **Scope**: Phase 1 delivers end-to-end infrastructure + 8 demos (6 ShadCN + 2 app components). Phase 2 batch-installs 12 additional ShadCN components, writes demos for each, and adds composite application pattern demos. Phase 3 adds search/filter and documentation.

## !!!Important!!! ShadCN Components and MCP Tools

### Use Latest ShadCN Components Only

The 6 existing ShadCN components in `src/components/ui/` (badge, button, card, select, separator, table) are **proof-of-concept leftovers using an older version**. They must be **regenerated to the latest ShadCN version** before any sink work begins. Do not write demos against the old component APIs.

Regenerate all existing components:

```bash
cd webview
npx shadcn@latest add badge button card select separator table --yes --overwrite
```

This gives us the latest variants (badge: `ghost`, `link`, `asChild`; button: `xs`, `icon-xs`, `icon-sm`, `icon-lg`; etc.) and ensures demos match the shadcn v4 reference exactly.

### Use the ShadCN MCP Server Tools

When installing or inspecting ShadCN components, **always prefer the shadcn MCP server tools** over the CLI where possible. The following MCP tools are available and should be used:

| Tool | When to Use |
|---|---|
| `mcp__shadcn__list_items_in_registries` | List all available components in the ShadCN registry before installing |
| `mcp__shadcn__search_items_in_registries` | Search for a specific component by name |
| `mcp__shadcn__view_items_in_registries` | View component source code and dependencies before installing |
| `mcp__shadcn__get_item_examples_from_registries` | Get official example usage for a component -- use as reference when writing demos |
| `mcp__shadcn__get_add_command_for_items` | Get the exact CLI command to install a component |
| `mcp__shadcn__get_project_registries` | Check which registries the project is configured to use |
| `mcp__shadcn__get_audit_checklist` | Audit installed components for issues |

**Workflow for adding any ShadCN component**:

1. `mcp__shadcn__view_items_in_registries` -- inspect the component source and dependencies
2. `mcp__shadcn__get_item_examples_from_registries` -- get official examples to adapt for demos
3. `mcp__shadcn__get_add_command_for_items` -- get the install command
4. Run the install command
5. Write the demo file using the official examples as a starting point

This ensures components are installed correctly with all dependencies and demos reflect the official API.

## 2. What Will Be Done

- **Regenerate all 6 existing ShadCN components to latest version** (badge, button, card, select, separator, table)
- Extend the webview message protocol with a `'sink'` context
- Create `SinkPanelManager` on the extension host (mirrors `FindingsPanelManager`)
- Register `ashWorkbench.openKitchenSink` VS Code command (dev builds only)
- Build a self-contained `SinkPage` with index grid and detail views
- Create a component registry, component wrapper with error boundary, and sticky header
- Write 8 Phase 1 demo files for existing ShadCN and app components
- Batch-install 12 new ShadCN components and write demos for each
- Add composite application pattern demos (`type: 'app'`)
- Implement client-side search/filter in the sink header
- Update `CLAUDE.md`, `README.md`, and developer docs

## 3. What Will NOT Be Done

- No React Router -- navigation is local component state inside `SinkPage`
- No theme selector -- VS Code theme integration via CSS variables IS the theme system
- No external fonts or images -- only demo what's already available under CSP
- No sidebar layout replication -- simplified header + content area layout only
- No changes to the existing sidebar or editor panel contexts
- No production-visible UI -- everything gated behind dev flags
- No automated tests -- sink is visual-only, verified manually

## 4. Files to Modify

```
webview/
  src/
    App.tsx                                    # MODIFY - add sink context + React.lazy
    types/messages.ts                          # MODIFY - add sink init + openSink messages
    pages/                                     # CREATE directory
      sink/
        SinkPage.tsx                           # CREATE - root component, owns all sink state
        SinkIndexPage.tsx                      # CREATE - grid of component cards
        SinkDetailPage.tsx                     # CREATE - single component detail view
        sink-registry.ts                       # CREATE - component registry
        components/
          component-wrapper.tsx                # CREATE - card + error boundary
          sink-header.tsx                      # CREATE - sticky header with search
        demos/
          badge-demo.tsx                       # CREATE
          button-demo.tsx                      # CREATE
          card-demo.tsx                        # CREATE
          select-demo.tsx                      # CREATE
          separator-demo.tsx                   # CREATE
          table-demo.tsx                       # CREATE
          severity-badge-demo.tsx              # CREATE
          disposition-badge-demo.tsx           # CREATE
          input-demo.tsx                       # CREATE (Phase 2)
          label-demo.tsx                       # CREATE (Phase 2)
          dialog-demo.tsx                      # CREATE (Phase 2)
          tooltip-demo.tsx                     # CREATE (Phase 2)
          switch-demo.tsx                      # CREATE (Phase 2)
          checkbox-demo.tsx                    # CREATE (Phase 2)
          alert-demo.tsx                       # CREATE (Phase 2)
          tabs-demo.tsx                        # CREATE (Phase 2)
          accordion-demo.tsx                   # CREATE (Phase 2)
          progress-demo.tsx                    # CREATE (Phase 2)
          skeleton-demo.tsx                    # CREATE (Phase 2)
          textarea-demo.tsx                    # CREATE (Phase 2)
          finding-list-demo.tsx                # CREATE (Phase 2) - app pattern
          sidebar-dashboard-demo.tsx           # CREATE (Phase 2) - app pattern
          filter-bar-demo.tsx                  # CREATE (Phase 2) - app pattern

vsix/
  src/
    models/messages.ts                         # MODIFY - add sink init + openSink messages
    providers/sinkPanelManager.ts              # CREATE - webview panel manager
    extension.ts                               # MODIFY - register command + manager
  package.json                                 # MODIFY - add command contribution

webview/CLAUDE.md                              # MODIFY - add sink conventions
webview/README.md                              # MODIFY - add sink file inventory
```

## 5. Implementation Phases

### :white_large_square: Phase 1: End-to-End Sink with Initial Demos

Delivers the complete vertical slice: command, panel manager, webview infrastructure, and 8 working demos.

**Step 1: Message protocol** -- Add `{ type: 'init'; payload: { context: 'sink' } }` to `ExtToWebviewMessage` and `{ type: 'openSink' }` to `WebviewToExtMessage` in both `webview/src/types/messages.ts` and `vsix/src/models/messages.ts`.

**Step 2: SinkPanelManager** -- Create `vsix/src/providers/sinkPanelManager.ts` following the `FindingsPanelManager` pattern. On `show()`, create a `WebviewPanel` titled "ASH Kitchen Sink" and send `{ type: 'init', payload: { context: 'sink' } }`. Handle only `requestState` (re-send init).

**Step 3: Command registration** -- Add `ashWorkbench.openKitchenSink` to `vsix/package.json` contributes.commands. In `extension.ts`, instantiate `SinkPanelManager` and register the command gated behind `context.extensionMode === vscode.ExtensionMode.Development`. Wire `SidebarWebviewProvider` to handle `openSink` messages by delegating to the sink manager.

**Step 4: Sink infrastructure in webview** -- Create the `pages/sink/` directory structure:

- `sink-registry.ts` -- `Record<string, SinkComponentConfig>` with `{ name, component, type, className?, label? }`
- `components/component-wrapper.tsx` -- Bordered card with name header + `ComponentErrorBoundary` (from reference)
- `components/sink-header.tsx` -- Sticky header with title (or breadcrumb on detail), search input (wired in Phase 3), close button
- `SinkIndexPage.tsx` -- `@container grid` rendering all registry entries inside `ComponentWrapper`
- `SinkDetailPage.tsx` -- Renders selected component at full width with breadcrumb back-link
- `SinkPage.tsx` -- Root component. Owns state via `useState`: `view` (`'index'` | `'detail'`), `selectedComponent` (`string | undefined`), `searchFilter` (`string`). Renders header + index or detail page.

**Step 5: Wire sink into App.tsx** -- Add dev-gated lazy import and render:

```typescript
const SinkPage = import.meta.env.DEV
  ? React.lazy(() => import('./pages/sink/SinkPage'))
  : null;
```

In the `init` message handler, add `case 'sink'` that sets `context: 'sink'`. In the render, add:

```typescript
if (state.context === 'sink' && SinkPage) {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen opacity-50"><p className="text-sm">Loading...</p></div>}>
      <SinkPage />
    </React.Suspense>
  );
}
```

**Step 6: Regenerate existing ShadCN components to latest** -- Use MCP tools to inspect then regenerate:

```bash
cd webview
npx shadcn@latest add badge button card select separator table --yes --overwrite
```

Use `mcp__shadcn__get_item_examples_from_registries` to pull official examples for each component. This gives us the full v4 API (badge ghost/link variants, button xs/icon sizes, etc.) and ensures demos can use the complete feature set.

**Step 7: Phase 1 demos** -- Write 8 demo files under `pages/sink/demos/`:

| Demo | Source | Notes |
|---|---|---|
| `badge-demo` | Adapt reference | All variants including ghost, link; asChild usage; icon badges |
| `button-demo` | Adapt reference | All sizes (xs, sm, default, lg, icon-*) x all variants; disabled state |
| `card-demo` | Adapt reference | Login card, meeting notes card, content/header/footer combos. Skip image and avatar cards |
| `select-demo` | Adapt reference | Fruit picker, large list, disabled state |
| `separator-demo` | Copy reference | Horizontal + vertical. Minimal adaptation |
| `table-demo` | Copy reference | Invoice table with header, body, footer, caption |
| `severity-badge-demo` | New | All 5 severity levels rendered side by side |
| `disposition-badge-demo` | New | All 4 dispositions rendered side by side |

Register all 8 in `sink-registry.ts`.

**Step 8: Build and verify** -- Run `npm run build` in webview, then `npm run build` in vsix. Launch extension in development mode. Run "ASH: Open Kitchen Sink" command. Verify index grid renders all 8 demos, clicking navigates to detail view, breadcrumb navigates back.

### :white_large_square: Phase 2: Expanded Component Coverage

Batch-install new ShadCN components and write demos for all of them plus composite application patterns.

**Step 1: Batch-install ShadCN components** -- Use `mcp__shadcn__get_add_command_for_items` to get the correct install commands, then run from `webview/`:

```bash
npx shadcn@latest add input label dialog tooltip switch checkbox alert tabs accordion progress skeleton textarea --yes
```

**Step 2: Write ShadCN demos** -- 12 demo files, one per new component. For each component, use `mcp__shadcn__get_item_examples_from_registries` to pull official examples as the starting point for demos. Each follows the established pattern (named export, variations in flex layouts, hardcoded data). Skip any demo sections that need external images.

| Demo | Complexity | Key variations |
|---|---|---|
| `input-demo` | Low | Types: email, password, number, file, disabled |
| `label-demo` | Low | Paired with input, standalone |
| `dialog-demo` | Medium | Form dialog, scrollable content |
| `tooltip-demo` | Low | Positions, with icon button |
| `switch-demo` | Low | Sizes, custom colors, card-style |
| `checkbox-demo` | Low | Checked, unchecked, disabled, with label |
| `alert-demo` | Low | Default, destructive, with icons |
| `tabs-demo` | Medium | Default, with content panels |
| `accordion-demo` | Medium | Single/multiple expand |
| `progress-demo` | Low | Various percentages, animated |
| `skeleton-demo` | Low | Avatar + text, card skeleton |
| `textarea-demo` | Low | Default, disabled, with character count |

**Step 3: Application pattern demos** -- 3 composite demos showing how primitives compose into ASH Workbench UI:

| Demo | Type | What it shows |
|---|---|---|
| `finding-list-demo` | `app` | Mock findings table with severity badges, disposition badges, clickable rows, filter toggles. Uses hardcoded sample data (3-5 findings) |
| `sidebar-dashboard-demo` | `app` | Mock sidebar with scan summary, triage badges, action buttons. Standalone rendering of the sidebar pattern |
| `filter-bar-demo` | `app` | Severity toggle badges + disposition toggle badges + scanner select dropdown. Demonstrates the filter interaction pattern |

**Step 4: Register all new demos** in `sink-registry.ts`. Verify index grid and detail views for all ~23 demos.

### :white_large_square: Phase 3: Search, Polish, and Documentation

**Step 1: Wire search filter** -- In `sink-header.tsx`, connect the search input to `SinkPage`'s `searchFilter` state. `SinkIndexPage` receives `searchFilter` as a prop and filters registry entries where `name.toLowerCase().includes(filter)`. Clear button resets the filter.

**Step 2: Add VS Code theme info** -- Display the current color scheme (dark/light/high-contrast) in the sink header. Read from `document.body.className` (VS Code sets `vscode-dark`, `vscode-light`, or `vscode-high-contrast`).

**Step 3: Update `webview/CLAUDE.md`** -- Add sink conventions: file location, demo pattern, registry addition checklist, dev-only gating.

**Step 4: Update `webview/README.md`** -- Add sink section to file inventory and component reference.

**Step 5: Update developer docs** -- Add a page at `docs/docs/developer-docs/` documenting how to add new components to the sink (create demo, register, rebuild).

## 6. Phase 0: UI-First

Not applicable as a separate phase. Phase 1 IS the UI-first delivery -- it builds the complete visual showcase with mock/static data. The sink has no backend integration beyond the `init` message.

## 7. Code Implementation Samples

### SinkPage (root component with local state)

```typescript
// pages/sink/SinkPage.tsx
import { useState } from 'react';
import { SinkHeader } from './components/sink-header';
import { SinkIndexPage } from './SinkIndexPage';
import { SinkDetailPage } from './SinkDetailPage';

export default function SinkPage() {
  const [view, setView] = useState<'index' | 'detail'>('index');
  const [selectedComponent, setSelectedComponent] = useState<string | undefined>();
  const [searchFilter, setSearchFilter] = useState('');

  const handleSelect = (key: string) => {
    setSelectedComponent(key);
    setView('detail');
  };

  const handleBack = () => {
    setSelectedComponent(undefined);
    setView('index');
  };

  return (
    <div className="flex flex-col min-h-screen">
      <SinkHeader
        selectedComponent={selectedComponent}
        searchFilter={searchFilter}
        onSearchChange={setSearchFilter}
        onBack={view === 'detail' ? handleBack : undefined}
      />
      {view === 'index' ? (
        <SinkIndexPage searchFilter={searchFilter} onSelect={handleSelect} />
      ) : selectedComponent ? (
        <SinkDetailPage componentKey={selectedComponent} onBack={handleBack} />
      ) : null}
    </div>
  );
}

SinkPage.displayName = 'SinkPage';
```

### SinkIndexPage (grid of cards)

```typescript
// pages/sink/SinkIndexPage.tsx
import { sinkRegistry } from './sink-registry';
import { ComponentWrapper } from './components/component-wrapper';

interface SinkIndexPageProps {
  searchFilter: string;
  onSelect: (key: string) => void;
}

export function SinkIndexPage({ searchFilter, onSelect }: SinkIndexPageProps) {
  const filtered = Object.entries(sinkRegistry).filter(
    ([, config]) => config.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="@container grid flex-1 gap-4 p-4">
      {filtered.map(([key, config]) => {
        const Demo = config.component;
        return (
          <ComponentWrapper
            key={key}
            name={key}
            className={config.className}
            onClick={() => onSelect(key)}
          >
            <Demo />
          </ComponentWrapper>
        );
      })}
      {filtered.length === 0 && (
        <div className="text-center opacity-50 py-8 text-sm">
          No components match "{searchFilter}"
        </div>
      )}
    </div>
  );
}
```

### Component registry

```typescript
// pages/sink/sink-registry.ts
import { BadgeDemo } from './demos/badge-demo';
import { ButtonDemo } from './demos/button-demo';
// ... other imports

export type SinkComponentConfig = {
  name: string;
  component: React.ComponentType;
  className?: string;
  type: 'ui' | 'app';
  label?: string;
};

export const sinkRegistry: Record<string, SinkComponentConfig> = {
  badge: { name: 'Badge', component: BadgeDemo, type: 'ui' },
  button: { name: 'Button', component: ButtonDemo, type: 'ui' },
  // ...
};
```

### ComponentWrapper with error boundary

```typescript
// pages/sink/components/component-wrapper.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

interface ComponentWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
}

export function ComponentWrapper({ name, className, children, ...props }: ComponentWrapperProps) {
  return (
    <ComponentErrorBoundary name={name}>
      <div
        className={cn("flex w-full scroll-mt-16 flex-col rounded-lg border", className)}
        {...props}
      >
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium">{getComponentName(name)}</div>
        </div>
        <div className="flex flex-1 items-center gap-2 p-4">{children}</div>
      </div>
    </ComponentErrorBoundary>
  );
}

class ComponentErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; name: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in component ${this.props.name}:`, error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div className="p-4 text-red-500">Something went wrong in: {this.props.name}</div>;
    }
    return this.props.children;
  }
}

function getComponentName(name: string) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
```

### SinkPanelManager (extension host)

```typescript
// vsix/src/providers/sinkPanelManager.ts
import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';

export class SinkPanelManager {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.webview.postMessage({ type: 'init', payload: { context: 'sink' } });
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'ashWorkbench.kitchenSink',
      'ASH Kitchen Sink',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'webview-dist')],
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri);
    this.panel.webview.onDidReceiveMessage(() => {
      this.panel?.webview.postMessage({ type: 'init', payload: { context: 'sink' } });
    });
    this.panel.onDidDispose(() => { this.panel = undefined; });
  }
}
```

### App.tsx integration (minimal change)

```typescript
// In App.tsx - add to imports:
import React from 'react';

// After existing imports, add dev-gated lazy import:
const SinkPage = import.meta.env.DEV
  ? React.lazy(() => import('./pages/sink/SinkPage'))
  : null;

// In AppState interface, add 'sink' to context union:
context: 'sidebar' | 'editorPanel' | 'sink' | 'unknown';

// In reducer, init case - add before the editorPanel return:
if (msg.payload.context === 'sink') {
  return { ...state, context: 'sink' };
}

// In App render, add before the unknown/loading fallback:
if (state.context === 'sink' && SinkPage) {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-screen opacity-50">
        <p className="text-sm">Loading...</p>
      </div>
    }>
      <SinkPage />
    </React.Suspense>
  );
}
```

### Demo file pattern (example: badge-demo)

```typescript
// pages/sink/demos/badge-demo.tsx
import { Badge } from '@/components/ui/badge';

export function BadgeDemo() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
    </div>
  );
}
```

## 8. Testing Strategy

All testing is manual (dev-only visual feature):

**Phase 1 verification**:
- Run "ASH: Open Kitchen Sink" command in development mode -- panel opens
- Index page shows 8 component cards in a responsive grid
- Click a card -- navigates to detail view with breadcrumb
- Click breadcrumb back link -- returns to index
- Error in one demo does not crash the page (error boundary)
- Command does NOT appear when extension runs in production mode
- `npm run build` in webview -- verify sink code is tree-shaken (check `dist/assets/index.js` size or grep for sink registry keys)

**Phase 2 verification**:
- All ~23 demos render without errors
- App pattern demos show realistic compositions
- New ShadCN components render correctly with VS Code theme colors

**Phase 3 verification**:
- Search filter narrows displayed components in real time
- Empty state shown when filter matches nothing
- Clear button resets filter
- Theme info displays correct scheme (dark/light)

**Cross-theme verification** (all phases):
- Test with Dark+ (default dark)
- Test with Light+ (default light)
- Test with High Contrast theme
- Verify borders, backgrounds, and focus rings adapt correctly

## 9. Documentation Steps

**`webview/CLAUDE.md`** -- Add:
- `pages/sink/` directory purpose
- Demo file convention (named export, one per file, no extension host calls)
- Registry addition checklist
- Dev-only gating note

**`webview/README.md`** -- Add:
- Sink section in file inventory table
- ShadCN components table updated with newly installed components

**`docs/docs/developer-docs/`** -- Add page:
- How to add a new component to the Kitchen Sink
- Demo file template
- Registry entry format
- Build and verify workflow
