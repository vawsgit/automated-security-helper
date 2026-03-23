---
version: "1.0"
last_updated: 2026-03-23
source: docs/docs/developer-docs/architecture/software-design-specification/functional-design.md
---

# Functional Specification

## Product Overview

ASH Workbench is a VS Code extension that wraps the Automated Security Helper (ASH) CLI, providing a visual interface for running security scans, browsing findings, and triaging each finding with a disposition. The core loop is: **scan code → view findings → decide what to do about each one.**

The extension runs ASH as a child process, parses SARIF output into a local PGLite database, and presents findings through a React/ShadCN WebView panel embedded in VS Code. All data is local — no external services are required for the core workflow.

Design principles:
- **KISS** — Simple implementations that work end-to-end beat sophisticated ones that don't ship.
- **YAGNI** — Features included only if required for the core scan-triage-act loop.
- **Progressive foundation** — Data model and architecture support future features (AI enrichment, delta reports, categories) without rewrites, but those features are not built yet.

## User Personas

- **Security Engineer** — Runs ASH scans against infrastructure-as-code and application repositories. Technically proficient. Needs efficient triage of large finding sets, filtering by severity/scanner, and the ability to jump to affected code. Primary user of disposition workflow.
- **Developer** — Encounters ASH Workbench as part of a team security workflow. Moderate security knowledge. Needs to understand what a finding means, navigate to the affected code, and mark findings as fixed or deferred. Values integration with the editor (click-to-navigate).
- **Team Lead** — Reviews triage progress across scan targets. Needs summary views (severity breakdown, disposition counts, triage progress) to track remediation status. May not triage individual findings.

## Core User Journeys

### Journey 1: First Run Setup
**Persona:** Any user, first time opening the extension.

1. User opens a workspace in VS Code with the ASH Workbench extension installed.
2. Extension activates, initializes the PGLite database, and runs any pending migrations.
3. Extension detects no project exists for the current workspace.
4. User is prompted to create a project (name defaults to workspace folder name).
5. Project is created and persisted. Dashboard opens with an empty state and a "Run Scan" button.

**Success:** Project exists, dashboard is visible, user can initiate their first scan.

### Journey 2: Run a Scan
**Persona:** Security Engineer

1. User clicks "Run Scan" on the dashboard or a scan target card.
2. A scan target picker dialog presents: existing scan targets (with finding counts), the workspace root (default), and an option for a custom directory path.
3. User selects a target directory.
4. Extension spawns the ASH CLI process. A progress indicator shows elapsed time.
5. On completion, extension parses SARIF output, deduplicates findings by `(ruleId, file)`, and stores them.
6. The finding list for the completed scan is displayed automatically.

**Success:** Findings from the scan are visible in the finding list, severity breakdown is accurate.

### Journey 3: Triage Findings
**Persona:** Security Engineer or Developer

1. User views the finding list (from a scan, a scan target, or "All Findings").
2. User filters by severity (e.g., HIGH only) or scanner.
3. User clicks a finding row to view details: severity badge, description, rule ID, scanner, code excerpt with line numbers.
4. User clicks the file path link — VS Code opens the file at the exact line.
5. User reviews the code and sets a disposition: Fix, Suppress, or Defer.
6. The disposition persists immediately. Summary bar and badges update in place.
7. User continues to the next finding.

**Success:** Each finding has a disposition. Summary counts reflect triage progress.

### Journey 4: Review Triage Progress
**Persona:** Team Lead

1. User opens the dashboard.
2. Summary grid shows: total findings (with severity breakdown), scan target count, triage progress (percentage of findings with non-Pending dispositions).
3. Scan target cards show per-target: finding count, severity badges, triage progress bar, last scanned date.
4. User clicks a target card to drill into its findings, filtered to that target.

**Success:** User can assess remediation status without triaging individual findings.

### Journey 5: Manage Scan History
**Persona:** Security Engineer

1. User navigates to Scan History (sidebar tree view or WebView screen).
2. Scans are listed most-recent-first, showing: date/time, status icon, source directory, finding count, severity badges.
3. User can filter scans by scan target when multiple targets exist.
4. User selects a past scan to view its findings.
5. User deletes an old scan (with confirmation). The scan and its findings are removed.

**Success:** User can browse historical scans and clean up old data.

