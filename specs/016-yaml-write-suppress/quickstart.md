# Quickstart: .ash.yaml Write & Suppress Action

**Feature**: Spec 016 — .ash.yaml Write & Suppress Action
**Date**: 2026-03-20

## Prerequisites

- Spec 013 (.ash.yaml read service) implemented — `AshYamlService`, `ashYamlCore.ts`
- Spec 015 (current findings view) implemented — `currentFindingsUpdate`, suppression overlay, `FindingRow.isCurrentlySuppressed`
- `js-yaml` already installed (`^4.1.1`) — provides `yaml.dump()` for serialization

## Implementation Order

### Layer 1: Types & Messages (foundation)

1. **Add `SuppressionScope`, `SuppressionInput`, `SuppressionResult` types** to:
   - `vsix/src/models/types.ts`
   - `webview/src/types/types.ts` (mirror)

2. **Add message variants** to discriminated unions:
   - `suppressFinding`, `unsuppressFinding` → `WebviewToExtMessage`
   - `suppressionResult` → `ExtToWebviewMessage`
   - In both `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`

### Layer 2: Write Service (core logic)

3. **Create `vsix/src/services/ashYamlWrite.ts`**:
   - `inputToSuppression()` — converts `SuppressionInput` → `AshSuppression`
   - `serializeSuppressionEntry()` — produces YAML text for appending
   - `generateSkeleton()` — creates new `.ash.yaml` file content
   - `findSuppressionIndex()` — locates entry in array for removal
   - `reserializeSuppressionsSection()` — rewrites suppressions after removal
   - `AshYamlWriteService` class with `addSuppression()` and `removeSuppression()`

4. **Key patterns**:
   - Append strategy for new entries (preserves comments per FR-009)
   - Full re-serialize for removal (js-yaml.dump — comments lost, acceptable tradeoff)
   - `vscode.workspace.fs` for file I/O
   - mtime-based conflict detection with single retry

### Layer 3: Extension Host Wiring

5. **Wire `AshYamlWriteService` in `extension.ts`**:
   - Instantiate after `AshYamlService`
   - Pass to `FindingsPanelManager` via setter
   - Update on scan root change

6. **Add message handlers in `FindingsPanelManager`**:
   - Handle `suppressFinding` → call `writeService.addSuppression()`, send `suppressionResult`
   - Handle `unsuppressFinding` → call `writeService.removeSuppression()`, send `suppressionResult`
   - No manual refresh needed — file watcher cascade handles it (Spec 013 → Spec 015)

### Layer 4: WebView State

7. **Extend `App.tsx` reducer**:
   - Add `suppressionFormFindingId` and `suppressionPending` to state
   - Add `OPEN_SUPPRESSION_FORM`, `CLOSE_SUPPRESSION_FORM` actions
   - Handle `suppressionResult` message — close form on success, show error on failure

### Layer 5: WebView Components

8. **Create `SuppressionForm.tsx`** (new component):
   - Scope selector (radio group: file+rule, rule everywhere, file all rules)
   - Justification textarea (pre-populated from notes per FR-017)
   - Line range toggle (hidden if no line numbers, defaults off per FR-018)
   - Expiration date picker (optional)
   - Live YAML preview (computed from form state using `generateYamlEntry()`)
   - "Add Suppression" button with validation

9. **Create `UnsuppressConfirmation.tsx`** (new component or inline):
   - Shows matching rule, file path
   - Warning when multiple findings affected
   - Confirm/cancel buttons

10. **Modify `FindingDetailView.tsx`**:
    - Add "Suppress" button when `!isCurrentlySuppressed` (FR-019)
    - Add "Unsuppress" button when `isCurrentlySuppressed`
    - Render `SuppressionForm` inline when suppression form is open
    - Style suppress/unsuppress buttons distinctly from triage controls (FR-016)

11. **Modify `FindingsView.tsx`** (optional, table actions):
    - Add suppress/unsuppress action to row actions if desired

### Layer 6: Testing

12. **Unit tests for `ashYamlWrite.ts`**:
    - `inputToSuppression()` for each scope variant
    - `serializeSuppressionEntry()` output correctness
    - `generateSkeleton()` produces valid YAML
    - `findSuppressionIndex()` matches correctly
    - `addSuppression()` — append to existing file, create new file
    - `removeSuppression()` — remove entry, handle not-found
    - Conflict detection (mtime mismatch)
    - Invalid YAML rejection

13. **Unit tests for reducer** (webview):
    - `suppressionResult` success → closes form
    - `suppressionResult` error → preserves form, shows error

## Key Files to Modify

| File | Changes |
|------|---------|
| `vsix/src/models/types.ts` | Add `SuppressionScope`, `SuppressionInput`, `SuppressionResult` |
| `vsix/src/models/messages.ts` | Add 3 message variants |
| `vsix/src/services/ashYamlWrite.ts` | **NEW** — write service |
| `vsix/src/providers/findingsPanelManager.ts` | Handle suppress/unsuppress messages |
| `vsix/src/extension.ts` | Wire write service |
| `webview/src/types/types.ts` | Mirror type additions |
| `webview/src/types/messages.ts` | Mirror message additions |
| `webview/src/App.tsx` | Reducer state + actions |
| `webview/src/components/SuppressionForm.tsx` | **NEW** — suppression form |
| `webview/src/components/FindingDetailView.tsx` | Suppress/unsuppress buttons + form |
| `webview/src/components/SuppressionPanel.tsx` | Add unsuppress button |
| `vsix/src/test/unit/ashYamlWrite.test.ts` | **NEW** — write service tests |

## ShadCN Components Needed

Check if these are already installed before adding:
- `RadioGroup` — scope selector
- `Label` — form labels
- `Switch` — line range toggle (already used in FindingsView)
- `Button`, `Textarea`, `Alert` — already installed
- `Input` — expiration date (type="date")
- `Dialog` — unsuppress confirmation (or use inline confirmation)
