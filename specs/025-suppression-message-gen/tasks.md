# Tasks: Generate Suppression Message

**Input**: Design documents from `/specs/025-suppression-message-gen/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Foundational (Typed Contracts & Shared Types)

**Purpose**: Define the message types and shared data types that all user stories depend on. No user story work can begin until these types are in place.

**CRITICAL**: Both vsix/ and webview/ type files MUST stay in sync.

- [x] T001 [P] Add `GenerationMode`, `StructuredJustification`, and `SuppressionMessageResult` types to `vsix/src/models/types.ts` per data-model.md type definitions
- [x] T002 [P] Add `generateSuppressionMessage`, `refineSuppressionMessage`, `suppressionMessageResult`, and `suppressionMessageError` message types to `vsix/src/models/messages.ts` per contracts/messages.md — add to both `ExtToWebviewMessage` and `WebviewToExtMessage` discriminated unions
- [x] T003 Mirror the types from T001 into `webview/src/types/types.ts` — must match vsix/ types exactly
- [x] T004 Mirror the message types from T002 into `webview/src/types/messages.ts` — must match vsix/ messages exactly

**Checkpoint**: All shared types and message contracts in place. Both packages compile with new types.

---

## Phase 2: User Story 1 — Generate Suppression Justification (Priority: P1) MVP

**Goal**: A user can click "Generate Message" in the suppression form, the system calls an AI service with finding context and selected scope, and the generated structured justification populates the justification field.

**Independent Test**: Open any finding detail view, open suppression form, select a scope, click "Generate Message," verify a structured justification (Finding, Risk Assessment, Rationale, Scope) appears in the justification textarea.

### Implementation for User Story 1

- [x] T005 [US1] Create `vsix/src/services/suppressionPromptBuilder.ts` — new pure-function module exporting `buildSuppressionPrompt(finding: FindingRow, scope: SuppressionScope, mode: 'generate')` that returns a system prompt string and the structured output JSON schema. Include scope-specific instructions per plan.md (file_rule, rule_everywhere, file_all_rules). Include finding context: title, description, severity, scanner, ruleId, filePath, startLine/endLine, codeSnippet, and userNotes when present (FR-002, FR-002a, FR-005). Export `assembleMessage(sections: StructuredJustification): string` that formats sections into labeled plain text (FR-010)
- [x] T006 [US1] Add `generateSuppressionMessage(findingId, scope, mode, existingMessage?)` method to `vsix/src/services/aiService.ts` — retrieve FindingRow via FindingsService, call buildSuppressionPrompt, invoke ClaudeAgentProvider with structured output schema (single-turn, no tools), parse response into StructuredJustification, assemble message string, return SuppressionMessageResult. Handle errors with existing categorizeError() taxonomy (FR-006)
- [x] T007 [US1] Add `generateSuppressionMessage` case to the message handler switch in `vsix/src/providers/findingsPanelManager.ts` — guard on `this.aiService`, call `aiService.generateSuppressionMessage()`, post `suppressionMessageResult` on success or `suppressionMessageError` on failure per contracts/messages.md flow diagram
- [x] T008 [US1] Add suppression message generation state and actions to `webview/src/App.tsx` — add `suppressionMessageGenerating: boolean` and `suppressionGeneratedMessage: string | null` to AppState initial state. Add reducer cases: `SUPPRESSION_MESSAGE_GENERATING`, `SUPPRESSION_MESSAGE_RECEIVED`, `SUPPRESSION_MESSAGE_ERROR`, `CLEAR_SUPPRESSION_MESSAGE`. Add message handlers for `suppressionMessageResult` and `suppressionMessageError` in the useEffect message listener. Clear generation state when suppression form closes (`CLOSE_SUPPRESSION_FORM`)
- [x] T009 [US1] Update `webview/src/components/FindingDetailView.tsx` — pass new props through to SuppressionForm: `isGenerating`, `generatedMessage`, `onGenerateMessage(scope, mode)`, `onClearGeneratedMessage()`. Wire to App.tsx state and dispatch
- [x] T010 [US1] Update `webview/src/components/SuppressionForm.tsx` — add "Generate Message" button (variant="outline") below justification textarea. Button sends `generateSuppressionMessage` postMessage with current findingId, selected scope, and mode='generate'. Disable button when `isGenerating` is true or when AI is not configured (check claudeSettings prop). Show loading spinner (Loader2 icon) during generation (FR-004). On `generatedMessage` prop change, set justification field value. Show error Alert on generation failure with guidance text and dismiss action (FR-006). Hide generate button when finding is already suppressed (FR-011). Show disabled state with tooltip when no AI service configured (FR-012)

**Checkpoint**: User Story 1 complete. User can generate a scope-aware suppression message for any finding. Messages follow structured format with labeled sections.

---

## Phase 3: User Story 2 — Regenerate or Refine Message (Priority: P2)

**Goal**: After generating a message, the user can regenerate for a fresh alternative, or edit the message and refine it to improve their edits while preserving intent.

**Independent Test**: Generate a message, click "Regenerate" and verify a different message appears. Edit the generated message, click "Refine" and verify the edited text is improved.

### Implementation for User Story 2

- [x] T011 [US2] Extend `buildSuppressionPrompt` in `vsix/src/services/suppressionPromptBuilder.ts` — add support for `mode: 'regenerate'` (appends instruction to provide different perspective) and `mode: 'refine'` (appends instruction to improve the user's existing text while preserving intent, includes `existingMessage` parameter in prompt). Per research.md Decision 4
- [x] T012 [US2] Add `refineSuppressionMessage` case to the message handler switch in `vsix/src/providers/findingsPanelManager.ts` — call `aiService.generateSuppressionMessage()` with mode='refine' and existingMessage from payload, post result or error. The AiService method from T006 already accepts mode and existingMessage parameters
- [x] T013 [US2] Update `webview/src/components/SuppressionForm.tsx` — add "Regenerate" button (shown only after first successful generation, sends mode='regenerate'). Add "Refine" button (shown only when user has edited a generated message — track `isEdited` local state by comparing justification field to last generatedMessage). Refine sends `refineSuppressionMessage` with current justification text. Both buttons share the same loading/error state as Generate (FR-007, FR-008)

**Checkpoint**: User Story 2 complete. Users can iterate on generated messages via Regenerate (fresh alternative) or Refine (improve edits).

---

## Phase 4: User Story 3 — AI Analysis Enrichment (Priority: P3)

**Goal**: When a finding has AI analysis data (risk assessment with exploitability, impact, likelihood), the prompt includes this context to produce a more compelling and detailed justification.

**Independent Test**: Generate a suppression message for a finding with AI analysis and verify it references risk factors (e.g., exploitability level) not present in the base finding data. Generate for a finding without AI analysis and verify it still works with base data only.

### Implementation for User Story 3

- [x] T014 [US3] Extend `buildSuppressionPrompt` in `vsix/src/services/suppressionPromptBuilder.ts` — when `finding.aiAnalysis` is non-null, append a "Prior AI Analysis" section to the prompt containing: exploitability level + rationale, impact level + rationale, likelihood level + rationale, and suggestedFix description if present (especially if the AI determined it's a false positive). When aiAnalysis is null, omit this section entirely — the prompt must still produce a valid message from base finding data alone (FR-009)

**Checkpoint**: User Story 3 complete. AI analysis data enriches suppression messages when available, producing stronger justifications.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Kitchen Sink demo (constitution requirement) and build verification

- [x] T015 Update Kitchen Sink suppression form demo in `webview/src/pages/sink/suppression-form-demo.tsx` — add demo states for: generate button idle, generating (loading spinner), generated message populated, regenerate/refine buttons visible, error state with guidance, disabled state (no AI configured). Exercise all button variants in both dark and light themes
- [x] T016 Verify full build: run `cd vsix && npm run pretest` (compile + lint) and `cd webview && npm run build` — fix any type errors or lint violations across all modified files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **User Story 1 (Phase 2)**: Depends on Phase 1 completion (needs typed messages/types)
- **User Story 2 (Phase 3)**: Depends on Phase 2 completion (extends US1's prompt builder and UI)
- **User Story 3 (Phase 4)**: Depends on Phase 2 completion (extends US1's prompt builder only). Can run in parallel with US2.
- **Polish (Phase 5)**: Depends on all user stories being complete

### Within Each Phase

- **Phase 1**: T001 and T002 are parallel (different files). T003 depends on T001. T004 depends on T002.
- **Phase 2 (US1)**: T005 first (prompt builder), then T006 (uses prompt builder), then T007 (uses AiService). T008 parallel with T005-T007 (different package). T009 depends on T008. T010 depends on T008 and T009.
- **Phase 3 (US2)**: T011 first (prompt modes), T012 parallel with T011 (different file). T013 after T011/T012.
- **Phase 4 (US3)**: T014 is standalone (modifies prompt builder only).
- **Phase 5**: T015 parallel with T016.

### Parallel Opportunities

```
Phase 1 (Foundational):
  ├── T001 (vsix types)    ──┐
  │                           ├── T003 (webview types, after T001)
  └── T002 (vsix messages) ──┘
                               └── T004 (webview messages, after T002)

Phase 2 (US1) - Extension Host and WebView can start in parallel:
  Extension Host:
    T005 → T006 → T007
  WebView (parallel with Extension Host):
    T008 → T009 → T010

Phase 3-4 (US2 and US3 can overlap):
  US2: T011 → T012, T013
  US3: T014 (independent, can run alongside US2)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational types
2. Complete Phase 2: User Story 1 — core generation
3. **STOP and VALIDATE**: Open finding detail → suppression form → Generate Message → verify structured justification appears
4. Demo-ready with single-generation capability

### Incremental Delivery

1. Phase 1 (types) → Phase 2 (US1: generate) → **Working MVP**
2. Add Phase 3 (US2: regenerate/refine) → **Improved iteration**
3. Add Phase 4 (US3: AI analysis enrichment) → **Full quality**
4. Phase 5 (polish) → **Production-ready**

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database changes — all generated data is transient
- Single new file: `suppressionPromptBuilder.ts`. All other changes are modifications
- Prompt builder is the only file modified across multiple user stories (T005, T011, T014) — each story adds a new capability to it
- Tests not included (not explicitly requested in spec). Add via `/speckit.tasks` with test flag if needed
