# Implementation Plan: Generate Suppression Message

**Branch**: `025-suppression-message-gen` | **Date**: 2026-03-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-suppression-message-gen/spec.md`

## Summary

Add AI-powered suppression message generation to the finding detail view. When a user opens the suppression form, a "Generate Message" button calls the existing AI service to produce a structured justification (Finding, Risk Assessment, Rationale, Scope) tailored to the selected suppression scope. Supports regeneration and refinement of generated messages. Extends the existing `AiService` and `ClaudeAgentProvider` — no new services or infrastructure.

## Technical Context

**Language/Version**: TypeScript, ES2022, Node16 modules (strict mode)
**Primary Dependencies**: `@anthropic-ai/claude-agent-sdk` (existing), React 19, ShadCN/ui, Tailwind CSS v4
**Storage**: N/A — generated messages are transient (flow into existing `.ash.yaml` write path on submit)
**Testing**: Mocha (unit, Node.js) + `@vscode/test-electron` (integration)
**Target Platform**: VS Code extension (extension host + WebView)
**Project Type**: VS Code extension (monorepo: vsix/ + webview/)
**Performance Goals**: < 5 seconds for generation (SC-001)
**Constraints**: Requires configured AI service (ashWorkbench.llm.provider); no offline/local fallback
**Scale/Scope**: Single finding at a time; single user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | AI calls use user-configured LLM settings (ashWorkbench.llm.*). Constitution explicitly allows: "No network calls except what the user explicitly configures (e.g., future Bedrock LLM integration)." No new external dependencies. |
| II. Extension Host Owns State | PASS | All generation logic lives in vsix/src/services/. WebView sends request, receives result, displays in textarea. No business logic in React components. |
| III. Ship Fast / Simplicity First | PASS | Extends existing AiService — no new service classes, no new infrastructure. Single-turn LLM call (no multi-turn, no tool use). One new file (prompt builder); rest are modifications. |
| IV. Typed Contracts at Boundaries | PASS | New messages added to both discriminated unions (ExtToWebviewMessage, WebviewToExtMessage). Structured output uses JSON schema. Types synced across vsix/ and webview/. |
| V. Theme Integration | PASS | UI uses existing ShadCN Button, Textarea, Alert components. No custom styling. |
| VI. Security by Default | PASS | Generated text placed in textarea (not rendered as HTML). Finding data already sent to AI for existing analyzeFinding feature — no new data exposure. Sanitization not needed for textarea value. |

**Gate result**: PASS — no violations. No complexity tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/025-suppression-message-gen/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research decisions
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 implementation guide
├── contracts/
│   └── messages.md      # Phase 1 message contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
workbench/
  vsix/src/
  ├── models/
  │   ├── messages.ts          # MODIFY: Add 4 new message types
  │   └── types.ts             # MODIFY: Add GenerationMode, StructuredJustification
  ├── services/
  │   ├── aiService.ts         # MODIFY: Add generateSuppressionMessage method
  │   ├── suppressionPromptBuilder.ts  # NEW: Prompt construction for all modes/scopes
  │   └── aiProvider.ts        # No change (reuse existing types)
  ├── providers/
  │   └── findingsPanelManager.ts  # MODIFY: Add message handler cases
  └── test/
      ├── suppressionPromptBuilder.test.ts  # NEW: Prompt builder unit tests
      └── aiService.test.ts    # MODIFY: Add generation tests

  webview/src/
  ├── types/
  │   ├── messages.ts          # MODIFY: Mirror 4 new message types
  │   └── types.ts             # MODIFY: Add GenerationMode, StructuredJustification
  ├── components/
  │   ├── SuppressionForm.tsx  # MODIFY: Add generate/regenerate/refine UI
  │   └── FindingDetailView.tsx  # MODIFY: Pass generation state/callbacks
  ├── App.tsx                  # MODIFY: Reducer state + actions + message handlers
  └── pages/sink/
      └── suppression-form-demo.tsx  # MODIFY: Add generation demo states
```

**Structure Decision**: Follows existing monorepo layout. One new file (`suppressionPromptBuilder.ts`) isolates prompt construction logic. All other changes are modifications to existing files following established patterns.

## Detailed Design

### Extension Host: Prompt Builder (`suppressionPromptBuilder.ts`)

New pure-function module that constructs the system prompt for suppression message generation. Accepts finding context + scope + mode and returns the full prompt string.

**Scope-specific instructions**:
- `file_rule`: "Explain why rule {ruleId} is acceptable in {filePath} at lines {startLine}-{endLine}. Focus on file-specific context."
- `rule_everywhere`: "Explain why rule {ruleId} from {scanner} is globally inapplicable or acceptable across the entire codebase. Provide broad reasoning."
- `file_all_rules`: "Explain why all security findings in files matching {filePath} are acceptable. Common reasons include test files, generated code, or vendored dependencies."

**Mode-specific behavior**:
- `generate`: Standard generation prompt
- `regenerate`: Adds "Provide a different perspective and reasoning than previously generated messages"
- `refine`: Adds "The user has written the following justification. Improve its clarity, completeness, and professional tone while preserving their core reasoning: {existingMessage}"

