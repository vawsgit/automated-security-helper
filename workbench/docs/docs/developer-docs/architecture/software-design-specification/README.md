---
title: Overview
---

# Software Design Specification

A concise overview of what ASH Workbench is, why it exists, and what it does. Intended as a fast-read context document for AI processes, new contributors, and anyone who needs to understand the project without reading the full design specifications.

:::info Design Intent vs. Current Implementation
These documents reflect the **original design intent** for ASH Workbench. The project has evolved through numbered implementation specs, and the current codebase may differ from what is described here. For as-built documentation of specific subsystems, see the sibling architecture docs: [Extension Host](../extension-host.md), [Database](../database.md), [Services](../services.md), [AI Integration](../ai-integration.md), and [Suppression System](../suppression-system.md).
:::

## What It Is

ASH Workbench is a VS Code extension that provides a graphical interface for the [Automated Security Helper (ASH)](https://github.com/awslabs/automated-security-helper) -- an open-source security scanning CLI that aggregates findings from multiple static analysis tools (Bandit, Checkov, Semgrep, cdk-nag, cfn-nag, detect-secrets, Grype, npm-audit).

## The Problem It Solves

ASH is a command-line tool. Its output is a flat list of security findings across multiple scanners, delivered as SARIF/JSON/text files. For non-trivial projects, a single scan can produce hundreds of findings. Without tooling, developers must:

- Manually parse and cross-reference findings across scanner outputs
- Track which findings have been reviewed, which need fixes, and which are accepted risks
- Re-navigate to affected code locations by hand after each scan
- Lose context between scan iterations with no persistent triage state

ASH Workbench eliminates this friction by embedding the scan-triage-act workflow directly into the IDE.

## What It Does (Core Loop)

**Scan** -- Run ASH against workspace code from within VS Code. The extension spawns the ASH CLI as a child process, parses the SARIF output, and stores structured findings in an embedded database.

**View** -- Browse findings in a rich UI (React + ShadCN WebView) with filtering by severity, scanner, file, and triage status. Click any finding to see affected code with syntax-highlighted excerpts.

**Navigate** -- Click a code location to jump directly to the affected file and line in the VS Code editor. This is the single most valuable interaction in the tool.

**Triage** -- Set a disposition on each finding: Pending, Fix, Suppress, or Defer. Dispositions persist across sessions and scans, giving developers a cumulative view of their security posture.

**Track** -- View scan history with summary metadata (date, finding count, severity breakdown). See cumulative triage progress across all scans in a project.

## Architecture at a Glance

The extension runs entirely within the VS Code process. There are no external servers, APIs, or cloud dependencies.

| Component | Technology | Role |
|-----------|-----------|------|
| Extension Host | TypeScript / Node.js | Command handling, scan orchestration, data layer, message bridge |
| WebView | React 19 + ShadCN/ui + Vite | Rich finding list, detail view, triage controls |
| Database | PGLite (in-process WASM PostgreSQL) + Prisma ORM | Persistent storage for projects, scans, and findings |
| Scanner Integration | ASH CLI (Python, spawned as child process) | Produces SARIF output consumed by the extension |
| Sidebar | VS Code native TreeDataProvider | Scan history with status icons |

**Data model:** Three entities -- Project (scoped to a workspace), Scan (one CLI execution), Finding (one security issue). Findings are identified across scans by a `(ruleId, file)` composite key.

**Communication:** The WebView is a pure renderer. All state lives in the extension host. Data flows through a typed `postMessage` protocol -- the WebView sends user actions, the extension host responds with state updates.

## What It Does NOT Do (Current Scope)

:::warning
The exclusions listed below reflect the original POC scope. Several of these features have since been implemented (AI analysis, suppression management, batch analysis). See [Project Overview](../../project-overview.md) for the current feature set.
:::

The initial version (POC/v1) deliberately excludes:

- ~~AI-enriched explanations or automated fix suggestions~~ *(implemented in Specs 018–023)*
- Category grouping of findings by root cause
- Delta reports comparing findings between scan runs
- ~~Suppression file generation (`.ash.yaml` entries)~~ *(implemented in Spec 016)*
- ~~Batch triage operations~~ *(batch analysis implemented in Spec 023)*
- Research or implementation plan documents

These are planned for future versions. The data model is designed to support them without schema rewrites.

## Value Promise

For a developer using ASH today: ASH Workbench turns a CLI output file into an interactive, persistent, navigable security triage workflow inside the editor where fixes are made -- reducing the time from "finding detected" to "finding addressed."
