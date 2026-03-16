---
title: Constitution Guidance
---

# SpecKit Constitution Guidance for ASH Workbench

Input for the `/speckit.constitution` command. This document distills the project's architectural decisions, design principles, constraints, and conventions from the developer documentation into constitutional principles. The command should use this as the authoritative source when creating or updating `.specify/memory/constitution.md`.

---

## Principle I: VS Code Native (NON-NEGOTIABLE)

The extension runs entirely within the VS Code process. There are no external servers, APIs, databases, or cloud dependencies outside the process boundary.

**What this means concretely:**

- Use VS Code APIs where they exist (TreeDataProvider, commands, settings, diagnostics, progress, notifications) before reaching for custom UI
- Database (PGLite) runs in-process as WASM inside the extension host
- ASH CLI is a local child process, not a remote service
- No network calls except what the user explicitly configures (e.g., future Bedrock LLM)
- All persistent data lives in `context.globalStorageUri`, not in the workspace
- Every disposable must be pushed to `context.subscriptions`
- All contribution points (commands, views, settings, menus) declared in `package.json`

**Violations to flag:** External service dependencies, custom settings UI (VS Code provides this), API calls without user configuration, data stored outside extension storage paths.

---

## Principle II: Extension Host Owns State (NON-NEGOTIABLE)

The extension host is the single source of truth. The WebView is a pure renderer.

**What this means concretely:**

- All business logic, data fetching, and VS Code API access live in `vsix/src/`
- The WebView sends user actions via `postMessage`, receives state pushes back
- No client-side data fetching, caching, or business logic in `webview/src/`
- State management in the WebView is limited to local UI concerns (filter selections, expanded rows, navigation)
- The typed message protocol (`ExtToWebviewMessage` / `WebviewToExtMessage`) is the only communication channel
- Both sides use identical type definitions (discriminated unions with `type` field as discriminant)

**Violations to flag:** Business logic in React components, data fetching from the WebView, WebView maintaining authoritative state, untyped messages.

---

## Principle III: Ship Fast / Simplicity First

Proven patterns over novel ones. Simple implementations that work end-to-end beat sophisticated ones that don't ship.

**Design heuristics:**

- **KISS** -- If there's a simpler way that works, use it
- **YAGNI** -- Features only if required for the current scope. The data model can support future features without schema rewrites, but those features are not built until needed
- **Progressive foundation** -- Design for extensibility at the data model level, not at the code level. Don't add abstractions for hypothetical future requirements
- **Single developer** -- The architecture must be understandable and debuggable by one person. No microservices, no message queues, no external infrastructure
- **Fallback design** -- When a technology pairing is unproven (e.g., PGLite + Prisma), design a fallback path (e.g., SQLite)

**Violations to flag:** Premature abstractions, features not in the current scope, infrastructure complexity (message queues, external services), over-engineered patterns that add indirection without clear benefit.

---

## Principle IV: Typed Contracts at Boundaries

All communication across boundaries uses TypeScript-enforced contracts. Type safety is not optional.

**What this means concretely:**

- Extension host to WebView: `ExtToWebviewMessage` discriminated union
- WebView to extension host: `WebviewToExtMessage` discriminated union
- Data model types shared between vsix/ and webview/ via manual copy (both locations must stay in sync)
- TypeScript strict mode in both packages (all strict type-checking enabled)
- SARIF parsing produces typed `Finding` models, not raw JSON
- Database queries through Prisma (type-safe ORM), not raw SQL

**Violations to flag:** `any` types in production code (use `unknown` and narrow), untyped message passing, raw JSON without parsing to typed models, type files out of sync between packages.

---

## Principle V: Theme Integration Over Custom Design

The WebView looks and feels like a native part of VS Code. The user's chosen theme is the design system.

**What this means concretely:**

