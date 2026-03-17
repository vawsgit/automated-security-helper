<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 -> 1.1.0
  Bump rationale: MINOR - materially expanded Architecture Constraints
    (4th entity: ScanTarget) and Conventions (service layer, mapper,
    loading state patterns established across Specs 001-006)

  Modified principles: None renamed or redefined
  Added sections: None (existing sections expanded)
  Removed sections: None

  Section changes:
    - Architecture Constraints > Data Model: 3 entities -> 4 entities
      (added ScanTarget)
    - Architecture Constraints > Core Loop: updated to include scan
      targets as organizing concept
    - Quality and Coding Conventions > Extension Host Conventions:
      added service layer and mapper patterns
    - Quality and Coding Conventions > WebView Conventions:
      added loading state and mock-data retention patterns

  Templates checked:
    - .specify/templates/plan-template.md ........... OK (Constitution
      Check gate is generic, reads principles dynamically)
    - .specify/templates/spec-template.md ........... OK (no constitution
      references)
    - .specify/templates/tasks-template.md .......... OK (no constitution
      references)
    - .specify/templates/commands/*.md .............. OK (no files present)

  Follow-up TODOs: None
-->

# ASH Workbench Constitution

## Core Principles

### I. VS Code Native (NON-NEGOTIABLE)

The extension runs entirely within the VS Code process. There are no external
servers, APIs, databases, or cloud dependencies outside the process boundary.

- MUST use VS Code APIs where they exist (`TreeDataProvider`, commands,
  settings, diagnostics, progress, notifications) before custom UI
- Database (PGLite) MUST run in-process as WASM inside the extension host
- ASH CLI is a local child process, not a remote service
- No network calls except what the user explicitly configures
  (e.g., future Bedrock LLM integration)
- All persistent data MUST live in `context.globalStorageUri`, not in
  the workspace
- Every disposable MUST be pushed to `context.subscriptions`
- All contribution points (commands, views, settings, menus) MUST be
  declared in `package.json`

**Violations**: External service dependencies, custom settings UI (VS Code
provides this), API calls without user configuration, data stored outside
extension storage paths.

### II. Extension Host Owns State (NON-NEGOTIABLE)

The extension host is the single source of truth. The WebView is a pure
renderer.

- All business logic, data fetching, and VS Code API access MUST live
  in `vsix/src/`
- The WebView sends user actions via `postMessage`, receives state
  pushes back
- No client-side data fetching, caching, or business logic in
  `webview/src/`
- State management in the WebView is limited to local UI concerns
  (filter selections, expanded rows, navigation)
- The typed message protocol (`ExtToWebviewMessage` /
  `WebviewToExtMessage`) is the only communication channel
- Both sides MUST use identical type definitions (discriminated unions
  with `type` field as discriminant)

**Violations**: Business logic in React components, data fetching from the
WebView, WebView maintaining authoritative state, untyped messages.

### III. Ship Fast / Simplicity First

Proven patterns over novel ones. Simple implementations that work end-to-end
beat sophisticated ones that don't ship.

- **KISS**: If there is a simpler way that works, use it
- **YAGNI**: Features only if required for the current scope. The data
  model can support future features without schema rewrites, but those
  features are not built until needed
- **Progressive foundation**: Design for extensibility at the data model
  level, not at the code level. No abstractions for hypothetical future
  requirements
- **Single developer**: The architecture MUST be understandable and
  debuggable by one person. No microservices, no message queues, no
  external infrastructure
- **Fallback design**: When a technology pairing is unproven (e.g.,
  PGLite + Prisma), design a fallback path (e.g., SQLite)

**Violations**: Premature abstractions, features not in the current scope,
infrastructure complexity (message queues, external services),
over-engineered patterns that add indirection without clear benefit.

### IV. Typed Contracts at Boundaries

All communication across boundaries uses TypeScript-enforced contracts.
Type safety is not optional.

- Extension host to WebView: `ExtToWebviewMessage` discriminated union
- WebView to extension host: `WebviewToExtMessage` discriminated union
- Data model types shared between `vsix/` and `webview/` via manual
  copy (both locations MUST stay in sync)
- TypeScript strict mode in both packages (all strict type-checking
  enabled)
- SARIF parsing MUST produce typed `Finding` models, not raw JSON
- Database queries through Prisma (type-safe ORM), not raw SQL

**Violations**: `any` types in production code (use `unknown` and narrow),
untyped message passing, raw JSON without parsing to typed models, type
files out of sync between packages.

### V. Theme Integration Over Custom Design

The WebView looks and feels like a native part of VS Code. The user's chosen
theme is the design system.

- `index.css` maps `--vscode-*` CSS variables to ShadCN/Tailwind
  design tokens
- ShadCN components inherit the active VS Code theme automatically
- No custom fonts (inherit via `--vscode-font-family`), no external
  resources (CSP blocks them)
- `color-scheme: dark` on `.vscode-dark` and `.vscode-high-contrast`
  for native browser controls
- `@custom-variant dark (&:is(.vscode-dark *))` remaps Tailwind's
  `dark:` prefix to VS Code's body class
- Domain-specific colors (severity badges, disposition badges) are the
  only exception -- these use hardcoded Tailwind classes for semantic
  meaning that MUST be consistent across themes
- No gradient meshes, noise textures, custom cursors, decorative
  overlays, or effects that clash with VS Code

**Violations**: Custom color palettes, external font loading, CSS that
bypasses theme variables, animations beyond functional transitions
(loading spinners, state changes).

### VI. Security by Default

A security scanning tool MUST itself be secure.

- CSP (`Content-Security-Policy`) required on all webviews --
  `default-src 'none'`, nonce-based script/style allowance
- `localResourceRoots` set restrictively -- only the webview-dist
  directory
- `acquireVsCodeApi()` called once at module scope, never leaked to
  global scope
- All user input and workspace data MUST be sanitized before display
- No `eval()`, no dynamic script injection
- OWASP top 10 awareness: no command injection when spawning ASH CLI,
  no XSS in WebView content

**Violations**: Missing CSP, `eval()`, unrestricted `localResourceRoots`,
unsanitized user input in WebView HTML, command injection via string
concatenation in `spawn()` arguments.

## Architecture Constraints

These are structural facts about the codebase, not aspirational principles.

### Monorepo Layout

```
workbench/
  vsix/      # VS Code extension (TypeScript, Node.js, tsc)
  webview/   # React WebView app (React 19, Vite 8, Tailwind v4, ShadCN/ui)
  docs/      # Docusaurus v3 documentation site
```

- Sibling package layout with copy-step bridge. No monorepo tooling
  (no Yarn workspaces, no Turborepo).
- `vsix/npm run build` triggers full chain: build webview, copy dist,
  compile extension.
- Vite produces fixed filenames (`dist/assets/index.js`,
  `dist/assets/index.css`) -- the extension host hardcodes these paths.

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
| Testing | Mocha (unit, Node.js) + `@vscode/test-electron` (integration) | sinon for mocking, `node:assert/strict` |
| Linting | ESLint (flat config, typescript-eslint) + Prettier | `eslint-config-prettier` last in config array |

### Data Model (4 Entities)

- **Project** -- 1:1 with workspace folder, root aggregate
- **ScanTarget** -- A directory path that has been scanned, unique per
  project by `(projectId, path)`. Organizes scans and findings by
  target location. Carries computed aggregates in the view layer
  (finding counts, severity breakdown, triage progress)
- **Scan** -- One ASH CLI execution, linked to a ScanTarget
  (status: RUNNING/COMPLETED/FAILED/CANCELLED)
- **Finding** -- One security issue, linked to both Scan and ScanTarget.
  Identified across scans by `(scanTargetId, ruleId, file)` composite
  index
- **Disposition** -- Finding triage state: PENDING, FIX, SUPPRESS, DEFER

### Core Loop

**Scan** (a target path) -> **View** (findings with filters by severity,
scanner, disposition, file pattern) -> **Navigate** (click to open file at
line) -> **Triage** (set disposition per finding) -> **Track** (cumulative
progress across scan targets via dashboard)

## Quality and Coding Conventions

### TypeScript Strictness

Both packages MUST use `strict: true` plus: `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `noUnusedParameters`, `noUnusedLocals`.

### Formatting and Linting

- Prettier: semicolons, single quotes, trailing commas, 100 char width,
  2-space tabs
- ESLint: `curly` (all control statements), `eqeqeq`,
  `no-throw-literal`, camelCase/PascalCase imports
- Test files relax: `no-non-null-assertion`, `no-explicit-any`,
  `no-require-imports`

### Test Strategy

| Runtime | What it tests | Speed | When to use |
|---------|---------------|-------|-------------|
| Unit (Node.js, Mocha) | Pure logic: parsers, database, utilities | ~1-2s | Default. Use whenever the module does not import `vscode` |
| Integration (VS Code Electron) | Extension activation, commands, providers | ~15s | Only when `vscode.*` APIs are required |

- SARIF test data: factory builders in
  `vsix/src/test/fixtures/sarif-factory.ts`
- Process mocking: dependency injection of `SpawnFn` (sinon cannot stub
  `child_process.spawn` under Node16 modules)
- PGLite in tests: in-memory instances for isolation (dynamic
  `import()` in `before()` hook, ESM-only)

### Visual Testing

The Kitchen Sink (`pages/sink/`) renders all UI components in a single
panel. Every new ShadCN or app-specific component MUST have a Kitchen Sink
demo that exercises all variants in both dark and light themes.

`mock-data.ts` is retained exclusively for Kitchen Sink demos. Production
code (App.tsx) MUST NOT import from `mock-data.ts`.

### Extension Host Conventions (vsix/)

- Named exports for all modules
- Services: classes with injected dependencies via constructor, async
  methods. Domain queries MUST go through service classes
  (`DatabaseService`, `ScannerService`, `FindingsService`), not inline
  Prisma calls in providers
- Providers: implement VS Code interfaces (`TreeDataProvider`,
  `WebviewViewProvider`). Providers receive services via setter methods
  (e.g., `setFindingsService()`)
- Mappers: `vsix/src/models/mappers.ts` contains pure functions that
  translate Prisma models to WebView view types (`mapFindingToRow`,
  `mapScanToSummary`, `mapScanTargetToView`). All Prisma-to-view
  translation MUST go through mappers
- Command IDs: `ashWorkbench.<verbNoun>`
  (e.g., `ashWorkbench.startScan`)
- Setting keys: `ashWorkbench.<category>.<setting>`
  (e.g., `ashWorkbench.llm.region`)
- Disposable pattern: push everything to `context.subscriptions`

### WebView Conventions (webview/)

- Named exports for components (exceptions: `App`, `SinkPage` as
  default exports)
- Props interfaces defined in same file, above the component
- Import paths: `@/components/ui/*` for ShadCN, `@/lib/utils` for
  utilities, relative for app code
- `import type { ... }` for type-only imports
- File naming: PascalCase for app components, kebab-case for ShadCN
  and sink demos
- Always use `cn()` utility when combining Tailwind classes with props
- ShadCN `ui/` files are auto-generated -- do not hand-edit
- Loading state pattern: App starts with empty state and `'loading'`
  view. Transitions to `'dashboard'` on first `stateUpdate` message
  from the extension host. No mock data in production paths

### Documentation Conventions (docs/)

- Autogenerated sidebars -- never modify `sidebars.ts` or
  `docusaurus.config.ts` to add pages
- Every `.md` file needs `title:` frontmatter; every new subdirectory
  needs `_category_.json`
- `README.md` in any directory becomes the category index
- File names: kebab-case (`system-overview.md`)
- Cross-links: relative file paths, not absolute URLs
- MDX compilation: escape bare `<` in prose (use backtick-wrap or HTML
  entities)
- Mermaid is the preferred diagram format

## Governance

1. This constitution supersedes ad-hoc decisions. When a feature plan,
   spec, or task contradicts a constitutional principle, the constitution
   wins unless formally amended.
2. Amendments require: (a) documenting the change and rationale,
   (b) updating the guidance document at
   `docs/docs/working/speckit/constitution-guidance.md`, (c) updating
   this file.
3. This constitution is a living document. It MUST be reviewed whenever:
   a new technology is adopted, a principle is found to be impractical,
   or the project scope changes significantly.
4. The `/speckit.constitution` command MUST re-read the guidance file
   before each update to ensure the constitution stays current with the
   codebase reality.
5. Version increments follow semantic versioning: MAJOR for principle
   removals or redefinitions, MINOR for new principles or material
   expansions, PATCH for clarifications and wording fixes.

**Version**: 1.1.0 | **Ratified**: 2026-03-16 | **Last Amended**: 2026-03-17
