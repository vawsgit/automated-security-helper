---
title: VSIX GitHub Actions Release
---

# VSIX GitHub Actions Release — Research

Research into packaging the ASH Workbench VS Code extension as a `.vsix` archive and publishing it to GitHub Releases via a GitHub Actions workflow.

## Overview

ASH Workbench (`workbench/vsix/`) is a VS Code extension backed by PGLite (WASM PostgreSQL), Prisma ORM, and a React 19 webview. The extension currently has **no CI/CD pipeline for building or distributing the `.vsix`**. The six existing GitHub Actions workflows target the Python ASH CLI (tests, scanning, version bumping, docs).

The goal is a GitHub Actions workflow that:
1. Builds the React webview
2. Compiles the VS Code extension
3. Packages a `.vsix` archive
4. Attaches it to a GitHub Release

## Current Build Pipeline

### Extension Build Chain

Defined in `vsix/package.json:185-199`:

```
npm run build
  ├─ npm run build:webview
  │   ├─ cd ../webview && npm run build       (tsc -b + vite build → webview/dist/)
  │   └─ npm run copy:webview                 (rm -rf ./webview-dist && cp -r ../webview/dist ./webview-dist)
  └─ npm run compile                          (tsc -p ./ → out/)
```

The `vscode:prepublish` script calls `npm run build`, so `vsce package` triggers the full chain automatically.

### Webview Build

Vite produces **fixed filenames** (no content hashing) because `vsix/src/providers/webviewHtml.ts:4-9` hardcodes:
- `webview-dist/assets/index.js`
- `webview-dist/assets/index.css`

### Compilation Output

TypeScript compiles to `vsix/out/` (ES2022, Node16 modules). The entry point is `out/extension.js`.

### `.vscodeignore` (Current)

File at `vsix/.vscodeignore`:

```
.vscode/**
.vscode-test/**
src/**
.gitignore
.yarnrc
vsc-extension-quickstart.md
**/tsconfig.json
**/eslint.config.mjs
**/*.map
**/*.ts
**/.vscode-test.*
!webview-dist/**
```

This excludes TypeScript source and includes the `webview-dist/` assets. However, it does **not** exclude `node_modules/` — meaning the full dependency tree ships in the `.vsix`.

## Critical Issue: Package Size

### Dependency Sizes (measured)

| Directory | Size |
|-----------|------|
| `node_modules/` (total) | **543 MB** |
| `@prisma/client` | 75 MB |
| `@anthropic-ai/claude-agent-sdk` | 58 MB |
| `@prisma/studio-core` | 36 MB |
| `@prisma/engines` | 24 MB |
| `@prisma/dev` | 23 MB |
| `@electric-sql/pglite` | 23 MB (includes 7.7 MB WASM) |
| Everything else | ~304 MB |

Without intervention, `vsce package` would produce a `.vsix` exceeding **500 MB**. The VS Marketplace has a **200 MB limit**, and even for GitHub Releases distribution, a 500+ MB artifact is impractical.

### Why This Happens

The extension currently uses `tsc` (plain TypeScript compiler) with no bundler. This means:
- All production `dependencies` in `package.json` are installed and shipped
- Prisma ships its query engine binaries for **all platforms** (~24 MB in `@prisma/engines`)
- PGLite ships its full WASM binary + PostgreSQL extension `.tar.gz` archives
- The Claude Agent SDK ships its complete transitive dependency tree

### No Bundler Configured

There is **no esbuild, webpack, or rollup config** in the `vsix/` directory. This is the single biggest gap before a release workflow can work.

## Dynamic Imports Complicate Bundling

Three critical dependencies use dynamic `import()` in `vsix/src/services/database.ts:47-57`:

```typescript
const { PGlite } = await import('@electric-sql/pglite');       // ESM-only
const { PrismaClient } = await import('@prisma/client');
const { PrismaPgliteAdapter } = await import('prisma-pglite');
```

These dynamic imports exist because PGlite is **ESM-only** while the extension targets Node16/CommonJS. This pattern prevents standard bundler tree-shaking and inlining. A bundler would need these configured as **externals** with the actual packages shipped alongside the bundle.

Similarly, the Claude Agent SDK is used in `vsix/src/services/aiService.ts` and likely also requires special handling.

### Prisma's Runtime Requirements

Prisma's `@prisma/client` depends on:
- Generated client code (from `prisma generate`)
- Query engine binary or WASM engine
- The `prisma/schema.prisma` file at a known path

The extension uses a custom migration runner (raw SQL in `prisma/migrations/`, applied via `DatabaseService.runMigrations`) — **not** the Prisma CLI at runtime. But the Prisma Client still needs its generated artifacts at `node_modules/@prisma/client/`.

### PGLite's WASM Binary

