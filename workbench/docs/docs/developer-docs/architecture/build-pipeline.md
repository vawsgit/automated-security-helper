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

### npm scripts reference

#### `vsix/` — VS Code extension

| Script | Command | Purpose |
|---|---|---|
| `build` | `build:webview && compile` | Full build: webview + copy + extension tsc |
| `build:webview` | `cd ../webview && npm run build && npm run copy:webview` | Build webview and copy output to `webview-dist/` |
| `copy:webview` | `rm -rf ./webview-dist && cp -r ../webview/dist ./webview-dist` | Copy webview build artifacts into extension |
| `compile` | `tsc -p ./` | TypeScript compile (extension host only) |
| `watch` | `tsc -watch -p ./` | TypeScript watch mode (extension host only) |
| `lint` | `eslint src` | Run ESLint on extension source |
| `format` | `prettier --write "src/**/*.ts"` | Auto-format extension source |
| `format:check` | `prettier --check "src/**/*.ts"` | Check formatting without writing |
| `test` | `test:unit && test:integration` | Run all tests |
| `test:unit` | `mocha` | Run unit tests |
| `test:integration` | `vscode-test` | Run VS Code integration tests |
| `pretest` | `compile && lint` | Compile and lint before tests |
| `vscode:prepublish` | `build` | Runs full build before `vsce package` |

#### `webview/` — React WebView app

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Start Vite dev server with hot reload |
| `build` | `tsc -b && vite build` | Type-check and produce production build in `dist/` |
| `lint` | `eslint .` | Run ESLint on webview source |
| `preview` | `vite preview` | Serve production build locally for inspection |

:::warning
`npm run dev` in `webview/` starts a standalone Vite server, but the app requires `acquireVsCodeApi()` which only exists inside a VS Code webview. Use the dev server for build-error feedback only — visual testing must happen inside the Extension Development Host.
:::

#### `docs/` — Docusaurus site

| Script | Command | Purpose |
|---|---|---|
| `start` | `docusaurus start` | Dev server with hot reload (localhost:3000) |
| `build` | `docusaurus build` | Production build |
| `serve` | `docusaurus serve` | Serve production build locally |
| `clear` | `docusaurus clear` | Clear `.docusaurus` cache (run after config changes) |
| `typecheck` | `tsc` | Type-check config and custom components |

## Development Workflow

### Common tasks

| I want to... | Command | Where |
|---|---|---|
| Launch the extension for testing | Press **F5** (from the `vsix/` workspace) | VS Code |
| Full rebuild everything | `npm run build` | `vsix/` |
| Rebuild only the webview | `npm run build:webview` | `vsix/` |
| Compile only the extension host | `npm run compile` | `vsix/` |
| Run all tests | `npm run test` | `vsix/` |
| Start the docs dev server | `npm run start` | `docs/` |

### Watch mode (active development)

Development requires watching both packages. Use two terminals:

```bash
# Terminal 1: Watch extension host TypeScript
cd vsix && npm run watch

# Terminal 2: Watch webview (Vite dev build + rebuild on change)
cd webview && npm run build -- --watch
```

Then press F5 in VS Code (from the `vsix/` workspace) to launch the Extension Development Host.

:::warning[Webview changes not showing up?]
The webview builds to `webview/dist/`, but the extension loads from `vsix/webview-dist/`. After changing webview code, you must copy the build output:

```bash
cd vsix && npm run copy:webview
```

Or use the one-step command that rebuilds and copies:

```bash
cd vsix && npm run build:webview
```

Then reload the Extension Development Host window (`Ctrl+R` / `Cmd+R`).
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
