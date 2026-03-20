# Research: .ash.yaml Write & Suppress Action

**Feature**: Spec 016 — .ash.yaml Write & Suppress Action
**Date**: 2026-03-20

## R1: YAML Write Strategy — Append vs Full Rewrite

**Decision**: Use targeted text append for new entries; use full re-parse + re-serialize via `js-yaml` only when removing entries.

**Rationale**: FR-009 requires preserving existing content, structure, and comments. `js-yaml.dump()` destroys comments and reformats whitespace. Appending raw YAML text to the `global_settings.suppressions` array preserves the file. Removal requires parsing (to find the entry) and re-serialization (to produce valid YAML without the entry), which necessarily loses comments — this is the accepted tradeoff for the less frequent unsuppress operation.

**Alternatives Considered**:
- **Full `yaml.dump()` for all operations**: Rejected — violates FR-009 (preserves content and comments).
- **Regex-based removal**: Rejected — brittle with multiline YAML entries, indentation variants, and edge cases around adjacent entries.
- **`yaml-cst` (concrete syntax tree) library**: Would preserve comments and formatting, but adds a new dependency for a low-frequency operation. Rejected per constitution principle III (Ship Fast / Simplicity First). Can revisit if comment preservation on removal becomes a user complaint.

## R2: File Creation Strategy (No Existing .ash.yaml)

**Decision**: Create `.ash.yaml` (the canonical filename) with a minimal skeleton structure containing only the `global_settings.suppressions` array and the new entry.

**Rationale**: FR-008 requires file creation with valid skeleton. Using `.ash.yaml` matches the most common convention (per ASH CLI docs). The skeleton includes only the structure needed for the entry, not a full template with all possible keys, to avoid confusion.

**Skeleton template**:
```yaml
global_settings:
  suppressions:
    - path: "{path}"
      rule_id: "{rule_id}"
      reason: "{reason}"
```

**Alternatives Considered**:
- **Full template with all keys**: Rejected — adds noise; users who need `scanners`, `ignore_paths`, etc. can add them manually.
- **JSON format**: Rejected — YAML is the primary format in the ASH ecosystem and is more human-readable for suppression entries.

## R3: Conflict Detection — Re-read Before Write

**Decision**: Re-read the file immediately before writing. Compare `fs.statSync().mtimeMs` against the mtime captured when the file was last read (when the suppression form was opened or the form was populated). If changed, re-parse, verify the entry still makes sense, and retry once. If the retry also detects a change, surface an error.

**Rationale**: FR-010 mandates re-reading before every write. The modification timestamp is the simplest reliable signal for external changes. One retry handles the common case (user saved the file in their editor while the form was open). Two consecutive conflicts suggest rapid external editing — better to stop and inform the user.

**Alternatives Considered**:
- **Content hash (SHA-256)**: More reliable than mtime but overkill for a single-developer tool. Mtime is sufficient.
- **VS Code `workspace.onDidSaveTextDocument`**: Only fires for files open in the editor, not for external tool changes. Not reliable enough.
- **No conflict detection**: Rejected — violates FR-010.

## R4: YAML Validation Before Write

**Decision**: Parse the file with `js-yaml.load()` before writing. If parsing fails, refuse the write and show an error message with the parse error details.

**Rationale**: FR-011 mandates refusing to write to files with invalid YAML. Re-using the existing `yaml.load()` call (from ashYamlCore.ts) for validation ensures consistency. The error message should include the line number from the YAML parse error to help the user fix the file.

**Alternatives Considered**:
- **Write anyway with a warning**: Rejected — violates FR-011 and risks corrupting the file further.
- **Auto-fix common YAML errors**: Rejected — too risky; could change user intent.

## R5: Suppression Entry Serialization

**Decision**: Use the existing `generateYamlEntry()` function from `mappers.ts` for both the preview and the actual text appended to the file. This guarantees FR-006 (SC-006: preview matches what is written).

**Rationale**: A single serialization function eliminates drift between preview and write. The function already handles all optional fields (rule_id, line_start, line_end, expiration).

