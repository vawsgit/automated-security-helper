# Quickstart: Generate Suppression Message

**Feature**: 025-suppression-message-gen
**Date**: 2026-03-23

## Prerequisites

- VS Code extension builds and runs (`cd vsix && npm run compile`)
- WebView builds (`cd webview && npm run build`)
- AI service configured (`ashWorkbench.llm.provider` set to `bedrock` or `anthropic-api`)

## Implementation Order

### Phase 1: Extension Host (vsix/)

1. **Add message types** — Update `vsix/src/models/messages.ts`:
   - Add `generateSuppressionMessage` and `refineSuppressionMessage` to `WebviewToExtMessage`
   - Add `suppressionMessageResult` and `suppressionMessageError` to `ExtToWebviewMessage`

2. **Add generation method to AiService** — Update `vsix/src/services/aiService.ts`:
   - New method `generateSuppressionMessage(findingId, scope, mode, existingMessage?)`
   - Assembles finding context from FindingsService
   - Builds scope-aware prompt
   - Calls ClaudeAgentProvider with structured output schema
   - Returns `SuppressionMessageResult`

3. **Add prompt builder** — New file `vsix/src/services/suppressionPromptBuilder.ts`:
   - Builds system prompt with finding context
   - Conditional sections per suppression scope
   - Handles generate/regenerate/refine modes
   - Includes AI analysis context when available

4. **Wire message handler** — Update `vsix/src/providers/findingsPanelManager.ts`:
   - Add cases for `generateSuppressionMessage` and `refineSuppressionMessage`
   - Call AiService, post result or error back

### Phase 2: WebView (webview/)

5. **Mirror message types** — Update `webview/src/types/messages.ts` (keep in sync with vsix)

6. **Add types** — Update `webview/src/types/types.ts`:
   - Add `GenerationMode`, `StructuredJustification` types

7. **Update App.tsx reducer** — Add state fields and action handlers:
   - `suppressionMessageGenerating: boolean`
   - `suppressionGeneratedMessage: string | null`
   - Handle `suppressionMessageResult` and `suppressionMessageError` messages

8. **Update SuppressionForm** — `webview/src/components/SuppressionForm.tsx`:
   - Add "Generate Message" button (disabled when no AI configured or already generating)
   - Add "Regenerate" button (shown after first generation)
   - Add "Refine" button (shown when user has edited generated text)
   - Loading spinner during generation
   - Error display on failure
   - Auto-populate justification field on result

9. **Update FindingDetailView** — Pass generation state/callbacks through to SuppressionForm

### Phase 3: Testing & Polish

10. **Unit tests** — `vsix/src/test/`:
    - Prompt builder: verify scope-aware prompt construction for all 3 scopes
    - AiService: verify generation method with mocked provider
    - Message handler: verify correct messages posted for success/error paths

11. **Kitchen Sink demo** — `webview/src/pages/sink/`:
    - Demo component showing generate/regenerate/refine states
    - All loading/error/success states

## Verification

```bash
# Build and lint
cd vsix && npm run pretest

# Run unit tests
cd vsix && npm test

# Build webview
cd webview && npm run build

# Manual test: open finding detail, click generate in suppression section
```

## Key Files to Modify

| File | Change |
|------|--------|
| `vsix/src/models/messages.ts` | New message types |
| `vsix/src/services/aiService.ts` | New generation method |
| `vsix/src/services/suppressionPromptBuilder.ts` | **New file** — prompt construction |
| `vsix/src/providers/findingsPanelManager.ts` | Message handler cases |
| `webview/src/types/messages.ts` | Mirror message types |
| `webview/src/types/types.ts` | New type definitions |
| `webview/src/App.tsx` | Reducer state + actions |
| `webview/src/components/SuppressionForm.tsx` | Generate/Regenerate/Refine UI |
| `webview/src/components/FindingDetailView.tsx` | Pass-through props |
