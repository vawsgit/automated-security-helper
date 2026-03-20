# Implementation Plan: Finding Analysis — Core AI Feature

**Branch**: `022-finding-analysis` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-finding-analysis/spec.md`

## Summary

Complete the end-to-end AI finding analysis flow by implementing custom MCP tools for enriched agent context, updating the WebView to display analysis trigger/progress/cancel/metadata UI, and wiring the per-finding analysis state through the reducer. The extension host infrastructure (AiService, ClaudeAgentProvider, message protocol, persistence) is already implemented from Specs 018-021.

## Technical Context

**Language/Version**: TypeScript / ES2022, Node16 modules, strict mode
**Primary Dependencies**: `@anthropic-ai/claude-agent-sdk ^0.2.80`, React 19, ShadCN/ui, Tailwind CSS v4, Prisma ORM
**Storage**: PGLite (WASM PostgreSQL) via Prisma — `Finding.aiAnalysis` JSON column (existing)
**Testing**: Mocha (unit, Node.js) + `@vscode/test-electron` (integration), sinon for mocking
**Target Platform**: VS Code extension (desktop, ^1.110.0)
**Project Type**: VS Code extension monorepo (vsix/ + webview/)
**Performance Goals**: SC-001: analysis < 60s typical, SC-002: first progress < 5s, SC-003: cancel < 3s
**Constraints**: In-process only (no external servers), max 5 concurrent analyses, per-analysis budget limit
**Scale/Scope**: Single developer, ~15 files modified/created

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | All logic in-process. MCP server is in-memory, not a network service. No new external dependencies. |
| II. Extension Host Owns State | PASS | All business logic (MCP tools, analysis orchestration) in vsix/. WebView only renders state and sends user actions. |
| III. Ship Fast / Simplicity First | PASS | No new abstractions. MCP tools are plain functions. WebView state is a simple Record. |
| IV. Typed Contracts at Boundaries | PASS | MCP tool schemas typed. FindingRow extended with typed metadata field. Messages already typed. |
| V. Theme Integration | PASS | New UI uses ShadCN components with VS Code theme variables. No custom colors beyond existing domain color maps. |
| VI. Security by Default | PASS | Agent tools restricted by toolMode setting. `permissionMode: 'dontAsk'` auto-denies anything outside allowedTools. No user input rendered as HTML. |

**Post-Phase 1 re-check**: All principles still PASS. No external services, no new abstractions, all state in extension host.

## Project Structure

### Documentation (this feature)

```text
specs/022-finding-analysis/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── messages.md      # Phase 1 output — MCP tool schemas + error guidance
├── checklists/
│   └── requirements.md  # Spec validation checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
vsix/src/
├── services/
│   ├── mcpTools.ts                    # NEW — Custom MCP tool definitions
│   ├── claudeAgentProvider.ts         # MODIFY — Register MCP server in query()
│   └── findings.ts                    # MODIFY — Add getRelatedFindings() query method
├── models/
│   ├── types.ts                       # MODIFY — Add analysisMetadata to FindingRow
│   └── mappers.ts                     # MODIFY — Extract metadata in mapFindingToRow
├── providers/
│   └── findingsPanelManager.ts        # VERIFY — Existing handlers sufficient
└── test/
    └── unit/
        ├── mcpTools.test.ts           # NEW — MCP tool unit tests
        └── findingAnalysisFlow.test.ts # NEW — End-to-end flow tests