**AI analysis enrichment** (when available):
- Appends risk assessment summary (exploitability, impact, likelihood with rationales)
- Appends suggested fix context (if AI determined it's a false positive, that's strong suppression evidence)

**Structured output schema**:
```json
{
  "type": "object",
  "properties": {
    "finding": { "type": "string", "description": "Brief identification of the finding (1-2 sentences)" },
    "riskAssessment": { "type": "string", "description": "Assessment of the actual risk in this context (2-3 sentences)" },
    "rationale": { "type": "string", "description": "Why suppression is the appropriate action (2-3 sentences)" },
    "scope": { "type": "string", "description": "What this suppression covers and boundary explanation (1-2 sentences)" }
  },
  "required": ["finding", "riskAssessment", "rationale", "scope"]
}
```

### Extension Host: AiService Extension

New method on `AiService`:

```typescript
async generateSuppressionMessage(
  findingId: string,
  scope: SuppressionScope,
  mode: GenerationMode,
  existingMessage?: string
): Promise<SuppressionMessageResult>
```

**Flow**:
1. Retrieve `FindingRow` from `FindingsService.getFindingDetail(findingId)`
2. Build prompt via `suppressionPromptBuilder`
3. Call `ClaudeAgentProvider` with structured output schema (single-turn, no tools)
4. Parse structured response into `StructuredJustification`
5. Assemble `message` string from sections
6. Return `SuppressionMessageResult`

**Error handling**: Catches all errors, categorizes via existing `categorizeError()`, throws typed `AiError`.

### Extension Host: Message Routing

New cases in `findingsPanelManager.handleMessage()`:

```typescript
case 'generateSuppressionMessage': {
  if (!this.aiService) break;
  try {
    const result = await this.aiService.generateSuppressionMessage(
      message.payload.findingId,
      message.payload.scope,
      message.payload.mode
    );
    this.postMessage({ type: 'suppressionMessageResult', payload: result });
  } catch (err) {
    this.postMessage({ type: 'suppressionMessageError', payload: {
      findingId: message.payload.findingId,
      errorType: (err as AiError).type ?? 'unknown',
      message: (err as AiError).message ?? 'Generation failed',
    }});
  }
  break;
}

case 'refineSuppressionMessage': {
  // Same pattern with mode='refine' and existingMessage
}
```

### WebView: SuppressionForm Enhancement

New UI elements added to `SuppressionForm.tsx`:

1. **Generate button** — Below the justification textarea. Disabled when:
   - `isGenerating` is true
   - No AI service configured (check via `claudeSettings` from App state)
   - Finding is already suppressed

2. **Regenerate button** — Shown after first generation, next to Generate
3. **Refine button** — Shown when user has edited a generated message
4. **Loading spinner** — Replaces buttons during generation
5. **Error alert** — Shown on failure with guidance text, dismiss action

**State flow**:
- User clicks Generate → dispatch `SUPPRESSION_MESSAGE_GENERATING` → postMessage `generateSuppressionMessage`
- Result received → reducer stores message → SuppressionForm reads from prop → sets justification field value
- User edits → local state tracks `isEdited` flag → shows Refine button instead of Generate

### WebView: App.tsx Reducer Changes

**New state fields**:
```typescript
suppressionMessageGenerating: boolean;    // false
suppressionGeneratedMessage: string | null;  // null
```

**New actions**:
```typescript
| { type: 'SUPPRESSION_MESSAGE_GENERATING' }
| { type: 'SUPPRESSION_MESSAGE_RECEIVED'; message: string }
| { type: 'SUPPRESSION_MESSAGE_ERROR'; errorType: string; errorMessage: string }
| { type: 'CLEAR_SUPPRESSION_MESSAGE' }
```

**Message handlers** (in the `useEffect` message listener):
```typescript
case 'suppressionMessageResult':
  dispatch({ type: 'SUPPRESSION_MESSAGE_RECEIVED', message: msg.payload.message });
  break;
case 'suppressionMessageError':
  dispatch({ type: 'SUPPRESSION_MESSAGE_ERROR', errorType: msg.payload.errorType, errorMessage: msg.payload.message });
  break;
```

### Post-Design Constitution Re-check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | No new external dependencies. Reuses existing LLM configuration. |
| II. Extension Host Owns State | PASS | Prompt construction + LLM call in vsix/. WebView only dispatches actions and displays text. |
| III. Ship Fast / Simplicity First | PASS | 1 new file, ~8 file modifications. Single-turn LLM call. No new abstractions. |
| IV. Typed Contracts | PASS | 4 new message types in both discriminated unions. Structured output schema validates response. |
| V. Theme Integration | PASS | ShadCN Button (variant="outline"), Textarea, Alert — all existing components. |
| VI. Security by Default | PASS | Generated text in textarea (not HTML). No new data exposure beyond existing AI analysis. |

## Complexity Tracking

> No violations to justify. All changes follow existing patterns.

| Area | Complexity | Justification |
|------|------------|---------------|
| New file: suppressionPromptBuilder.ts | Low | Pure functions, well-isolated. Testable without mocks. |
| AiService extension | Low | Single new method following existing pattern. |
| SuppressionForm UI changes | Medium | 3 action buttons + loading/error states. Most complex change but follows existing AI analysis panel patterns. |