### Journey 6: Reset Application
**Persona:** Any user

1. User navigates to the Settings & Administration screen.
2. User clicks "Reset Application" (prominent warning styling).
3. Confirmation dialog warns that all projects, scans, and findings will be permanently deleted.
4. User confirms. Database is dropped and recreated. Extension reloads to first-run state.
5. VS Code configuration settings (ASH path, LLM settings) are preserved.

**Success:** Extension behaves as first-run. No data remnants.

## Feature Inventory

### Project Management
| Feature | Description | Status |
|---------|-------------|--------|
| Project creation | Create a project scoped to a workspace folder. 1:1 with workspace. | Implemented |
| Project auto-detect | On activation, find or prompt to create project for current workspace. | Implemented |
| Active project display | Project name shown in sidebar header / dashboard. | Implemented |

### Scan Execution
| Feature | Description | Status |
|---------|-------------|--------|
| Scan initiation | Start ASH scan via command palette, sidebar button, or dashboard. | Implemented |
| Scan target picker | Dialog to select workspace root, existing target, or custom path. | Implemented |
| Scan progress | Indeterminate progress indicator with elapsed time. | Implemented |
| Scan cancellation | Kill running ASH process, mark scan as cancelled. | Implemented |
| SARIF parsing | Parse ASH SARIF output into Finding records. | Implemented |
| Finding deduplication | Group by `(ruleId, file)` within a scan, merge line ranges. | Implemented |
| One-scan-at-a-time | Only one scan runs per project concurrently. | Implemented |

### Scan History
| Feature | Description | Status |
|---------|-------------|--------|
| Scan list | View past scans with date, status, finding count, severity badges. | Implemented |
| Scan target filtering | Filter scan history by scan target. | Implemented |
| Scan deletion | Delete a scan and cascade-delete its findings. | Implemented |
| Scan detail view | View full scan metadata and findings. | Implemented |

### Finding List & Detail
| Feature | Description | Status |
|---------|-------------|--------|
| Finding list | Table view with severity, description, file, scanner, disposition badge. | Implemented |
| Cumulative view | One row per unique `(scanTargetId, ruleId, file)`, most recent disposition. | Implemented |
| Sorting | By severity (default: HIGH first), file, scanner. | Implemented |
| Filtering | By severity, disposition, scanner, file path substring. | Implemented |
| Finding detail | Severity badge, description, rule IDs, scanner, code excerpt. | Implemented |
| Code navigation | Click file path to open file at exact line in VS Code editor. | Implemented |

### Finding Triage
| Feature | Description | Status |
|---------|-------------|--------|
| Disposition setting | Set Pending, Fix, Suppress, or Defer on each finding. | Implemented |
| Immediate persistence | Disposition saved to database on change, no explicit save step. | Implemented |
| Cumulative summary | Summary bar: Total, Pending, Fix, Suppress, Defer counts. | Implemented |
| Target-scoped dispositions | Same finding in different scan targets has independent dispositions. | Implemented |

### Suppression Management
| Feature | Description | Status |
|---------|-------------|--------|
| `.ash.yaml` read/write | Read and write suppression rules from `.ash.yaml` config files. | Implemented |
| Suppression rule management | Create, view, and manage suppression entries. | Implemented |

### AI Analysis (Experimental)
| Feature | Description | Status |
|---------|-------------|--------|
| AI finding analysis | Claude-powered vulnerability explanation and remediation suggestions. | Implemented |
| Batch analysis | Analyze multiple findings in sequence with failure handling. | Implemented |
| Safety hooks | Guard rails for AI tool usage and output validation. | Implemented |
| LLM settings | Configure provider (Bedrock), region, model, budget, tool mode. | Implemented |

### Settings & Administration
| Feature | Description | Status |
|---------|-------------|--------|
| ASH path configuration | Configure path to ASH CLI executable. | Implemented |
| Default scan parameters | Severity threshold, source directory defaults. | Implemented |
| LLM configuration | Provider, region, model ID, budget, max turns. | Implemented |
| Application reset | Drop all data and reinitialize. Preserves VS Code settings. | Implemented |
| Database migrations | Automatic schema upgrade on extension activation. | Implemented |
| Version display | Extension version, schema version, database stats on settings screen. | Implemented |

