# Research: Repairability Triage Analysis

**Feature**: 026-repairability-triage | **Date**: 2026-03-23

## R1: Data Storage Approach for Triage Classification

**Decision**: Add `triageAnalysis Json?` field to the existing `Finding` Prisma model.

**Rationale**: The existing `aiAnalysis Json?` field on Finding establishes the pattern for storing AI-generated analysis results as JSON. The triage classification is analogous — it's per-finding AI analysis with structured output. Storing as JSON on the same model:
- Requires one schema migration (ALTER TABLE ADD COLUMN)
- Needs no new Prisma model, no new relations, no new mapper functions beyond parsing
- Keeps all finding data co-located for efficient queries
- Follows the `parseStoredAiAnalysis()` pattern in `mappers.ts`

**Alternatives considered**:
- **Separate TriageAnalysis table**: Rejected — adds join complexity for every finding query, requires new Prisma model, new mapper, new relation definition. Over-engineered for what is fundamentally a per-finding metadata field.
- **Extend existing aiAnalysis JSON**: Rejected — couples triage classification with finding-level AI analysis (Spec 022). They serve different purposes and have different lifecycles (triage may be re-run without re-running deep analysis, and vice versa).

## R2: Chart Visualization Library

**Decision**: CSS-based charts using Tailwind utility classes. No external charting library.

**Rationale**: The codebase has an established pattern in `SeverityChart.tsx` — horizontal bars rendered as `<div>` elements with percentage widths and `severityColor[].fill` Tailwind classes. The triage dashboard needs:
- Horizontal bars (severity breakdown by repairability) — same as SeverityChart
- Stacked bars (progress within a category) — same as SidebarDashboard triage progress
- Clickable cells (severity × category matrix) — simple grid layout

All achievable with CSS. No charting library adds value for these simple visualizations.

**Alternatives considered**:
- **Recharts**: Rejected — adds ~200KB to bundle, requires theme integration, CSP considerations for SVG rendering in webview, and creates a new dependency to maintain. Overkill for bar charts.
- **Chart.js**: Rejected — same bundle/CSP/maintenance concerns. Canvas-based rendering has accessibility drawbacks.
- **ShadCN Charts (built on Recharts)**: Rejected — still brings in Recharts as dependency.

## R3: AI Classification Prompt Strategy

**Decision**: Single AI call per finding that returns both classification and category-specific guidance.

**Rationale**: The classification decision and the guidance generation share the same context: the finding's rule, severity, code snippet, file, description, and scanner. Splitting into two calls would:
- Double the latency (two round trips instead of one)
- Double the cost (two prompts with overlapping context)
- Add complexity (need to pass classification result to second call)

The single-call approach uses a structured output schema where the AI classifies the finding AND generates the appropriate action data in one response. The schema uses conditional fields based on the determined category.

**Prompt design**: The classification prompt provides:
- Finding context (all attributes from FR-002)
- Classification criteria for each category (from spec definitions)
- Output schema with category-specific sections
- Budget: ~$0.05 per finding (similar to suppression message generation)

**Alternatives considered**:
- **Two-pass (classify → generate)**: Rejected — doubles cost/latency as described above.
- **Batch classification in single call (multiple findings)**: Rejected — findings need individual context (code snippets, file paths) that don't compress well. Individual calls also allow per-finding progress reporting and failure isolation.

## R4: Easy Fix File Write Strategy

**Decision**: Targeted text replacement using `codeBefore`/`codeAfter` pattern with `vscode.workspace.fs` API.

**Rationale**: The AI generates a `codeBefore` (lines to replace) and `codeAfter` (replacement lines) with exact line numbers. The fix application:
1. Reads file content via `vscode.workspace.fs.readFile()`
2. Extracts lines at `startLine..endLine`
3. Validates extracted text matches `codeBefore` (character-for-character)
4. If match: replaces lines with `codeAfter`, writes file via `vscode.workspace.fs.writeFile()`
5. If no match: rejects with "file has changed, re-analyze recommended"

This is safer than a full-file rewrite because:
- The `codeBefore` validation catches stale fixes (file modified since analysis)
- Only the specific lines are modified (minimal blast radius)
- The user can review via `git diff` (assumption documented in spec)

