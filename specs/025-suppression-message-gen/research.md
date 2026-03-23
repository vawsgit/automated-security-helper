# Research: Generate Suppression Message

**Feature**: 025-suppression-message-gen
**Date**: 2026-03-23

## Decision 1: AI Service Architecture

**Decision**: Extend the existing `AiService` with a new `generateSuppressionMessage()` method rather than creating a separate service.

**Rationale**: The `AiService` already manages LLM lifecycle (configuration, provider instantiation, error categorization, cancellation). Suppression message generation is a simpler variant of finding analysis — it takes the same finding context but produces a shorter, structured text output instead of a full risk assessment. Reusing the service avoids duplicating configuration and provider management.

**Alternatives considered**:
- New `SuppressionMessageService` — rejected because it would duplicate AiService's configuration merging, provider instantiation, and error handling for no gain.
- Template-based generation without AI — rejected per spec clarification (external AI only).

## Decision 2: LLM Interaction Pattern

**Decision**: Use a single-turn LLM call with structured output (JSON schema) via the existing `ClaudeAgentProvider` pattern. No tool use needed — the finding context is already available in the extension host.

**Rationale**: Unlike finding analysis (which needs file reads and code context via MCP tools), suppression message generation has all required inputs already loaded in the `FindingRow`. A single-turn call with structured output is simpler, faster, and cheaper. The structured output schema enforces the required sections (Finding, Risk Assessment, Rationale, Scope).

**Alternatives considered**:
- Multi-turn with tool use (let AI read additional files) — rejected for P1; could be added later. Adds latency and cost for marginal quality improvement since the finding already has code snippet, description, and AI analysis.
- Streaming response — rejected because the full message is short (< 500 tokens) and streaming adds complexity without meaningful UX improvement.

## Decision 3: Structured Output Format

**Decision**: Define a JSON schema for the generated message with four labeled sections that get formatted into a single string.

**Rationale**: The spec requires a structured format with labeled sections (Finding, Risk Assessment, Rationale, Scope). Using structured output ensures consistent formatting across all generated messages and makes it easy to validate completeness. The final output is assembled into a plain-text string for the `.ash.yaml` `reason` field.

**Schema**:
```json
{
  "finding": "Brief identification of the finding",
  "riskAssessment": "Assessment of the actual risk in context",
  "rationale": "Why suppression is appropriate",
  "scope": "What this suppression covers and why"
}
```

**Output format** (assembled plain text):
```
Finding: <finding>
Risk Assessment: <riskAssessment>
Rationale: <rationale>
Scope: <scope>
```

## Decision 4: Regenerate vs. Refine Implementation

**Decision**: Both regenerate and refine use the same LLM endpoint with different prompt variations. Regenerate adds a "provide a different perspective" instruction. Refine includes the user's edited text with a "improve this while preserving intent" instruction.

**Rationale**: This keeps the implementation simple — one method with mode parameter — while producing meaningfully different results for each action.

## Decision 5: Scope-Aware Prompt Construction

**Decision**: Build the system prompt dynamically based on the selected suppression scope. Include scope-specific instructions that guide the AI toward appropriate reasoning.

**Rationale**: A "rule everywhere" suppression needs broad reasoning ("this rule is inapplicable to our tech stack") while a "file+rule" suppression needs specific reasoning ("this test file doesn't contain production code"). The prompt template includes conditional sections per scope type.

## Decision 6: Message Protocol Pattern

**Decision**: Follow the existing AI analysis message pattern: request → started → result/error. Skip progress events since generation is single-turn and fast.

**Rationale**: Consistent with existing patterns. No progress events needed because the call completes in one turn (unlike multi-turn analysis with tool use). The WebView shows a loading spinner between request and result/error.

**New messages**:
- WebView → Host: `generateSuppressionMessage`, `regenerateSuppressionMessage`, `refineSuppressionMessage`
- Host → WebView: `suppressionMessageResult`, `suppressionMessageError`
