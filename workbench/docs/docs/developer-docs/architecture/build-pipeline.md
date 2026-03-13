---
title: Build Pipeline
sidebar_position: 2
---

# Build Pipeline

The ASH Workbench uses a sibling package layout with a copy-step bridge. The `vsix/` (VS Code extension) and `webview/` (React app) packages are independent npm projects under `workbench/`, connected by copying Vite's build output into the extension at build time.

## Package Layout

```
workbench/
  vsix/                    # VS Code extension (TypeScript, Node.js)
    out/                   # tsc output (extension host JS)
    webview-dist/          # Copied from webview/dist at build time
    src/
    package.json
  webview/                 # React WebView app (Vite + Tailwind + ShadCN)
    dist/                  # Vite build output
    src/
    package.json
```

Each package has its own `node_modules/`, `tsconfig.json`, and build tooling. There is no monorepo tooling (no Yarn workspaces, no Turborepo).

## How It Works

### Build chain

Running `npm run build` in `vsix/` executes the full chain:

```
vsix/npm run build
  -> npm run build:webview
       -> cd ../webview && npm run build   (tsc -b && vite build)
       -> cd ../vsix && npm run copy:webview  (cp -r ../webview/dist ./webview-dist)
  -> npm run compile                       (tsc -p ./)
```

The result is two output directories in `vsix/`:
- `out/` -- compiled extension host TypeScript
- `webview-dist/` -- the Vite-built React app (static HTML/JS/CSS)

### Vite fixed-filename output

Vite is configured to produce deterministic filenames so the extension host can reference them without hashing:

```typescript
// webview/vite.config.ts
build: {
  rollupOptions: {
    output: {
      entryFileNames: 'assets/index.js',
      chunkFileNames: 'assets/[name].js',
      assetFileNames: 'assets/[name].[ext]',
    },
  },
},
```

The extension host HTML generator (`vsix/src/providers/webviewHtml.ts`) relies on these exact paths: `webview-dist/assets/index.js` and `webview-dist/assets/index.css`.

### Key npm scripts in vsix/package.json

| Script | Purpose |
|---|---|
| `build` | Full build: webview + copy + tsc |
| `build:webview` | Build webview and copy to `webview-dist/` |
| `copy:webview` | Copy `../webview/dist` to `./webview-dist` |
| `compile` | TypeScript compile only (`tsc -p ./`) |
| `watch` | TypeScript watch mode (extension host only) |
| `vscode:prepublish` | Runs `build` before `vsce package` |

## Development Workflow

Development requires watching both packages. Use three terminals:

```bash
# Terminal 1: Watch extension host TypeScript
cd vsix && npm run watch

# Terminal 2: Watch webview (Vite dev build + rebuild on change)
cd webview && npm run build -- --watch

# Terminal 3: Copy webview on change (re-run after webview rebuilds)
cd vsix && npm run copy:webview
```

Then press F5 in VS Code (from the `vsix/` workspace) to launch the Extension Development Host.

:::tip
After changing webview code, re-run `npm run copy:webview` in `vsix/` and reload the Extension Development Host window (`Ctrl+R` / `Cmd+R`).
:::

## Extending / Maintaining

### Adding a new webview asset

If the Vite build produces additional output files (e.g., a web worker), update:

1. `webview/vite.config.ts` -- add the asset naming rule
2. `vsix/src/providers/webviewHtml.ts` -- resolve and inject the new URI
3. `webviewHtml.ts` CSP header -- allow the new resource type if needed

### Gitignore and vscodeignore

- `vsix/.gitignore` includes `webview-dist/` -- this directory is a build artifact, never committed
- `vsix/.vscodeignore` includes `!webview-dist/**` -- ensures the directory IS packaged in the `.vsix`

### Path dependency

The copy script uses a relative path (`../webview/dist`). This assumes `vsix/` and `webview/` are siblings. Moving either package breaks the build bridge.
