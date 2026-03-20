# Message Protocol Contract: Suppression Management View

**Branch**: `017-suppression-manager` | **Date**: 2026-03-20

## New Messages: WebView → Extension Host

### `requestSuppressions`

Request the full suppression list with computed statuses.

```typescript
{ type: 'requestSuppressions' }
```

**Trigger**: Sent when navigating to the Suppression Manager view. Also sent after the webview receives `ashYamlChanged` while on the management view (to refresh statuses that depend on latest scan).

**Handler**: `FindingsPanelManager.handleMessage()` — calls `AshYamlService.getSuppressionStatuses(currentFindings)`, then posts `suppressionsUpdate` back.

---

### `editSuppression`

Update an existing suppression rule in `.ash.yaml`.

```typescript
{
  type: 'editSuppression';
  payload: {
    old: AshSuppression;
    updated: AshSuppression;
  }
}
```

**Trigger**: User saves the edit form in the Suppression Manager.

**Handler**: Calls `AshYamlWriteService.updateSuppression(old, updated)`. Posts `suppressionWriteResult` back. On success, the file watcher fires `ashYamlChanged`, which triggers a re-fetch of findings and suppression statuses.

---

### `removeSuppression`

Remove a suppression rule directly from `.ash.yaml` (management view flow).

```typescript
{
  type: 'removeSuppression';
  payload: {
    suppression: AshSuppression;
  }
}
```

**Note**: This is distinct from the existing `unsuppressFinding` message (finding-driven flow). `unsuppressFinding` takes `{ findingId: string }` and reverse-lookups the matching rule. `removeSuppression` takes the rule directly.

**Trigger**: User confirms removal in the Suppression Manager.

**Handler**: Calls `AshYamlWriteService.removeSuppressionRule(suppression)`. Posts `suppressionWriteResult` back.

---

### `addSuppression`

Add a new suppression rule from the management view (freeform entry).

```typescript
{
  type: 'addSuppression';
  payload: {
    suppression: AshSuppression;
  }
}
```

**Note**: Distinct from `suppressFinding` (finding-driven flow with `SuppressionInput`). This sends a raw `AshSuppression` directly — no scope presets, no findingId.

**Trigger**: User saves the add form in the Suppression Manager.

**Handler**: Converts `AshSuppression` to internal format and calls `AshYamlWriteService.addSuppression()` (may need a new overload that accepts `AshSuppression` directly, or construct a `SuppressionInput` with the raw fields). Posts `suppressionWriteResult` back.

---

## New Messages: Extension Host → WebView

### `suppressionsUpdate`

Full suppression management state pushed to the webview.

```typescript
{
  type: 'suppressionsUpdate';
  payload: {
    suppressions: SuppressionEntry[];
    ignorePaths: AshIgnorePath[];
    configInfo: AshYamlConfigSummary;
  }
}
```

**Trigger**: In response to `requestSuppressions`. Also sent reactively when `.ash.yaml` changes (via file watcher) while the management view is active.

**Payload details**:
- `suppressions`: All rules from `.ash.yaml`, each enriched with `status`, `matchCount`, and `matchedFindings[]`
- `ignorePaths`: All entries from `global_settings.ignore_paths`
- `configInfo`: Existing `AshYamlConfigSummary` (project name, severity threshold, scanners, fail_on_findings)

---

### `suppressionWriteResult`

Result of a management view write operation (add, edit, remove).

```typescript
{
  type: 'suppressionWriteResult';
  payload: {
    success: boolean;
    error?: string;
  }
}
```

**Trigger**: After processing `addSuppression`, `editSuppression`, or `removeSuppression`.

**WebView handling**: On success, close form/dialog. On failure, display error message inline. The actual data refresh comes separately via `suppressionsUpdate` (triggered by file watcher).

---

## Existing Messages (unchanged, for reference)

| Message | Direction | Purpose |
|---------|-----------|---------|
| `suppressFinding` | W→E | Finding-driven suppress (Spec 016) |
| `unsuppressFinding` | W→E | Finding-driven unsuppress (Spec 016) |
| `suppressionResult` | E→W | Result of finding-driven operation (Spec 016) |
| `ashYamlChanged` | E→W | Config change notification (Spec 015) |
| `currentFindingsUpdate` | E→W | Findings with suppression overlay (Spec 015) |

## Command Registration

New VS Code command in `vsix/package.json`:

```json
{
  "command": "ashWorkbench.manageSuppressions",
  "title": "ASH: Manage Suppressions"
}
```

Handler in `extension.ts`: Calls `findingsPanelManager.showSuppressionManager()`, which ensures the panel exists and sends `requestSuppressions` to populate it.