### Deferred (Future Versions)
| Feature | Description | Rationale |
|---------|-------------|-----------|
| Category grouping | Group findings by root cause, category-level disposition. | Requires categorization algorithm. |
| Research documents | Structured investigation documents (seed-and-fill). | Depends on category grouping. |
| Implementation plans | Remediation planning documents. | Depends on research documents. |
| Delta reports | Compare findings between scan runs. | Data model supports it; UI and reconciliation deferred. |
| Suppression file generation | Generate `.ash.yaml` from suppress-disposition findings. | Simple addition once triage works. |
| Batch operations | Apply disposition to multiple findings at once. | Useful but not essential for POC. |

## Business Rules

1. **Project-workspace binding:** A project is 1:1 with a VS Code workspace folder. The project's `rootPath` is the workspace folder path. Only one project is active at a time.
2. **Scan target containment:** A scan target must be within the project's root path.
3. **One concurrent scan:** Only one scan may run at a time per project.
4. **Finding identity:** Two findings are the "same" issue when they share the same `(scanTargetId, ruleId, file)` triple. This composite key drives deduplication and disposition carry-forward.
5. **Disposition scoping:** Dispositions are scoped per scan target. The same `(ruleId, file)` in two different scan target directories has independent dispositions. This prevents unrelated scans from interfering with each other's triage state.
6. **Disposition carry-forward:** Dispositions carry forward between scans sharing the same scan target. A finding triaged in scan N retains its disposition in scan N+1.
7. **Disposition transitions:** Any disposition (Pending, Fix, Suppress, Defer) can transition to any other. All transitions are user-initiated. No automated state changes in POC.
8. **Scan deletion cascades:** Deleting a scan cascades to its findings. The user must confirm before deletion.
9. **Reset preserves settings:** Application reset deletes all data (projects, scans, findings) but preserves VS Code configuration settings (ASH path, LLM settings).
10. **Migration-first activation:** The extension does not activate normally until the database schema is in a valid state. Pending migrations run automatically before the extension becomes usable.
11. **Forward-only migrations:** Downgrading the extension to a prior version with a newer database schema is not supported. The user must reset.

## Permissions and Access Control

ASH Workbench is a single-user VS Code extension. There is no multi-user access control.

| Actor | Capabilities |
|-------|-------------|
| Extension user | All operations: create projects, run scans, triage findings, configure settings, reset application |
| Extension host | Database access, ASH CLI process management, file system read (for code navigation) |
| WebView | UI rendering only. All data operations go through `postMessage` to the extension host. WebView cannot access the database or file system directly. |

## Data Requirements

### Entities

- **Project** — Root aggregate. Scopes all data to a workspace. Fields: id, name, rootPath, timestamps.
- **ScanTarget** — A directory path that ASH scans. Primary grouping dimension. Dispositions only carry forward between scans sharing the same target. Fields: id, projectId, path, displayName, timestamps.
- **Scan** — A single execution of the ASH scanner suite. Fields: id, projectId, scanTargetId, sourceDir, status (running/completed/failed/cancelled), severityThreshold, findingsCount, severityBreakdown (JSON), startedAt, completedAt, errorMessage.
- **Finding** — An individual security issue detected by a scanner. Fields: id, scanId, projectId, scanTargetId, ruleId, ruleIds (JSON array), scanner, severity (CRITICAL/HIGH/MEDIUM/LOW/INFO), file, startLine, endLine, description, snippet, disposition (pending/fix/suppress/defer).

### Relationships

```
Project 1──* ScanTarget 1──* Scan 1──* Finding
                        └──────────* Finding (denormalized)
```

- Project has many ScanTargets, Scans, and Findings.
- ScanTarget has many Scans and Findings.
- Scan has many Findings.
- Finding belongs to one Scan, one ScanTarget, and one Project.
- ProjectId and scanTargetId on Finding are denormalized for efficient cumulative queries.

### Key Indexes
- `Finding(projectId, ruleId, file)` — cumulative queries and deduplication
- `Finding(scanId, severity)` — filtered finding lists
- `Scan(projectId, startedAt)` — scan history ordering

## Integration Points