**Security**: File path validated against workspace root to prevent directory traversal. The `codeBefore` match prevents applying fixes to the wrong location. AI-generated code is treated as untrusted user input from a modification perspective.

**Alternatives considered**:
- **VS Code TextEdit API**: Could use `vscode.workspace.applyEdit()` with `TextEdit.replace()` for undo support. Worth considering in implementation — would give the user Ctrl+Z undo for applied fixes. The trade-off is additional API complexity vs. the simpler FS write. Recommendation: start with FS write, upgrade to applyEdit if undo is requested.
- **Diff/patch application**: Rejected — adds complexity (unified diff parsing) without clear benefit when we control the before/after format.

## R5: Cache Invalidation (Fingerprinting)

**Decision**: SHA-256 hash of concatenated finding attributes: `ruleId|file|snippet|severity|description`.

**Rationale**: The fingerprint must capture all attributes that influence the AI's classification decision. If any of these change, the classification may be different:
- `ruleId`: Different rule = different vulnerability type
- `file`: Different file = different context
- `snippet`: Changed code = different fix approach
- `severity`: Different severity = different risk assessment
- `description`: Different description = different understanding

The hash is stored in the `triageAnalysis` JSON alongside the classification result. On dashboard load, the current finding's attributes are hashed and compared. Mismatch → stale → re-classify.

**Line numbers excluded**: Intentional. Code reformatting that changes line numbers but not content should not invalidate the classification. The snippet content is what matters.

**Alternatives considered**:
- **Timestamp-based (scan time vs analysis time)**: Rejected — a finding could persist unchanged across many scans, causing unnecessary re-analysis.
- **Finding version counter**: Rejected — requires schema change to Finding model to track versions, adds complexity without benefit over content-based fingerprinting.

## R6: Triage Dashboard Placement

**Decision**: Editor panel view (managed by `FindingsPanelManager`), accessed via sidebar button.

**Rationale**: The triage dashboard needs screen real estate for:
- Chart visualization (severity × category matrix)
- Finding counts per cell
- Drill-down list (when a cell is clicked)

The sidebar has constrained width (~300px) which is insufficient for a data matrix. The editor panel provides the full editor width. This matches the existing pattern where data-heavy views (FindingsView, FindingDetailView, ScanDetailView) are editor panel views.

**Navigation**: SidebarDashboard adds a "Triage" button. Clicking it calls `panelManager.showTriageDashboard()`, which sends an `init` message with `context: 'editorPanel'` and triggers a `triageSummaryUpdate` message.

**Alternatives considered**:
- **Sidebar view**: Rejected — insufficient width for charts and matrix display.
- **Separate webview panel**: Rejected — adds a new panel manager, violates "Ship Fast" principle. The existing FindingsPanelManager already manages multiple view contexts.

## R7: Existing Infrastructure Reuse

**Decision**: Maximize reuse of existing patterns and infrastructure.

| New Capability | Reuses |
|----------------|--------|
| Triage classification (AI call) | `AiService` provider lifecycle, `ensureProvider()`, budget/turn config |
| Batch classification | Batch analysis event pattern from Spec 023 (sequential, consecutive failure detection, progress events) |
| One-click suppress | `AshYamlWriteService.addSuppression()` — existing API, just pre-populates justification from triage |
| Finding queries | `FindingsService.getFindings()` with filters — existing API |
| Dashboard charts | `SeverityChart` CSS pattern + `severityColor`/`dispositionColor` map pattern |
| Progress tracking | `BatchAnalysisUIState` pattern for progress events |
| Finding navigation | View history stack, breadcrumb pattern, `postMessage` + `dispatch` dual pattern |
| Kitchen sink | `sink-registry.ts` + `{name}-demo.tsx` pattern |

**New infrastructure required**:
- `TriageService` (orchestration, caching, actions)
- `TriagePromptBuilder` (prompt construction)
- 3 new WebView components (dashboard, drill-down, finding panel)
- `repairabilityColor` map in theme-colors.ts
- 10 new ExtToWebview + 7 new WebviewToExt message types
- 1 DB migration (add `triageAnalysis` column)