webview/src/
├── types/
│   └── types.ts                       # MODIFY — Sync analysisMetadata field
├── components/
│   ├── FindingDetailView.tsx          # MODIFY — Add Analyze/Cancel buttons, progress
│   ├── AiAnalysisPanel.tsx            # MODIFY — Add metadata section
│   └── AnalysisProgress.tsx           # NEW — Progress indicator component
└── App.tsx                            # MODIFY — Track per-finding analysis UI state
```

**Structure Decision**: Extends existing monorepo layout. One new service file (`mcpTools.ts`) and one new component (`AnalysisProgress.tsx`). All other changes are modifications to existing files.

## Complexity Tracking

No constitution violations. No complexity justifications needed.

## Implementation Phases

### Phase A: Custom MCP Tools (Extension Host)

**Goal**: Give the AI agent access to structured finding context from the database.

**Files**:
- `vsix/src/services/mcpTools.ts` (NEW)
- `vsix/src/services/findings.ts` (MODIFY — add `getRelatedFindings`)
- `vsix/src/services/claudeAgentProvider.ts` (MODIFY — register MCP server)

**Work**:
1. Create `mcpTools.ts` with `createFindingMcpServer(findingsService, findingId, workspaceRoot)`:
   - `get_finding_context` tool: calls `getFindingDetail()`, reads source file for ±20 lines surrounding code, returns combined context.
   - `list_related_findings` tool: calls new `getRelatedFindings()` method, returns max 25 findings from same scan matching ruleId/scanner/file.
2. Add `FindingsService.getRelatedFindings(findingId)` method: loads target finding to get scanId/ruleId/scanner/file, then queries for related findings in same scan with OR conditions, excludes self, limits to 25.
3. Update `ClaudeAgentProvider.analyzeFinding()`: create MCP server via `createFindingMcpServer()`, pass to query options via `mcpServers`.
4. Add MCP tool names to the `allowedTools` array so they're permitted in both read-only and full modes.

**Tests**:
- Unit test `get_finding_context` with mock FindingsService and filesystem
- Unit test `list_related_findings` with mock data
- Unit test MCP server registration in query options

### Phase B: Metadata Propagation (Extension Host + WebView Types)

**Goal**: Surface analysis metadata (model, cost, tools) to the WebView.

**Files**:
- `vsix/src/models/types.ts` (MODIFY)
- `vsix/src/models/mappers.ts` (MODIFY)
- `webview/src/types/types.ts` (MODIFY — manual sync)

**Work**:
1. Add `analysisMetadata: AnalysisMetadata | null` to `FindingRow` in both `types.ts` files.
2. Update `mapFindingToRow` in `mappers.ts`: parse `Finding.aiAnalysis` JSON as `StoredAiAnalysis`, extract `stored.metadata` → `analysisMetadata` alongside existing `stored.analysis` → `aiAnalysis`.
3. Ensure `aiAnalysisResult` reducer case also updates `analysisMetadata` on the selected finding.

### Phase C: WebView Analysis UI State (WebView)

**Goal**: Track in-flight analysis state per finding in the WebView reducer.

**Files**:
- `webview/src/App.tsx` (MODIFY)

**Work**:
1. Add `analysisStates: Record<string, AnalysisUIState>` to `AppState`.
2. Define `AnalysisUIState`: `{ status: 'analyzing' | 'error', message: string, toolName?: string, errorType?: string }`.
3. Update reducer cases:
   - `aiAnalysisStarted`: set `analysisStates[findingId] = { status: 'analyzing', message: 'Starting analysis…' }`
   - `aiAnalysisProgress`: update `analysisStates[findingId] = { status: 'analyzing', message, toolName }`
   - `aiAnalysisResult`: delete `analysisStates[findingId]` (analysis complete, data in FindingRow)
   - `aiAnalysisError`: set `analysisStates[findingId] = { status: 'error', message, errorType }`
4. Pass `analysisStates` to `FindingDetailView` via props.

### Phase D: FindingDetailView Analyze/Cancel UI (WebView)

**Goal**: Render the Analyze button, progress indicator, and cancel button.

**Files**:
- `webview/src/components/FindingDetailView.tsx` (MODIFY)
- `webview/src/components/AnalysisProgress.tsx` (NEW)

**Work**:
1. Create `AnalysisProgress` component: renders spinner + latest progress message + cancel button. Props: `{ findingId, state: AnalysisUIState, onCancel }`.
2. Update `FindingDetailView`:
   - Accept `analysisState?: AnalysisUIState` prop.
   - When no analysis and no active state: show "Analyze" button (outline variant per constitution).
   - When `analysisState.status === 'analyzing'`: show `AnalysisProgress` component.
   - When `analysisState.status === 'error'`: show error alert with guidance message + retry button.
   - When analysis exists and no active state: show `AiAnalysisPanel` + "Re-analyze" button.
3. Wire button clicks to `postMessage({ type: 'analyzeFinding', payload: { findingId } })` and `postMessage({ type: 'cancelAiAnalysis', payload: { findingId } })`.

### Phase E: AiAnalysisPanel Metadata Section (WebView)

**Goal**: Display model, cost, timestamp, and tools used in a collapsible section.

**Files**:
- `webview/src/components/AiAnalysisPanel.tsx` (MODIFY)

**Work**:
1. Extend props: `{ analysis: AiAnalysis | null, metadata?: AnalysisMetadata | null }`.
2. Add a collapsible "Analysis Details" accordion item at the end of the accordion:
   - **Model**: `metadata.modelId`
   - **Cost**: `$${metadata.costUsd.toFixed(4)}`
   - **Analyzed at**: formatted `metadata.analyzedAt` timestamp
   - **Tools used**: badge list of `metadata.toolsUsed`
3. Only render the section when `metadata` is non-null.
4. Default to collapsed (not in the `defaultValue` array of the Accordion).

### Phase F: Error Guidance Messages (WebView)

**Goal**: Map error types to actionable user-facing messages.

**Files**:
- `webview/src/components/FindingDetailView.tsx` or `AnalysisProgress.tsx` (same as Phase D)

**Work**:
1. Create an `ERROR_GUIDANCE` map: `Record<string, string>` mapping each error type to the guidance message (see contracts/messages.md).
2. Render the mapped message in the error state with an Alert component.
3. Include a "Retry" button that re-triggers `analyzeFinding`.

### Phase G: Kitchen Sink Demo (WebView)

**Goal**: Add analysis UI states to Kitchen Sink for visual verification.

**Files**:
- `webview/src/pages/sink/` — new demo entry

**Work**:
1. Add a sink demo showing: Analyze button, progress state with sample messages, error state with each error type, completed analysis with metadata.
2. Register in sink registry.

### Phase H: Tests

**Goal**: Verify the new code paths.

**Files**:
- `vsix/src/test/unit/mcpTools.test.ts` (NEW)
- `vsix/src/test/unit/mappers.test.ts` (MODIFY — add metadata extraction test)

**Work**:
1. Test `get_finding_context`: mock FindingsService, verify surrounding code extraction, handle missing files.
2. Test `list_related_findings`: mock Prisma, verify query scoped to same scan, verify max 25 limit.
3. Test `mapFindingToRow` extracts both analysis and metadata from StoredAiAnalysis JSON.
4. Test reducer state transitions for all AI message types.

## Dependency Order

```
Phase A (MCP Tools) ──→ Phase H (Tests)
Phase B (Metadata)  ──→ Phase E (Metadata UI)
Phase C (UI State)  ──→ Phase D (Analyze/Cancel UI) ──→ Phase F (Error Guidance)
                                                     ──→ Phase G (Kitchen Sink)
```

Phases A, B, and C have no interdependencies and can be implemented in parallel.