**Enhancement needed**: The current `generateYamlEntry()` produces list-item YAML (`- path: "..."`) suitable for appending to the suppressions array. For the append strategy, the indentation must match the existing file's indentation level. The function should accept an indent parameter (default: 4 spaces for the standard `.ash.yaml` format).

## R6: Unsuppress — Entry Matching for Removal

**Decision**: Match entries for removal using all non-null fields of the AshSuppression that the finding was matched against. The matching suppression is already available on the `FindingRow.suppression` data (populated by the read service). Compare `path`, `reason`, `rule_id`, `line_start`, `line_end`, `expiration` field-by-field against each entry in the parsed suppressions array.

**Rationale**: This re-uses the existing AshSuppression model as the key. Since the read service already identified which suppression matches the finding, we have all the fields needed to locate it in the file for removal.

**Edge case — multiple findings matched by one entry**: FR-013 requires a confirmation dialog showing the matching rule and file path. The confirmation should also warn when the suppression matches multiple findings (per edge case spec). The `batchMatchSuppressions()` function can be called to count how many findings the entry matches.

## R7: Message Protocol Extensions

**Decision**: Add 3 new messages:

1. **`suppressFinding`** (webview → ext): `{ type: 'suppressFinding'; payload: SuppressionInput }` — Request to create a suppression entry.
2. **`unsuppressFinding`** (webview → ext): `{ type: 'unsuppressFinding'; payload: { findingId: string } }` — Request to remove a suppression entry.
3. **`suppressionResult`** (ext → webview): `{ type: 'suppressionResult'; payload: { success: boolean; error?: string; findingId: string } }` — Result of a suppress/unsuppress operation.

**Rationale**: Follows the established pattern — webview sends user actions via postMessage, extension host processes and sends results back. The result message enables the form to show success/error feedback. The existing `currentFindingsUpdate` message (from Spec 015) handles the automatic UI refresh after the file watcher picks up the change.

**No new ext→webview message needed for form population**: The suppression form can be populated entirely from existing `FindingRow` data already in the webview state (filePath, ruleId, startLine, endLine, notes).

## R8: Suppression Form Design — Webview vs VS Code Native

**Decision**: Implement the suppression form as a React component in the webview, rendered inline in the FindingDetailView (below triage controls).

**Rationale**: The form requires live YAML preview (FR-003) and interactive scope selection (FR-004), both of which need real-time UI updates. VS Code native input boxes (`showInputBox`, `showQuickPick`) are too limited for this — they don't support live preview, multiple fields, or custom layout. The webview is the right place per constitution principle II (Extension Host Owns State — but WebView handles local UI concerns like form state).

**Form state is local to the webview**: Scope selection, justification text, line range toggle, and expiration date are UI-local state managed by `useState` in the form component. On submit, the form sends a `suppressFinding` message to the extension host.

**Alternatives Considered**:
- **VS Code QuickPick wizard (multi-step)**: Rejected — no live preview, awkward for multi-field forms.
- **Separate webview panel for suppression form**: Rejected — adds complexity; inline form in the detail view is simpler and keeps context.

## R9: File Write Implementation — Node.js fs vs VS Code API

**Decision**: Use `vscode.workspace.fs` for file writes (not Node.js `fs`).

**Rationale**: `vscode.workspace.fs` integrates with VS Code's file system providers, handles encoding correctly, and is the recommended approach for extensions. The existing `ashYamlCore.ts` uses Node.js `fs.readFileSync` for reading — the write service can use `vscode.workspace.fs.writeFile` for writing without changing the read path. The write operation should use `vscode.workspace.fs.stat()` for mtime-based conflict detection.

**Alternatives Considered**:
- **Node.js `fs.writeFileSync`**: Works but bypasses VS Code's file system abstraction. Could cause issues with virtual file systems.
- **`vscode.workspace.applyEdit`**: Too heavyweight — designed for text document edits, not raw file writes. Would require opening the document first.