PGLite loads `postgres.wasm` (7.7 MB) at runtime from its package directory. This binary must be accessible from the final packaged location. A bundler cannot inline it.

## The `@vscode/vsce` CLI

### Key Commands

- `vsce package` — creates a `.vsix` file (a zip with manifest)
- `vsce ls` / `vsce ls --tree` — audit what files would be packaged (essential for debugging size)
- `vsce publish` — packages and publishes to VS Marketplace (not needed for GitHub-only releases)

### Key Flags

| Flag | Purpose |
|------|---------|
| `-o <path>` | Custom output filename/path |
| `--no-dependencies` | Skip npm install; ship only what's in the directory tree |
| `--pre-release` | Mark as pre-release in Marketplace |
| `--allow-missing-repository` | Allow missing `repository` field in package.json |
| `--skip-license` | Package without LICENSE file |
| `-t <target>` | Platform-specific build (see below) |

### `--no-dependencies` Flag

When using a bundler, `--no-dependencies` tells `vsce` to skip running `npm install` and trust that everything needed is already in the tree. This is the standard approach for bundled extensions.

### `vscode:prepublish` Hook

`vsce package` automatically runs `package.json`'s `vscode:prepublish` script before packaging. This is the conventional place to trigger the build pipeline.

## Platform Targeting

### Universal vs Platform-Specific

ASH Workbench has **no native Node.js modules** — PGLite is pure WASM, Prisma uses the WASM query engine (via `prisma-pglite`), and the Claude Agent SDK is pure JavaScript. This means a **universal `.vsix`** (no `--target` flag) should work on all platforms.

However, Prisma ships platform-specific query engine binaries in `@prisma/engines/`. If the extension is bundled without those binaries (relying on the WASM engine via `prisma-pglite`), platform targeting is unnecessary.

**Recommendation:** Universal `.vsix` is sufficient. If native Prisma engines are ever needed, use a build matrix with `--target`.

## Package.json Gaps

The current `vsix/package.json` is missing fields required or recommended for distribution:

| Field | Current | Required? |
|-------|---------|-----------|
| `publisher` | _(missing)_ | Yes (for Marketplace; recommended for `.vsix` identity) |
| `repository` | _(missing)_ | Recommended (GitHub link for provenance) |
| `author` | _(missing)_ | Recommended |
| `license` | _(missing)_ | Recommended (use `--skip-license` otherwise) |
| `icon` | Has `resources/icon.svg` in contributes, not top-level `icon` | Marketplace requires 128x128 PNG |

For GitHub-only releases (not VS Marketplace), `--allow-missing-repository` and `--skip-license` can bypass these temporarily.

## Versioning Strategy

### Current State

Version is `0.0.1` in `vsix/package.json:5`. The existing `ash-repo-version-bump.yml` workflow bumps the **Python CLI version** only (via `scripts/version_bump.py`). There is no versioning mechanism for the extension.

### VS Code Conventions

- Strict semver: `MAJOR.MINOR.PATCH` only (no pre-release tags like `-beta.1`)
- Pre-release: use **odd minor** versions (`0.1.x`, `0.3.x`); stable uses **even minor** (`0.2.x`, `0.4.x`)
- `--pre-release` flag marks the version in the Marketplace UI

### Options

1. **Tag-based** (recommended for maturity): Git tags like `workbench-v0.1.0` trigger the workflow. Version in `package.json` must match.
2. **Manual dispatch**: `workflow_dispatch` with a version input. Useful during early development.
3. **PR-label based**: Mirror the existing `ash-repo-version-bump.yml` pattern but for `vsix/package.json`.

**Recommendation for POC phase:** Use `workflow_dispatch` with manual version input. Transition to tag-based releases when the extension stabilizes.

## GitHub Release Creation

### Method A: `gh` CLI (Recommended)

Pre-installed on all GitHub-hosted runners. Simple and well-documented.

```yaml
- name: Create GitHub Release
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh release create "workbench-v${{ steps.version.outputs.value }}" \
      --title "ASH Workbench v${{ steps.version.outputs.value }}" \
      --generate-notes \
      --draft \
      ./vsix/*.vsix
```

Key flags:
- `--draft` — create as draft for manual review before publishing
- `--generate-notes` — auto-generate from commits since last release
- `--prerelease` — mark as pre-release
- Files passed as positional args after the tag

### Method B: `softprops/action-gh-release@v2`

Community action (5.5k stars). More declarative but an external dependency.

```yaml
- uses: softprops/action-gh-release@v2
  with:
    files: "*.vsix"
    generate_release_notes: true
    draft: true
```

### Method C: `gh` CLI + `actions/upload-artifact@v4` (Multi-Job)

Upload `.vsix` as a CI artifact in the build job, download in the release job. Useful when build and release are separate jobs:

```yaml
# Build job:
- uses: actions/upload-artifact@v4
  with:
    name: vsix
    path: "*.vsix"

# Release job:
- uses: actions/download-artifact@v4
  with:
    name: vsix
- run: gh release create ... ./*.vsix
```

**Recommendation:** Use `gh` CLI directly (Method A). It's built-in, well-maintained, and avoids external action dependencies.

## Code Signing and Trust

### VS Marketplace (Not Applicable Yet)

The Marketplace automatically signs extensions upon publication using Sigstore. VS Code verifies signatures on install (enforced since ~v1.97).

### GitHub Releases Distribution

Extensions installed via "Install from VSIX..." are **not signed** by the Marketplace. VS Code shows a trust dialog (since v1.97). Users must explicitly trust the extension.

The `vsce` CLI supports `--sign-tool` for custom signing, but this adds complexity with limited benefit for an internal/community project.

**Recommendation:** No code signing for now. GitHub Release provenance (SHA256 checksums, linked to the CI build) is sufficient. Add signing if/when publishing to the Marketplace.

## Workflow Trigger Strategy

### Options

| Trigger | When | Best For |
|---------|------|----------|
| `workflow_dispatch` | Manual button press | POC/early development |
| `push.tags: ["workbench-v*"]` | Git tag push | Stable release cadence |
| `release.types: [published]` | GitHub Release UI | When release notes are authored manually |
| `pull_request.types: [closed]` + labels | PR merge with label | Mirrors existing version-bump pattern |

### Recommended: Hybrid Trigger

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: "Version (e.g., 0.1.0)"
        required: true
      pre_release:
        description: "Pre-release?"
        type: boolean
        default: true
  push:
    tags:
      - "workbench-v*.*.*"
```

This allows manual releases during development and tag-based automation later.

## Monorepo Considerations

### Working Directory

The extension lives at `workbench/vsix/`, not the repo root. The workflow must handle:
1. `npm ci` in `workbench/webview/` (webview dependencies)
2. `npm ci` in `workbench/vsix/` (extension dependencies)
3. Building from `workbench/vsix/` where `vscode:prepublish` orchestrates the full chain

### Path Filters

Use `paths` filters to avoid running the workflow on unrelated changes:

```yaml
on:
  push:
    paths:
      - "workbench/vsix/**"
      - "workbench/webview/**"