### ASH CLI (Primary)
- **Direction:** Extension → ASH CLI (child process)
- **Protocol:** Spawn subprocess, read SARIF from output directory
- **Invocation:** `ash --source-dir <path> --output-dir <temp> --output-formats sarif [--severity-threshold <level>]`
- **Output:** SARIF JSON files in the temp output directory
- **Exit codes:** 0 = clean, 1 = error, 2 = findings found
- **Scanners:** bandit, checkov, semgrep, cdk-nag, cfn-nag, detect-secrets, grype, npm-audit
- **User experience:** Progress indicator during scan. Error message on failure. Cancel kills the process.

### Claude AI / Bedrock (Experimental)
- **Direction:** Extension → Claude API via Anthropic SDK / AWS Bedrock
- **Purpose:** AI-powered finding analysis — vulnerability explanations, remediation suggestions
- **Configuration:** Provider, region, model ID, budget, and tool mode stored in VS Code settings
- **User experience:** Opt-in per-finding or batch analysis. Results displayed alongside scanner output.

### VS Code Editor API
- **Direction:** Extension → VS Code
- **Purpose:** Open files at specific lines when user clicks a code location in finding detail
- **Mechanism:** `vscode.commands.executeCommand('vscode.open', uri, { selection })`

### `.ash.yaml` Configuration Files
- **Direction:** Extension ↔ filesystem
- **Purpose:** Read and write suppression rules
- **User experience:** Suppression manager screen for creating/viewing rules

## Error Handling and Edge Cases

| Scenario | Behavior |
|----------|----------|
| ASH CLI not installed | Error message displayed. User directed to configure ASH path in settings. |
| ASH scan fails (exit code 1) | Scan marked as `failed`. Error message stored and displayed. Partial results discarded. |
| ASH scan cancelled | ASH process killed. Scan marked as `cancelled`. Partial results discarded. |
| SARIF parse failure | Scan marked as `failed` with parse error details. No findings stored. |
| Database migration failure | Extension does not activate normally. User offered "Reset Application" or "Retry". |
| Database corruption | User can reset application to reinitialize from scratch. |
| Scan target outside project root | Rejected. Target must be within workspace root path. |
| No findings in scan | Scan completes successfully with `findingsCount: 0`. Empty finding list displayed. |
| Concurrent scan attempt | Rejected. Only one scan at a time per project. |
| File not found on code navigation | VS Code handles gracefully (file may have been moved/deleted since scan). |
| AI analysis failure | Individual finding analysis fails gracefully. Batch analysis tracks failures and continues. |
| Extension downgrade with newer schema | Not supported. User must reset application. |

## Non-Functional Requirements

- **Local-only data:** All scan data, findings, and dispositions stored in a local PGLite database within the extension's `globalStorageUri`. No network calls for core functionality.
- **Startup performance:** Database initialization and migration check should complete within 2 seconds for normal activation.
- **Scan responsiveness:** UI remains responsive during scans. Progress indicator updates at regular intervals. Cancel is responsive (process kill, not graceful shutdown).
- **Data persistence:** All data survives VS Code restarts. Database is durable across extension updates (migrations handle schema changes).
- **Extension size:** WebView assets bundled with fixed filenames (`index.js`, `index.css`). Build optimization via Vite production build.
- **VS Code compatibility:** Engine requirement `^1.110.0`. Activation on-demand (command-triggered or sidebar view).

## Glossary

| Term | Definition |
|------|-----------|
| **Finding** | An individual security issue detected by a scanner. NOT "vulnerability", "issue", or "alert". |
| **Disposition** | A user-assigned triage status on a finding: Pending, Fix, Suppress, or Defer. |
| **Scan Target** | A directory path that ASH scans. The primary grouping dimension — dispositions carry forward only within the same target. |
| **Scanner** | One of the ASH security analysis tools: bandit, checkov, semgrep, cdk-nag, cfn-nag, detect-secrets, grype, npm-audit. |
| **SARIF** | Static Analysis Results Interchange Format. The JSON format ASH produces for scan output. |
| **Project** | The root data container, 1:1 with a VS Code workspace folder. Scopes all scans, targets, and findings. |
| **Triage** | The process of reviewing findings and assigning dispositions. |
| **Cumulative view** | A finding list showing one row per unique finding identity across all scans, with the most recent disposition. |
| **Finding identity** | The composite key `(scanTargetId, ruleId, file)` that determines whether two findings are the "same" issue. |
| **PGLite** | Embedded WASM PostgreSQL database. Runs in-process, no external server. |