- `index.css` maps `--vscode-*` CSS variables to ShadCN/Tailwind design tokens
- ShadCN components inherit the active VS Code theme automatically
- No custom fonts (inherit via `--vscode-font-family`), no external resources (CSP blocks them)
- `color-scheme: dark` on `.vscode-dark` and `.vscode-high-contrast` for native browser controls
- `@custom-variant dark (&:is(.vscode-dark *))` remaps Tailwind's `dark:` prefix to VS Code's body class
- Domain-specific colors (severity badges, disposition badges) are the only exception -- these use hardcoded Tailwind classes for semantic meaning that must be consistent across themes
- No gradient meshes, noise textures, custom cursors, decorative overlays, or effects that clash with VS Code

**Violations to flag:** Custom color palettes, external font loading, CSS that bypasses theme variables, animations beyond functional transitions (loading spinners, state changes).

---

## Principle VI: Security by Default

A security scanning tool must itself be secure.

**What this means concretely:**

- CSP (`Content-Security-Policy`) required on all webviews -- `default-src 'none'`, nonce-based script/style allowance
- `localResourceRoots` set restrictively -- only the webview-dist directory
- `acquireVsCodeApi()` called once at module scope, never leaked to global scope
- All user input and workspace data sanitized before display
- No `eval()`, no dynamic script injection
- OWASP top 10 awareness: no command injection when spawning ASH CLI, no XSS in WebView content

**Violations to flag:** Missing CSP, `eval()`, unrestricted `localResourceRoots`, unsanitized user input in WebView HTML, command injection via string concatenation in `spawn()` arguments.

---

## Architecture Constraints

These are structural facts about the codebase, not aspirational principles.

### Monorepo Layout

```
workbench/
  vsix/      # VS Code extension (TypeScript, Node.js, tsc)
  webview/   # React WebView app (React 19, Vite 8, Tailwind v4, ShadCN/ui)
  docs/      # Docusaurus v3 documentation site
```

- Sibling package layout with copy-step bridge. No monorepo tooling (no Yarn workspaces, no Turborepo).
- `vsix/npm run build` triggers full chain: build webview, copy dist, compile extension.
- Vite produces fixed filenames (`dist/assets/index.js`, `dist/assets/index.css`) -- the extension host hardcodes these paths.

### Tech Stack (Locked)

| Component | Technology | Notes |
|-----------|-----------|-------|
| Extension Host | TypeScript / Node.js | Strict mode, ES2022, Node16 modules |
| WebView Framework | React 19 | `useReducer` state machine, no router |
| WebView Styling | Tailwind CSS v4 + ShadCN/ui | `@tailwindcss/vite` plugin, `class-variance-authority` |
| WebView Build | Vite 8 | Fixed output filenames for extension host reference |
| Database | PGLite (WASM PostgreSQL) + Prisma ORM | `driverAdapters` preview feature, `prisma-pglite` adapter |
| Scanner Integration | ASH CLI (Python, child process) | SARIF 2.1.0 output, exit codes: 0=clean, 1=error, 2=findings |
| Documentation | Docusaurus v3.9.2 | Autogenerated sidebars, MDX compilation, Mermaid diagrams |
| Testing | Mocha (unit, Node.js) + @vscode/test-electron (integration) | sinon for mocking, node:assert/strict |
| Linting | ESLint (flat config, typescript-eslint) + Prettier | `eslint-config-prettier` last in config array |

### Data Model (3 Entities)

- **Project** -- 1:1 with workspace folder, root aggregate
- **Scan** -- One ASH CLI execution (status: RUNNING/COMPLETED/FAILED/CANCELLED)
- **Finding** -- One security issue, identified across scans by `(ruleId, file)` composite key
- **Disposition** -- Finding triage state: PENDING, FIX, SUPPRESS, DEFER

### Core Loop

**Scan** -> **View** (findings with filters) -> **Navigate** (click to open file at line) -> **Triage** (set disposition) -> **Track** (cumulative progress)

---

## Quality and Testing

### TypeScript Strictness