```

### Prisma Client Generation

The extension's `devDependencies` include `prisma` (the CLI). The build must run `npx prisma generate` before compilation to produce the Prisma Client from `prisma/schema.prisma`. This is typically handled by a `postinstall` script or explicitly in the CI workflow.

## Existing Workflow Patterns

The repository follows these conventions (from the 6 existing workflows):

| Convention | Example |
|------------|---------|
| Runner | `ubuntu-latest` |
| Checkout | `actions/checkout@v4` |
| Naming | `ash-repo-*` prefix |
| Permissions | Explicit, minimal (`contents: read` or `contents: write`) |
| Bot commits | `github-actions[bot]` identity |

The new workflow should follow these patterns for consistency, using a name like `ash-workbench-release.yml`.

## Issues and Risks

### 1. No Bundler = Unshippable Package Size

**Severity: Blocker**

Without esbuild or webpack, the `.vsix` would ship ~543 MB of `node_modules/`. This is the single biggest prerequisite before any release workflow works. See "Recommended Implementation Plan" for the bundling phase.

### 2. Dynamic Imports Require External Dependencies

**Severity: High**

PGLite, Prisma Client, and prisma-pglite are dynamically imported. A bundler must mark these as `external` and ensure their packages are shipped alongside the bundle. This is a non-trivial esbuild/webpack configuration challenge.

### 3. WASM Binary Must Be Accessible at Runtime

**Severity: High**

PGLite's `postgres.wasm` (7.7 MB) and potentially Prisma's WASM query engine must be locatable from the extension's runtime path. After bundling, the file paths will differ from development. This requires verifying that PGLite's WASM resolution works from within a `.vsix` package.

### 4. Missing `publisher` Field

**Severity: Medium**

`vsce package` warns (or errors) without a `publisher` field. For Marketplace it's mandatory. For GitHub-only distribution, `--allow-missing-repository` and a dummy publisher can work, but this should be properly configured.

### 5. No Prisma `postinstall` / `generate` in CI

**Severity: Medium**

Prisma Client generation (`npx prisma generate`) must run after `npm ci` in the CI environment. If it's not in a `postinstall` hook, it must be an explicit CI step.

### 6. Migration Files Must Ship in the Package

**Severity: Medium**

`DatabaseService` reads migration SQL from `prisma/migrations/` relative to `__dirname` (which resolves to `out/services/` at runtime). The `.vscodeignore` does not exclude `prisma/` so it ships by default. But with a bundler, the `out/` directory structure changes — the migration path resolution in `database.ts:22` would break.

### 7. Webview `npm ci` Not in `vscode:prepublish`

**Severity: Low**

The `build:webview` script runs `cd ../webview && npm run build` but does **not** run `npm ci` in the webview directory first. In CI (fresh checkout), `webview/node_modules/` won't exist. The workflow must explicitly install webview dependencies.

## Key Takeaways

1. **Bundling is the prerequisite** — nothing else matters until the extension can produce a reasonably-sized `.vsix` (target: under 50 MB).
2. **Dynamic imports of PGLite/Prisma/prisma-pglite** make bundling non-trivial. These must remain external, with their runtime files carefully included.
3. **The WASM binary for PGLite** (7.7 MB) must be verified to load correctly from within a packaged `.vsix`.
4. **Universal `.vsix`** is appropriate — no native modules exist.
5. **`gh release create`** is the simplest GitHub Release method, pre-installed on runners.
6. **`workflow_dispatch`** is the right trigger during POC; transition to tag-based later.
7. **Follow existing repo conventions** for the workflow file (naming, runner, permissions, bot identity).

## Outstanding Questions

1. **Bundler selection** — esbuild is fast and simple but may struggle with the dynamic imports and WASM files. Webpack has more plugins for handling these cases. Which is preferred?
2. **Claude Agent SDK size** — At 58 MB, this is a significant chunk. Is it always needed, or can it be made optional/lazy-loaded to reduce the base package size?
3. **Prisma engine strategy** — Should the extension use Prisma's WASM query engine (smaller, portable) or the native engine (faster)? The choice affects bundling and platform targeting.
4. **VS Marketplace publishing** — Is Marketplace distribution planned, or will GitHub Releases be the only distribution channel? This affects `publisher` requirements and signing.
5. **Version coordination** — Should the extension version be independent of the ASH CLI version, or should they be coordinated?
6. **PGLite extension archives** — The `@electric-sql/pglite/dist/` directory contains many PostgreSQL extension `.tar.gz` files. Are any of these loaded at runtime, or are they dead weight that can be excluded?

## Recommended Implementation Plan

### Phase 1: Bundling Foundation — Reduce `.vsix` from 500+ MB to under 50 MB

1. **Add esbuild to devDependencies** — Install and configure esbuild as the extension bundler
2. **Create esbuild config** — Bundle `src/extension.ts` into `dist/extension.js`, marking `vscode` as external
3. **Handle dynamic imports** — Mark `@electric-sql/pglite`, `@prisma/client`, `prisma-pglite`, and `@anthropic-ai/claude-agent-sdk` as externals; ship their minimal runtime files alongside the bundle
4. **Copy WASM and migration files** — Ensure `postgres.wasm`, Prisma runtime, and `prisma/migrations/*.sql` are copied to the `dist/` output
5. **Update `.vscodeignore`** — Exclude `out/`, `node_modules/`, and source; include only `dist/`, `webview-dist/`, and `prisma/migrations/`
6. **Update `package.json` main** — Point `"main"` at `./dist/extension.js` instead of `./out/extension.js`
7. **Fix runtime path resolution** — Update `DatabaseService.migrationsDir` to resolve from the new bundled location
8. **Audit with `vsce ls --tree`** — Verify package contents and measure final size

### Phase 2: CI Workflow — Build and package in GitHub Actions

1. **Create `ash-workbench-release.yml`** — New workflow file with `workflow_dispatch` + optional tag trigger
2. **Add Node.js setup and dependency install steps** — Install both `webview/` and `vsix/` dependencies
3. **Add Prisma generate step** — Run `npx prisma generate` explicitly before build
4. **Run full build** — Execute `npm run build` (webview build + extension bundle)
5. **Package with `vsce`** — Run `npx @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license`
6. **Upload artifact** — Use `actions/upload-artifact@v4` for CI-accessible `.vsix`

### Phase 3: GitHub Release — Attach `.vsix` to releases

1. **Add release step** — Use `gh release create` with `--draft` to create a GitHub Release with the `.vsix` attached
2. **Add version validation** — Ensure the tag/input version matches `package.json` version
3. **Generate release notes** — Use `--generate-notes` for auto-generated changelogs
4. **Add SHA256 checksum** — Generate and include a checksum file for download verification

### Phase 4: Polish — Production readiness

1. **Add `publisher` and `repository` fields** — Fill in `package.json` metadata for proper extension identity
2. **Add `icon` field** — Convert `resources/icon.svg` to a 128x128 PNG for the extension icon
3. **Add smoke test step** — Verify the `.vsix` can be installed in a headless VS Code environment before release
4. **Add size budget check** — Fail the workflow if the `.vsix` exceeds a threshold (e.g., 50 MB)
5. **Document the release process** — Write a user-facing guide for how to create a release
