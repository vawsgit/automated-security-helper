# Implementation Plan: AI Provider Abstraction and Claude Agent SDK Integration

**Branch**: `018-ai-provider-sdk` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-ai-provider-sdk/spec.md`

## Summary

Add AI-powered security finding analysis to ASH Workbench using the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). The implementation introduces three service-layer components: an `AiProvider` interface abstracting the AI backend, a `ClaudeAgentProvider` implementation wrapping the SDK's `query()` function, and an `AiService` orchestration layer managing concurrency (max 5 parallel), persistence, cancellation, and error handling. The AI agent autonomously navigates the codebase (reading files, searching patterns) to produce structured analysis results (explanation, risk assessment, suggested fix, references) validated via JSON Schema.

## Technical Context

**Language/Version**: TypeScript, ES2022 target, Node16 modules, strict mode
**Primary Dependencies**: `@anthropic-ai/claude-agent-sdk` (new), `zod` (for MCP tool schemas), existing Prisma/PGLite stack
**Storage**: PGLite (WASM PostgreSQL) + Prisma ORM — add `aiAnalysis Json?` column to Finding model
**Testing**: Mocha (unit, Node.js) + `@vscode/test-electron` (integration), sinon for mocking
**Target Platform**: VS Code extension host (Node.js), VS Code engine `^1.110.0`
**Project Type**: VS Code extension (monorepo: vsix/ + webview/)
**Performance Goals**: Connection test `<` 10s, analysis `<` 60s, first progress `<` 5s, cancel `<` 5s, cached load `<` 1s
**Constraints**: Max 5 concurrent analyses, lazy provider init, configurable budget cap per analysis
**Scale/Scope**: Single finding analysis (batch is separate spec), typical scan has 10-200 findings

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | ✅ PASS | SDK is npm dependency (in-process). Subprocess spawning matches ASH CLI pattern. Network calls to Bedrock explicitly carved out by constitution: "No network calls except what the user explicitly configures (e.g., future Bedrock LLM integration)." |
| II. Extension Host Owns State | ✅ PASS | All AI logic in `vsix/src/services/`. WebView sends actions (`analyzeFinding`, `cancelAiAnalysis`), receives state (`aiAnalysisResult`, `aiAnalysisProgress`). No business logic in WebView. |
| III. Ship Fast / Simplicity First | ⚠️ JUSTIFIED VIOLATION | `AiProvider` interface is an abstraction with one implementation. Constitution says "No abstractions for hypothetical future requirements." See Complexity Tracking below. |
| IV. Typed Contracts at Boundaries | ✅ PASS | New AI message types added to `ExtToWebviewMessage` / `WebviewToExtMessage` discriminated unions. Types synced between vsix and webview. |
| V. Theme Integration | ✅ N/A | No new UI components in this spec. Existing `AiAnalysisPanel` is unchanged. |
| VI. Security by Default | ✅ PASS | Default tool mode is read-only. Safety hooks deferred to separate spec (018 focuses on service layer). SDK subprocess is local. Network calls are user-configured. |

### Post-Design Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | ✅ PASS | No changes from pre-research. `aiAnalysis` stored in PGLite via Prisma (in-process). |
| II. Extension Host Owns State | ✅ PASS | `AiService` owns analysis lifecycle. WebView only triggers and displays. |
| III. Ship Fast / Simplicity First | ⚠️ JUSTIFIED VIOLATION | Same as above. Interface is 3 methods — minimal cost. |
| IV. Typed Contracts at Boundaries | ✅ PASS | Contracts defined: `AiProvider` interface, `AnalysisEvent` union, message protocol extensions. |
| V. Theme Integration | ✅ N/A | No UI changes. |
| VI. Security by Default | ✅ PASS | `permissionMode: "dontAsk"` with explicit `allowedTools` whitelist. Default read-only. |

## Project Structure

### Documentation (this feature)

```text
specs/018-ai-provider-sdk/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: schema changes
├── quickstart.md        # Phase 1: developer getting started
├── contracts/
│   ├── ai-provider-interface.md  # AiProvider interface contract
│   └── messages.md               # Message protocol additions
├── checklists/
│   └── requirements.md           # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
workbench/vsix/
├── src/
│   ├── services/
│   │   ├── aiProvider.ts            # NEW: AiProvider interface + AnalysisEvent types
│   │   ├── aiService.ts             # NEW: Orchestration (concurrency, persistence, errors)
│   │   └── claudeAgentProvider.ts   # NEW: Claude Agent SDK implementation
│   ├── models/
│   │   ├── types.ts                 # UPDATE: Add StoredAiAnalysis, AnalysisMetadata
│   │   ├── messages.ts              # UPDATE: Add AI message types to unions
│   │   └── mappers.ts              # UPDATE: Read aiAnalysis from Prisma, map to FindingRow
│   ├── providers/
│   │   └── FindingsPanelManager.ts  # UPDATE: Handle analyzeFinding, cancelAiAnalysis messages
│   └── extension.ts                # UPDATE: Create AiService, inject into providers
├── prisma/
│   ├── schema.prisma               # UPDATE: Add aiAnalysis Json? to Finding
│   └── migrations/
│       └── NNNN_add_ai_analysis/   # NEW: Migration for aiAnalysis column
├── package.json                     # UPDATE: Add SDK dependency, update LLM settings
└── src/test/
    └── services/
        ├── aiService.test.ts        # NEW: Unit tests
        └── claudeAgentProvider.test.ts  # NEW: Unit tests (mocked SDK)

workbench/webview/
├── src/
│   └── types/
│       ├── types.ts                 # UPDATE: Sync StoredAiAnalysis, AnalysisMetadata
│       └── messages.ts              # UPDATE: Sync AI message types
└── (no component changes — AiAnalysisPanel already exists)
```

**Structure Decision**: Follows existing monorepo layout. New files are 3 service modules in `vsix/src/services/`. All other changes are updates to existing files. No new directories except the Prisma migration.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `AiProvider` interface (1 implementation) | Research identifies Claude-only lock-in as HIGH risk. The interface (3 methods) is the minimum insurance against a full AiService rewrite if providers change. | Direct SDK calls in AiService — rejected because swapping providers would require rewriting the entire orchestration layer, including concurrency management, persistence, and error handling. |

## Phase 0 Artifacts

- [research.md](./research.md) — 9 decisions documented: SDK integration pattern, concurrency model, authentication inheritance, structured output, persistence, provider abstraction scope, tool access, error categorization, re-analysis behavior.

## Phase 1 Artifacts

- [data-model.md](./data-model.md) — Single `aiAnalysis Json?` column on Finding, StoredAiAnalysis wrapper structure, state transitions, migration plan.
- [contracts/ai-provider-interface.md](./contracts/ai-provider-interface.md) — `AiProvider` interface with `analyzeFinding()`, `testConnection()`, `getCapabilities()`. Event types, error taxonomy, contract rules.
- [contracts/messages.md](./contracts/messages.md) — 5 new ExtToWebview messages, 3 new WebviewToExt messages, flow diagrams, contract rules.
- [quickstart.md](./quickstart.md) — Developer getting started guide, key files, architecture overview, testing strategy.