Both packages use `strict: true` plus: `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedParameters`, `noUnusedLocals`.

### Formatting and Linting

- Prettier: semicolons, single quotes, trailing commas, 100 char width, 2-space tabs
- ESLint: `curly` (all control statements), `eqeqeq`, `no-throw-literal`, camelCase/PascalCase imports
- Test files relax: `no-non-null-assertion`, `no-explicit-any`, `no-require-imports`

### Test Strategy

| Runtime | What it tests | Speed | When to use |
|---------|---------------|-------|-------------|
| Unit (Node.js, Mocha) | Pure logic: parsers, database, utilities | ~1-2s | Default. Use whenever the module doesn't import `vscode` |
| Integration (VS Code Electron) | Extension activation, commands, providers | ~15s | Only when `vscode.*` APIs are required |

- SARIF test data: factory builders in `vsix/src/test/fixtures/sarif-factory.ts`
- Process mocking: dependency injection of `SpawnFn` (sinon cannot stub `child_process.spawn` under Node16 modules)
- PGLite in tests: in-memory instances for isolation (dynamic `import()` in `before()` hook, ESM-only)

### Visual Testing

The Kitchen Sink (`pages/sink/`) renders all UI components in a single panel. Every new ShadCN or app-specific component must have a Kitchen Sink demo that exercises all variants in both dark and light themes.

---

## Coding Conventions

### Extension Host (vsix/)

- Named exports for all modules
- Services: classes with injected dependencies via constructor, async methods
- Providers: implement VS Code interfaces (`TreeDataProvider`, `WebviewViewProvider`)
- Command IDs: `ashWorkbench.<verbNoun>` (e.g., `ashWorkbench.startScan`)
- Setting keys: `ashWorkbench.<category>.<setting>` (e.g., `ashWorkbench.llm.region`)
- Disposable pattern: push everything to `context.subscriptions`

### WebView (webview/)

- Named exports for components (exceptions: `App`, `SinkPage` as default exports)
- Props interfaces defined in same file, above the component
- Import paths: `@/components/ui/*` for ShadCN, `@/lib/utils` for utilities, relative for app code
- `import type { ... }` for type-only imports
- File naming: PascalCase for app components, kebab-case for ShadCN and sink demos
- Always use `cn()` utility when combining Tailwind classes with props
- ShadCN `ui/` files are auto-generated -- do not hand-edit

### Documentation (docs/)

- Autogenerated sidebars -- never modify `sidebars.ts` or `docusaurus.config.ts` to add pages
- Every `.md` file needs `title:` frontmatter; every new subdirectory needs `_category_.json`
- `README.md` in any directory becomes the category index
- File names: kebab-case (`system-overview.md`)
- Cross-links: relative file paths, not absolute URLs
- MDX compilation: escape bare `<` in prose (use backtick-wrap or HTML entities)
- Mermaid is the preferred diagram format

---

## Governance

1. The constitution supersedes ad-hoc decisions. When a feature plan, spec, or task contradicts a constitutional principle, the constitution wins unless formally amended.
2. Amendments require: (a) documenting the change and rationale, (b) updating this guidance document, (c) updating the constitution file at `.specify/memory/constitution.md`.
3. The constitution is a living document. It should be reviewed whenever: a new technology is adopted, a principle is found to be impractical, or the project scope changes significantly.
4. The `/speckit.constitution` command should re-read this guidance file before each update to ensure the constitution stays current with the codebase reality.

---

## Current POC Scope (for context)

**In scope:** Project management, scan execution, scan history, finding list, finding detail, finding triage (per-finding disposition), settings and administration (reset, migrations, version display).

**Explicitly deferred:** Category grouping, research documents, implementation plans, delta reports, suppression file generation, AI-enriched finding detail, batch operations.

**Future versions:** v1.1 (AI Enrichment via OpenCodeSDK), v1.2 (Category Grouping), v1.3 (Suppression & Remediation), v1.4 (Delta Reports).
