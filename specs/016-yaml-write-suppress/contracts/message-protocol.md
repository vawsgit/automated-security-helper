# Message Protocol Contract: .ash.yaml Write & Suppress

**Feature**: Spec 016 — .ash.yaml Write & Suppress Action
**Date**: 2026-03-20

## New Messages

### suppressFinding (WebView → Extension Host)

Request to write a new suppression entry to `.ash.yaml`.

```typescript
{
  type: 'suppressFinding';
  payload: {
    findingId: string;
    filePath: string;
    ruleId: string;
    scope: 'file_rule' | 'rule_everywhere' | 'file_all_rules';
    justification: string;
    includeLineRange: boolean;
    startLine: number | null;
    endLine: number | null;
    expiration: string | null;
  };
}
```

**Preconditions**: `justification` is non-empty (validated in webview before send).

**Extension host behavior**:
1. Validate input (non-empty justification, valid expiration if present)
2. Convert `SuppressionInput` → `AshSuppression` based on scope
3. Call `AshYamlWriteService.addSuppression()`
4. Send `suppressionResult` back to webview
5. File watcher auto-triggers `currentFindingsUpdate` (no manual refresh needed)

### unsuppressFinding (WebView → Extension Host)

Request to remove a suppression entry from `.ash.yaml`.

```typescript
{
  type: 'unsuppressFinding';
  payload: {
    findingId: string;
  };
}
```

**Extension host behavior**:
1. Look up the finding's matching suppression via `ashYamlService.matchesSuppression()`
2. If no match found (already removed externally), send success with informational message
3. Count how many other findings this suppression matches (for multi-finding awareness)
4. Call `AshYamlWriteService.removeSuppression()`
5. Send `suppressionResult` back to webview
6. File watcher auto-triggers `currentFindingsUpdate`

### suppressionResult (Extension Host → WebView)

Result of a suppress or unsuppress operation.

```typescript
{
  type: 'suppressionResult';
  payload: {
    success: boolean;
    findingId: string;
    action: 'suppress' | 'unsuppress';
    error?: string;
  };
}
```

**WebView behavior**:
- On success: Close suppression form (if open), show brief success feedback
- On error: Display error message in the form (if suppress) or via toast (if unsuppress)
- The actual UI state refresh (finding no longer/now suppressed) comes from the separate `currentFindingsUpdate` message triggered by the file watcher

## Interaction Flows

### Flow 1: Suppress a Finding

```
User clicks "Suppress" on non-suppressed finding
  → WebView opens SuppressionForm (inline in FindingDetailView)
  → User fills justification, selects scope, optionally toggles line range/expiration
  → YAML preview updates in real time (local state only)
  → User clicks "Add Suppression"
  → WebView validates justification is non-empty
  → WebView sends: suppressFinding { ...SuppressionInput }
  → Extension host:
      1. Converts input to AshSuppression
      2. Re-reads .ash.yaml (conflict check)
      3. Validates file is parseable
      4. Appends entry to file (or creates file)
      5. Sends: suppressionResult { success: true, findingId, action: 'suppress' }
  → File watcher detects change
  → AshYamlService reloads config, fires onDidChangeConfig
  → FindingsPanelManager.refreshCurrentFindings()
  → Extension host sends: currentFindingsUpdate { ...enriched findings }
  → WebView updates: finding now shows isCurrentlySuppressed = true
```

### Flow 2: Unsuppress a Finding

```
User clicks "Unsuppress" on suppressed finding
  → WebView shows confirmation (inline or dialog)
      Shows: matching rule, file path, warning if multi-finding match
  → User confirms
  → WebView sends: unsuppressFinding { findingId }
  → Extension host:
      1. Looks up matching suppression for finding
      2. Re-reads .ash.yaml (conflict check)
      3. Parses file, removes matching entry from suppressions array
      4. Re-serializes suppressions section, writes file
      5. Sends: suppressionResult { success: true, findingId, action: 'unsuppress' }
  → File watcher detects change
  → (same refresh cascade as suppress flow)
  → WebView updates: finding now shows isCurrentlySuppressed = false
```

### Flow 3: Invalid YAML File

```
User clicks "Add Suppression"
  → Extension host attempts to read and parse .ash.yaml
  → yaml.load() throws (invalid YAML)
  → Extension host sends: suppressionResult {
      success: false,
      findingId,
      action: 'suppress',
      error: '.ash.yaml contains invalid YAML at line 15: unexpected indent...'
    }
  → WebView shows error in form, form stays open for retry after user fixes file
```

### Flow 4: Conflict Detection

```
User opens suppression form (file mtime captured)
  → External tool modifies .ash.yaml
  → User clicks "Add Suppression"
  → Extension host detects mtime mismatch
  → Extension host re-reads file (retry once)
  → If retry succeeds: write proceeds normally
  → If retry also detects change: sends suppressionResult {
      success: false,
      error: '.ash.yaml was modified externally. Please try again.'
    }
```

## Existing Messages Leveraged (No Changes)

| Message | Direction | Role in This Feature |
|---------|-----------|---------------------|
| `currentFindingsUpdate` | ext → web | Auto-refreshes findings after .ash.yaml write (via file watcher) |
| `ashYamlChanged` | ext → web | Notifies webview of config change (informational) |
| `requestCurrentFindings` | web → ext | Manual refresh if needed |
