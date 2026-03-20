---
title: GitHub Pages Deployment Research
---

# GitHub Pages Deployment Research

Research into publishing the ASH Workbench Docusaurus site (`workbench/docs/`) to GitHub Pages using GitHub Actions.

## Overview

The ASH Workbench documentation site is a **Docusaurus v3.9.2** site living inside a **monorepo** at `workbench/docs/`. The parent repository (`automated-security-helper`) already has a **MkDocs-based documentation site** at the repo root (`/docs/`) that deploys to GitHub Pages via the `gh-pages` branch. Introducing a second docs site on GitHub Pages requires careful planning around URL routing, workflow design, and the transition from branch-based to Actions-based publishing.

## Current State

### Existing MkDocs Deployment

- **Workflow**: `.github/workflows/ash-repo-docs.yml`
- **Technology**: MkDocs (Python 3.12, `uv` package manager)
- **Deploy method**: `mkdocs gh-deploy --clean --force` (pushes to `gh-pages` branch)
- **Trigger**: Push to `main` or tags for deployment; all branches/PRs for build validation
- **Permissions**: `contents: write` (needed to push to `gh-pages`)
- **Publishing source**: Branch-based (`gh-pages`)

### Docusaurus Site Configuration

Key settings from `docusaurus.config.ts`:

| Setting | Current Value | Issue |
|---------|--------------|-------|
| `url` | `'https://github.com'` | Placeholder — wrong for GitHub Pages |
| `baseUrl` | `'/'` | Wrong for a project site (needs `/<repo-name>/`) |
| `organizationName` | `'awslabs'` | Correct for upstream; remote is `vawsgit` (fork) |
| `projectName` | `'automated-security-helper'` | Correct |
| `onBrokenLinks` | `'warn'` | Should consider `'throw'` for CI |
| `trailingSlash` | *not set* | Should be set explicitly for GitHub Pages |
| `future.v4` | `true` | Docusaurus v4 forward-compatibility opt-in |

**Production build behavior**: `DOCUSAURUS_ENV=production` excludes `working/**` docs, removes the Working sidebar and navbar item (`docusaurus.config.ts:5,47,80-85`).

**Static assets**: `.nojekyll` exists at `workbench/docs/static/.nojekyll` (confirmed). This is essential — without it, GitHub Pages would use Jekyll and strip directories beginning with `_`.

**No `CNAME` file** exists (none needed unless using a custom domain).

### Repository Details

| Item | Value |
|------|-------|
| Remote | `git@github.com:vawsgit/automated-security-helper.git` |
| Default branch | `main` |
| `gh-pages` branch | Does not exist yet (no remote branch) |
| Node requirement | `>=20.0` (per `workbench/docs/package.json`) |
| `package-lock.json` | Exists at `workbench/docs/package-lock.json` |

## Architecture: Two Publishing Approaches

### Option A: GitHub Actions Publishing Source (Recommended)

Uses `actions/upload-pages-artifact` + `actions/deploy-pages` to publish directly from a workflow artifact. No `gh-pages` branch needed.

```mermaid
flowchart LR
    A[Push to main] --> B[Checkout repo]
    B --> C[npm ci in workbench/docs]
    C --> D[npm run build with DOCUSAURUS_ENV=production]
    D --> E[upload-pages-artifact]
    E --> F[deploy-pages]
    F --> G[Live on GitHub Pages]
```

**Pros:**

- No `gh-pages` branch cluttering the repo
- OIDC token verification (better security)
- Deployment protection rules via GitHub environment settings
- Cleaner audit trail (deployment tied to workflow run)
- No `contents: write` permission needed

**Cons:**

- Repository Settings must be changed: **Settings &gt; Pages &gt; Source** set to **"GitHub Actions"**
- **Cannot coexist with branch-based MkDocs deployment** on the same repo — only one publishing source is allowed per repository

**Required permissions:**

```yaml
permissions:
  pages: write
  id-token: write
```

### Option B: Branch-Based (`gh-pages`)

Push built artifacts to a `gh-pages` branch, similar to current MkDocs approach.

**Pros:**

- Familiar pattern (already used by MkDocs)
- No repo settings change needed if already using branch-based

**Cons:**

- Requires `contents: write` permission
- `gh-pages` branch adds noise
- `GITHUB_TOKEN` commits don't trigger Pages builds (workaround: use PAT or deploy key — adds complexity)
- Can't use deployment protection rules

### Decision Factor: The MkDocs Conflict

**This is the central question.** A single GitHub Pages site can only have **one publishing source**. Today that source is the `gh-pages` branch (MkDocs). Deploying Docusaurus requires one of:

1. **Replace MkDocs entirely** — Switch publishing source to GitHub Actions, remove old workflow, deploy only Docusaurus
2. **Merge both sites** — Build both MkDocs and Docusaurus in one workflow, combine output into a single artifact (e.g., MkDocs at `/` and Docusaurus at `/workbench/` or vice versa)
3. **Separate repos** — Move Docusaurus docs to a separate repo with its own GitHub Pages site (adds complexity, splits concerns)
4. **Subdomain/path routing** — Use a custom domain with path-based routing (requires infrastructure outside GitHub Pages)

**Recommendation: Option 1 (Replace MkDocs)** is the cleanest path if the Docusaurus site is intended to supersede the MkDocs site. Option 2 is feasible but fragile — building two separate doc systems and merging their output is error-prone and couples their deployment lifecycle.

## Detailed Findings

### Required `docusaurus.config.ts` Changes

For a **project site** at `https://vawsgit.github.io/automated-security-helper/`:

```typescript
url: 'https://vawsgit.github.io',
baseUrl: '/automated-security-helper/',
```

For the **upstream** (`awslabs`), if the intent is to publish from the upstream repo:

```typescript
url: 'https://awslabs.github.io',
baseUrl: '/automated-security-helper/',
```

**`trailingSlash`**: GitHub Pages serves content with trailing slashes. Docusaurus recommends explicitly setting this to avoid 404s or redirect loops. Add:

```typescript
trailingSlash: false,  // or true — pick one and be consistent
```

**`editUrl`**: Currently points to `awslabs/automated-security-helper`. Correct for upstream contributions but verify this is intentional if deploying from `vawsgit`.

### Recommended Workflow: `deploy-docusaurus.yml`

Based on the official Docusaurus deployment guide, adapted for this monorepo:

```yaml
name: Deploy Docusaurus to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'workbench/docs/**'
      - '.github/workflows/deploy-docusaurus.yml'
  workflow_dispatch: {}

permissions:
  contents: read

jobs:
  build:
    name: Build Docusaurus
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: workbench/docs
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: workbench/docs/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build site
        run: npm run build
        env:
          DOCUSAURUS_ENV: production

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: workbench/docs/build

  deploy:
    name: Deploy to GitHub Pages
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Recommended Workflow: `test-docusaurus.yml`

Validates the build on PRs without deploying:

```yaml
name: Test Docusaurus Build

on:
  pull_request:
    branches: [main]
    paths:
      - 'workbench/docs/**'

jobs:
  test-build:
    name: Test documentation build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: workbench/docs
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: workbench/docs/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Test build
        run: npm run build
        env:
          DOCUSAURUS_ENV: production
```

### Monorepo-Specific Considerations

1. **`working-directory`**: All `npm` commands must run inside `workbench/docs/`. Using `defaults.run.working-directory` at the job level is cleaner than per-step `working-directory`.

2. **`cache-dependency-path`**: `actions/setup-node` defaults to looking for `package-lock.json` at the repo root. Must explicitly point to `workbench/docs/package-lock.json`.

3. **`upload-pages-artifact` path**: The `path` input is relative to the repo root, so it must be `workbench/docs/build` (not just `build`).

4. **Path filtering**: The `paths: ['workbench/docs/**']` trigger filter prevents unnecessary deployments when only Python code or the extension changes. Include the workflow file itself in the filter so changes to the workflow trigger a run.

5. **`fetch-depth: 0`**: Full git history is needed if Docusaurus uses `showLastUpdateTime` or `showLastUpdateAuthor` doc plugin options. Currently these are not enabled, but using `fetch-depth: 0` is low-cost and future-proofs the workflow.

### Action Version Reference

| Action | Version | Purpose |
|--------|---------|---------|
| `actions/checkout` | `@v4` | Clone repository |
| `actions/setup-node` | `@v4` | Install Node.js with npm caching |
| `actions/upload-pages-artifact` | `@v3` | Package build output for Pages |
| `actions/deploy-pages` | `@v4` | Deploy artifact to GitHub Pages |
| `actions/configure-pages` | `@v5` | *Not needed* — Docusaurus manages its own config statically |

### Node.js Version

Docusaurus v3 requires Node `>=20.0`. The `package.json` enforces this via `engines`. Use `node-version: 20` in the workflow (current LTS). Node 22 is also valid but 20 is the safer choice for CI stability.

### Caching Strategy

**npm cache** (`actions/setup-node` with `cache: npm`): Caches `~/.npm` so `npm ci` downloads are served from cache. `node_modules` is still rebuilt each run (expected behavior). This is sufficient — Docusaurus build caching (`.docusaurus/`) provides minimal CI benefit.

### `DOCUSAURUS_ENV=production` Is Critical

Without this env var, the production build will include:

- All `working/**` documents (research notes, AI working docs, draft plans)
- The "Working" sidebar in navigation
- The "Working" card on the homepage

This would expose internal development artifacts publicly. The workflow **must** set `DOCUSAURUS_ENV: production` on the build step.

## Patterns and Conventions

### Existing CI Conventions in This Repo

From the 6 existing workflows in `.github/workflows/`:

- Workflows use `actions/checkout@v4` consistently
- Python workflows use `astral-sh/setup-uv@v5` for dependency management
- Permissions are scoped per-job, not at workflow level (security best practice)
- `checkov:skip` comments are used where elevated permissions are justified
- `workflow_dispatch` is included for manual triggering

The Docusaurus workflow should follow the same conventions: per-job permissions, include `workflow_dispatch`, and document any elevated permissions.

### Docusaurus Build Convention

The `npm run build` script in `package.json` runs `docusaurus build`, which outputs to `workbench/docs/build/`. The `build/` directory is in `.gitignore`. The `.docusaurus/` cache directory is also gitignored.

## Issues and Risks

### Risk 1: MkDocs and Docusaurus Cannot Coexist on the Same GitHub Pages Site

**Severity: High** — This is a blocking architectural decision.

GitHub Pages allows exactly one publishing source per repository. Currently the MkDocs site uses the `gh-pages` branch. Switching to Actions-based publishing for Docusaurus would break the MkDocs deployment. The team must decide: replace MkDocs, merge the outputs, or use separate deployment targets.

### Risk 2: `baseUrl` Mismatch Causes Broken Asset Loading

**Severity: High** — If `baseUrl` is not set to `/automated-security-helper/` before deployment, all CSS, JS, and image assets will 404. The site will render as unstyled HTML.

The current `baseUrl: '/'` works for local development but is wrong for a GitHub Pages project site. This must be changed **before** the first deployment.

### Risk 3: `url` Configuration Depends on Fork vs. Upstream

**Severity: Medium** — The remote is `vawsgit/automated-security-helper` but the config references `awslabs`. If deploying from the fork, `url` should be `https://vawsgit.github.io`. If deploying from upstream, it should be `https://awslabs.github.io`. Getting this wrong causes SEO issues and broken canonical URLs.

### Risk 4: Working Docs Leak to Production

**Severity: Medium** — If `DOCUSAURUS_ENV=production` is not set in the workflow, internal research notes and draft documents will be publicly accessible. The environment variable is the sole gate for this content.

### Risk 5: `onBrokenLinks: 'warn'` Allows Silent Failures

**Severity: Low** — Currently broken links produce warnings but don't fail the build. In CI, consider setting `onBrokenLinks: 'throw'` so broken internal links are caught before deployment. This can be done via environment-specific config or as a permanent change.

### Risk 6: `trailingSlash` Not Set

**Severity: Low** — GitHub Pages adds trailing slashes by default. If `trailingSlash` is not explicitly set in `docusaurus.config.ts`, some paths may produce 404s or redirect loops depending on how links are authored. Set it to `false` (Docusaurus default behavior) or `true` (matches GitHub Pages default).

### Risk 7: Path Filter May Miss Transitive Changes

**Severity: Low** — The `paths: ['workbench/docs/**']` filter won't trigger a rebuild if a change outside `workbench/docs/` affects the site (unlikely but possible if shared config or assets are introduced). The `workflow_dispatch` trigger provides a manual escape hatch.

## Configuration and Environment

### GitHub Repository Settings Required

1. **Settings &gt; Pages &gt; Build and deployment &gt; Source**: Change from "Deploy from a branch" to **"GitHub Actions"**
2. **Settings &gt; Environments**: The `github-pages` environment is auto-created on first deployment. Optionally add deployment protection rules (require reviewers, restrict to `main`).
3. **Settings &gt; Actions &gt; General**: Ensure Actions are enabled and `GITHUB_TOKEN` has appropriate permissions.

### Environment Variables

| Variable | Value | Where Set | Purpose |
|----------|-------|-----------|---------|
| `DOCUSAURUS_ENV` | `production` | Workflow `env` on build step | Exclude working docs |
| `NODE_VERSION` | `20` | `actions/setup-node` input | Matches `engines` requirement |

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/deploy-docusaurus.yml` | Create | New deployment workflow |
| `.github/workflows/test-docusaurus.yml` | Create | PR build validation |
| `workbench/docs/docusaurus.config.ts` | Modify | Fix `url`, `baseUrl`, `trailingSlash` |
| `.github/workflows/ash-repo-docs.yml` | Modify/Remove | Handle MkDocs transition |

## Testing Coverage

### What to Validate Before First Deploy

1. **Local production build**: Run `DOCUSAURUS_ENV=production npm run build` in `workbench/docs/` and verify:
   - No `working/` pages in `build/` output
   - All links resolve (no broken link warnings)
   - Assets load correctly when served with `npx serve build --listen 3000` and browsing to `http://localhost:3000/automated-security-helper/`
2. **`baseUrl` verification**: Confirm all routes include `/automated-security-helper/` prefix
3. **Workflow dry run**: Push workflow to a feature branch, run via `workflow_dispatch`, verify artifact is created (won't deploy since Pages source isn't changed yet)
4. **Post-deploy smoke test**: After first deployment, verify:
   - Homepage loads with correct styling
   - User Docs and Developer Docs navigation works
   - No "Working" section visible
   - GitHub link in navbar is correct
   - Footer links work

## Key Takeaways

1. **The MkDocs conflict is the #1 decision point.** You cannot deploy both MkDocs and Docusaurus to the same GitHub Pages site without merging their outputs. Decide whether Docusaurus replaces MkDocs or coexists with it before writing any workflow.

2. **`baseUrl` and `url` must be fixed before deployment.** The current placeholder values will produce a broken site. These are one-line changes but have high impact.

3. **`DOCUSAURUS_ENV=production` is not optional.** Without it, internal working documents will be published publicly.

4. **The Actions-based publishing source is the modern approach.** It's cleaner, more secure, and recommended by both GitHub and Docusaurus. The only reason to use branch-based is if MkDocs must continue deploying alongside Docusaurus.

5. **The monorepo adds path management complexity** but nothing fundamentally difficult. The key adjustments are `working-directory`, `cache-dependency-path`, and artifact `path` — all well-documented patterns.

6. **The workflow itself is straightforward.** Approximately 40 lines of YAML, using standard GitHub Actions. No custom actions or complex scripting needed.

## Outstanding Questions

### MkDocs Transition

- **Is the Docusaurus site intended to replace the MkDocs site entirely?** If so, when? The MkDocs site at the repo root (`/docs/`) covers the Python CLI documentation, while the Docusaurus site covers the VS Code extension (ASH Workbench). These may serve different audiences.
- **Could both doc sets be consolidated into Docusaurus?** MkDocs content could be migrated as a new sidebar section in Docusaurus, eliminating the dual-site problem.
- **Is there a deprecation timeline for MkDocs?** If MkDocs must remain, a merged-output workflow or separate deployment target is needed.

### URL and Branding

- **Which GitHub org is the deployment target — `vawsgit` or `awslabs`?** The remote is `vawsgit` but all config references `awslabs`. This determines the `url` setting and GitHub Pages URL.
- **Is a custom domain planned?** A custom domain (e.g., `docs.ash.example.com`) would simplify `baseUrl` to `/` and avoid the org/project URL question entirely.

### Content and Access

- **Should the "Working" section be accessible via a non-production URL?** For example, deploy a separate preview site (from feature branches or a staging environment) that includes working docs for internal use.
- **Should `onBrokenLinks` be changed to `'throw'` for production builds?** This would prevent deploying pages with broken internal links but could block deployment if external links are temporarily down.

## Recommended Implementation Plan

### Phase 1: Configuration — Fix Docusaurus settings for GitHub Pages

1. **Update `url` and `baseUrl`** — Set correct values in `docusaurus.config.ts` based on target org (`vawsgit` or `awslabs`)
2. **Set `trailingSlash`** — Add explicit `trailingSlash: false` to prevent routing inconsistencies
3. **Local validation** — Run production build locally and verify with `npx serve` that all paths resolve correctly under the new `baseUrl`

### Phase 2: Workflows — Create GitHub Actions for deployment

1. **Create deploy workflow** — `deploy-docusaurus.yml` with build + deploy jobs, path filtering, production env var
2. **Create test workflow** — `test-docusaurus.yml` for PR build validation
3. **Test on feature branch** — Push workflows, trigger via `workflow_dispatch`, verify artifact creation

### Phase 3: Transition — Handle MkDocs coexistence

1. **Decide MkDocs fate** — Replace, merge, or separate (requires team input)
2. **Update GitHub Pages source** — Switch from branch-based to Actions-based in repository settings
3. **Modify or retire MkDocs workflow** — Update `ash-repo-docs.yml` based on transition decision
4. **First production deploy** — Merge to `main`, verify live site
5. **Post-deploy validation** — Smoke test all navigation, links, and content filtering
