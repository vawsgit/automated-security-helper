---
title: findings-recommended-specs
---

# Recommended Specs: Unified Findings & Suppression

Ordered list of feature specifications to be implemented via `speckit.specify`. Each entry is a self-contained input description. Execute in order — later specs depend on earlier ones.

**Source:** [findings-research.md](./findings-research.md)

---

## Spec 1: Scan Root Setting

**Depends on:** Nothing (foundation spec)

**Motivation:** The current implementation uses the first VS Code workspace folder as the implicit project root (`project.ts:13-14`), and allows scans against arbitrary target paths via `ScanTargetPicker`. This creates unnecessary multi-target complexity throughout the data model, dashboard, and findings views. Every downstream feature (suppression overlay, current findings, `.ash.yaml` integration) becomes simpler when the application is scoped to a single root directory.

**Feature description for `speckit.specify`:**

```
Feature: Scan Root Setting (ashWorkbench.scanRoot)

Add an ashWorkbench.scanRoot VS Code setting that scopes the entire ASH Workbench
to a single root directory. This setting becomes the anchor point for scans,
findings display, .ash.yaml resolution, and all dashboard operations.

SETTING DEFINITION:
- Name: ashWorkbench.scanRoot
- Type: string
- Default: "" (empty string means "use the first workspace folder", which is the
  current implicit behavior — this avoids ${workspaceFolder} variable substitution
  issues and keeps the zero-config experience)
- Scope: resource (supports multi-root workspace .code-workspace overrides)
- Description: "Root directory for ASH scans and findings. Leave empty to use the
  workspace root."
- Register in vsix/package.json contributes.configuration alongside existing settings

RESOLUTION LOGIC:
- Create a getEffectiveScanRoot() utility in a new vsix/src/services/scanRoot.ts
- If setting is non-empty, use that absolute path directly
- If setting is empty (default), resolve to the first workspace folder's fsPath
  (same as current behavior in project.ts:13-14)
- Validate the resolved path exists and is a directory; if not, show a warning
  notification and fall back to workspace folder

REAL-TIME CHANGE HANDLING:
- Register a vscode.workspace.onDidChangeConfiguration listener in extension.ts
- When ashWorkbench.scanRoot changes:
  1. Re-resolve the effective scan root
  2. Notify all services (FindingsService, ScannerService, future AshYamlService)
     of the new root
  3. Re-query and push a full stateUpdate to all active WebView panels (sidebar
     and editor panel) so the UI refreshes immediately
  4. The ScanTreeProvider should also refresh to filter its tree items
- The change listener fires for user settings, folder settings, and workspace
  settings changes per VS Code convention

SCAN INITIATION CHANGES:
- When the user triggers a scan (via command or sidebar "Run Scan" button), default
  the targetPath to the effective scan root instead of requiring the ScanTargetPicker
- The ScanTargetPicker dialog can still be offered as an "advanced" option or when
  the user explicitly invokes "Scan Folder..." from the explorer context menu
- The ScanTarget upsert in scanner.ts:112-125 continues to work — it just defaults
  to the scan root path

DATA FILTERING:
- FindingsService methods (getScanSummaries, getScanTargets, getSummary, getFindings)
  should filter results to only include scans/findings whose ScanTarget.path matches
  or is a subdirectory of the effective scan root
- Historical data from other roots is NOT deleted — it's hidden. If the user switches
  scanRoot back, that data reappears
- The ScanTreeProvider should filter its tree to only show scans matching the
  current scan root

NON-GOALS:
- This spec does NOT add .ash.yaml reading (that's Spec 2)
- This spec does NOT change the Prisma schema or database structure
- This spec does NOT remove the ScanTarget model — it just ensures one "active"
  target context at a time
- No migration needed — existing data continues to work, just filtered differently

AFFECTED FILES:
- vsix/package.json (new setting definition)
- vsix/src/services/scanRoot.ts (new — resolution + change listener logic)
- vsix/src/extension.ts (wire up change listener, pass scan root to services)
- vsix/src/services/findings.ts (add scan root filtering to queries)
- vsix/src/services/scanner.ts (default targetPath to scan root)
- vsix/src/providers/findingsPanelManager.ts (handle root change → stateUpdate)
- vsix/src/providers/sidebarWebviewProvider.ts (handle root change → stateUpdate)
- vsix/src/providers/scanTreeProvider.ts (filter tree by scan root)
- webview/src/components/ScanTargetPicker.tsx (simplify — scan root is pre-selected)
```

---

## Spec 2: `.ash.yaml` Read Service & Suppression Matching

**Depends on:** Spec 1 (needs `scanRoot` to know where to find `.ash.yaml`)

**Motivation:** The ASH CLI uses `.ash.yaml` as the configuration file for suppressions, ignore paths, severity thresholds, and scanner settings. The `global_settings.suppressions` array is the single source of truth for which findings should be suppressed. Today, the workbench has zero awareness of this file — dispositions are purely in-app DB state disconnected from the CLI's suppression system. This spec bridges that gap by reading and parsing `.ash.yaml` and providing a suppression matching function that replicates the CLI's behavior.

**Feature description for `speckit.specify`:**

```
Feature: .ash.yaml Read Service & Suppression Matching

Introduce an AshYamlService in the extension host that reads the .ash.yaml
configuration file from the scan root, parses all relevant sections, and provides
a suppression matching function identical to the ASH CLI's behavior. This service
is the foundation for making .ash.yaml the single source of truth for suppression
state in the workbench.

ASH YAML FILE DISCOVERY:
- Search for configuration files in this order, relative to the effective scan root
  (from Spec 1):
  1. .ash.yml, .ash.yaml, .ash.json in the root directory
  2. .ash.yml, .ash.yaml, .ash.json in the .ash/ subdirectory
  (These filenames are defined in ASH CLI core/constants.py:26-31)
- Use the first file found. If none found, the service returns empty/default state
  (no suppressions, no ignore paths) — this is not an error
- Support both YAML and JSON formats (use js-yaml for YAML parsing)

PARSED CONFIGURATION STATE:
The service should parse and expose these elements from .ash.yaml:

1. global_settings.suppressions — Array of suppression rules. Each entry has:
   - path (required): string — file path or glob pattern
   - reason (required): string — justification text
   - rule_id (optional): string — scanner rule ID, supports glob patterns
   - line_start (optional): number — start line
   - line_end (optional): number — end line (>= line_start)
   - expiration (optional): string — YYYY-MM-DD date
   Model this as an AshSuppression interface in vsix/src/models/types.ts

2. global_settings.ignore_paths — Array of ignored path entries. Each has:
   - path (required): string — path or glob pattern
   - reason (required): string — reason for exclusion
   - expiration (optional): string — YYYY-MM-DD date
   Model as AshIgnorePath interface

3. global_settings.severity_threshold — string enum:
   ALL | LOW | MEDIUM | HIGH | CRITICAL (default: MEDIUM)

4. project_name — string (default: "ash-scan")

5. scanners — For each scanner entry, capture:
   - name (the key)
   - enabled (boolean)
   This is informational — the workbench doesn't configure scanners, but knowing
   which are enabled helps the user understand scan results

6. fail_on_findings — boolean (default: true)

Create an AshYamlConfig interface that holds all of these parsed fields.

SUPPRESSION MATCHING:
Implement a matchesSuppression(finding) function that replicates ASH CLI's
suppression_matcher.py logic exactly:

1. Rule ID matching: Use fnmatch-style glob matching (e.g., rule_id "B*" matches
   finding ruleId "B605"). Use the picomatch npm package for glob matching. If
   suppression.rule_id is null/undefined, it matches all rule IDs.

2. File path matching: Use fnmatch-style glob matching (e.g., path "src/**/*.py"
   matches finding file "src/app/main.py"). Match against the finding's relative
   file path (already relative in the DB from sarif.ts normalizeFilePath).

3. Line range overlap: If suppression has line_start/line_end, check that the
   finding's line range overlaps. Overlap means:
   finding.startLine <= suppression.line_end AND
   finding.endLine >= suppression.line_start
   If the suppression has no line range, it matches regardless of lines.

4. Expiration check: If suppression has an expiration date, parse it as YYYY-MM-DD
   and check if it's in the future (not expired). Expired suppressions are skipped
   (they don't match anything).

A finding is suppressed if ANY suppression rule matches it (OR logic across rules).

The function should return:
- null if no suppression matches
- The matching AshSuppression object if one matches (first match wins)

Also provide a getMatchingSuppressions(findings: FindingRow[]) batch function that
returns a Map<findingId, AshSuppression> for efficiency.

FILE SYSTEM WATCHER:
- Use vscode.workspace.createFileSystemWatcher to watch for changes to .ash.yaml
  and .ash.yml files in the scan root and .ash/ subdirectory
- On file create/change/delete: re-read and re-parse the config
- Debounce rapid changes (200ms) to avoid thrashing during save operations
- After re-parse, emit an event (use vscode.EventEmitter) that other services
  can subscribe to for triggering re-computation of suppression overlays

SCAN ROOT INTEGRATION:
- When the scan root changes (from Spec 1), dispose the old file watcher and
  create a new one for the new root
- Re-read .ash.yaml from the new root immediately

SERVICE LIFECYCLE:
- Create in extension.ts after scan root resolution
- Pass to FindingsService, FindingsPanelManager, SidebarWebviewProvider
- Dispose file watchers on extension deactivation

ENVIRONMENT VARIABLE INTERPOLATION:
- The ASH CLI supports ${VAR_NAME} and ${VAR_NAME:default} syntax in .ash.yaml
  values (ash_config.py:519-558)
- For the initial implementation, do NOT implement env var interpolation — parse
  values as literal strings. This is acceptable because the workbench only reads
  suppressions and ignore_paths where env vars are uncommon. Note this as a known
  limitation.

NPM DEPENDENCIES:
- js-yaml (YAML parsing) — add to vsix/package.json dependencies
- picomatch (glob matching) — add to vsix/package.json dependencies

AFFECTED FILES:
- vsix/src/services/ashYaml.ts (new — core service)
- vsix/src/models/types.ts (new interfaces: AshSuppression, AshIgnorePath,
  AshYamlConfig)
- webview/src/types/types.ts (mirror new interfaces)
- vsix/src/extension.ts (create and wire AshYamlService)
- vsix/package.json (new dependencies: js-yaml, picomatch)

NON-GOALS:
- This spec does NOT write to .ash.yaml (that's Spec 4)
- This spec does NOT change the WebView UI (that's Spec 3)
- This spec does NOT modify FindingRow or disposition logic yet (that's Spec 3)
- Scanner configuration is read-only / informational — the workbench does not
  configure scanners via .ash.yaml
```

---

## Spec 3: Unified Current Findings View

**Depends on:** Spec 1 (scan root), Spec 2 (`.ash.yaml` read + suppression matching)

**Motivation:** Today, the user must select a specific scan to see findings. There is no concept of "current findings" — the merged, up-to-date view of what's actually wrong in the codebase right now. The user's mental model is: "show me my current findings — the ones from my latest scan, minus the ones I've already suppressed." This spec delivers that experience by computing current findings from the latest scan + `.ash.yaml` suppression overlay, and making it the default view.

**Feature description for `speckit.specify`:**

```
Feature: Unified Current Findings View

Introduce a "Current Findings" concept that becomes the primary view in the ASH
Workbench. Current findings = the latest completed scan's findings with .ash.yaml
suppression status overlaid. This replaces the scan-selection-required workflow with
a "here's what matters right now" experience.

CURRENT FINDINGS COMPUTATION:
- "Current findings" is a computed view, NOT a new database table
- Logic: take findings from the latest COMPLETED scan for the effective scan root,
  then for each finding, check if it matches any .ash.yaml suppression rule using
  AshYamlService.matchesSuppression(finding)
- Add a getCurrentFindings() method to FindingsService that:
  1. Finds the latest completed Scan where ScanTarget.path matches the scan root
  2. Fetches all Finding rows for that scan
  3. For each finding, calls AshYamlService to get suppression match status
  4. Returns FindingRow[] with suppression data populated

TYPE CHANGES:
Update FindingRow in vsix/src/models/types.ts and webview/src/types/types.ts:

- The existing suppression: SuppressionData | null field gets populated:
  - justification: from the matched .ash.yaml suppression's reason field
  - yamlEntry: generated YAML representation of the matching suppression rule
  - expiresAt: from the matched suppression's expiration field (or null)
  - createdAt: set to null or omitted (we don't know when the rule was created)

- Add new field: isCurrentlySuppressed: boolean
  - true if any .ash.yaml suppression matches this finding
  - false otherwise
  - This is the quick-check flag for UI rendering

- Add new field: suppressionSource: 'ash_yaml' | null
  - 'ash_yaml' when suppression comes from .ash.yaml matching
  - null when no suppression applies
  - (Future specs may add 'sarif' as a source, but not in this spec)

Update mapFindingToRow in vsix/src/models/mappers.ts:
- Accept an optional AshSuppression parameter
- When provided, populate the suppression, isCurrentlySuppressed, and
  suppressionSource fields accordingly
- When not provided (historical path, no .ash.yaml service), keep current
  behavior (suppression: null, isCurrentlySuppressed: false)

DISPOSITION MODEL CHANGES:
- The SUPPRESS disposition value remains in the Prisma enum and the TypeScript
  type — no schema migration needed
- However, the semantics change: a finding's "suppressed" status is now DERIVED
  from .ash.yaml matching, not from the DB disposition column
- When the user clicks "Suppress" in the UI, the behavior will change in Spec 4
  (write to .ash.yaml). For THIS spec, the Suppress button should be disabled
  with a tooltip: "Suppression is managed via .ash.yaml" — the full write flow
  comes in Spec 4
- FIX, DEFER, and PENDING dispositions continue to work as in-app DB state —
  they are independent of suppression status
- A finding CAN be both suppressed (via .ash.yaml) AND have a FIX/DEFER
  disposition — the suppression overlay is additive information

MESSAGE PROTOCOL CHANGES:
Update ExtToWebviewMessage in vsix/src/models/messages.ts and
webview/src/types/messages.ts:

- Add new message type: currentFindingsUpdate
  payload: { findings: FindingRow[], suppressionSummary: SuppressionSummary }

- Add SuppressionSummary type:
  { total: number, suppressed: number, active: number }
  (active = total - suppressed = findings that need attention)

- The existing findingsUpdate message continues to work for scan-specific views

- Add new message type: ashYamlChanged
  payload: { config: AshYamlConfigSummary }
  (Sent when .ash.yaml file changes — triggers UI refresh of suppression state)

- Add AshYamlConfigSummary type:
  { suppressionCount: number, ignorePathCount: number,
    severityThreshold: string, projectName: string | null,
    enabledScanners: string[] }

DEFAULT VIEW CHANGES:
- When the sidebar dashboard loads (SidebarDashboard component), show current
  findings summary instead of requiring scan target selection:
  - "X active findings" (non-suppressed from latest scan)
  - "Y suppressed" (matched by .ash.yaml)
  - Severity breakdown of active findings only
  - Triage progress bar computed against active findings only (suppressed
    findings are excluded from the denominator)
  - "Last scanned: [timestamp]" from the latest scan

- When the editor panel opens via dashboard or "View Findings":
  - Default to showing current findings (not requiring scan selection)
  - The findings list shows all findings from the latest scan
  - Suppressed findings are HIDDEN by default (see filter toggle below)

- When no completed scans exist for the scan root, show the existing empty state
  with "Run your first scan" prompt

SUPPRESSION FILTER TOGGLE:
- Add a toggle/switch to the findings list view (FindingsView component):
  "Show suppressed" — off by default
- When off: filter out findings where isCurrentlySuppressed === true
- When on: show all findings; suppressed ones get a visual indicator
  (e.g., a muted/striped row style, or a "Suppressed" badge in the disposition
  column)
- This toggle is a local UI state, not persisted

HISTORICAL SCAN OVERLAY:
- When the user navigates to a specific historical scan (via scan history), the
  findings for that scan are displayed as before (per-scan view)
- ADDITIONALLY, each historical finding gets the isCurrentlySuppressed overlay
  by matching against the CURRENT .ash.yaml state
- Show a subtle indicator on historical findings that are currently suppressed:
  e.g., a small "Currently suppressed" chip/badge alongside the finding
- This tells the user: "this finding existed in scan X, and your current
  .ash.yaml rules would suppress it"

ASH YAML CHANGE REACTIVITY:
- When AshYamlService emits a change event (file watcher from Spec 2):
  1. FindingsPanelManager re-computes current findings with new suppression state
  2. Sends currentFindingsUpdate to the editor panel WebView
  3. SidebarWebviewProvider re-computes and sends updated summary to sidebar
  4. If the user is viewing a historical scan, re-overlay suppression status

WEBVIEW STATE CHANGES:
Update AppState in webview/src/App.tsx:
- Add: currentFindings: FindingRow[] (the primary findings set)
- Add: suppressionSummary: SuppressionSummary
- Add: showSuppressed: boolean (filter toggle state, default false)
- The existing findings field continues to hold scan-specific findings when
  viewing a particular scan

Update the reducer to handle:
- MESSAGE with currentFindingsUpdate: set currentFindings and suppressionSummary
- MESSAGE with ashYamlChanged: (informational, triggers re-fetch if needed)
- New action: TOGGLE_SHOW_SUPPRESSED: flip the showSuppressed filter

DASHBOARD VIEW UPDATES (DashboardView, SidebarDashboard):
- Show "Active Findings: X" prominently (non-suppressed count)
- Show "Suppressed: Y" as secondary info
- Severity breakdown uses active findings only
- Triage progress bar: denominator is active findings, not total findings
- "View Findings" button opens current findings (not scan-specific)

NON-GOALS:
- This spec does NOT implement writing to .ash.yaml (Spec 4)
- This spec does NOT add the suppression management UI (Spec 4)
- This spec does NOT parse SARIF suppression data — .ash.yaml is the sole source
- The "Suppress" disposition button is temporarily disabled (Spec 4 enables it)

AFFECTED FILES:
- vsix/src/models/types.ts (FindingRow changes, new types)
- webview/src/types/types.ts (mirror)
- vsix/src/models/messages.ts (new message types)
- webview/src/types/messages.ts (mirror)
- vsix/src/models/mappers.ts (suppression-aware mapping)
- vsix/src/services/findings.ts (getCurrentFindings method)
- vsix/src/providers/findingsPanelManager.ts (current findings flow, ash.yaml
  change handler)
- vsix/src/providers/sidebarWebviewProvider.ts (current findings summary)
- webview/src/App.tsx (state + reducer changes)
- webview/src/components/DashboardView.tsx (active vs suppressed counts)
- webview/src/components/SidebarDashboard.tsx (active vs suppressed counts)
- webview/src/components/FindingsView.tsx (suppression toggle, row styling)
- webview/src/components/FindingDetailView.tsx (suppression indicator)
- webview/src/components/TriageControls.tsx (disable Suppress button with tooltip)
- webview/src/components/TriageProgressBar.tsx (active findings denominator)
```

---

## Spec 4: `.ash.yaml` Write & Suppress Action

**Depends on:** Spec 2 (`.ash.yaml` read service), Spec 3 (current findings view with suppression overlay)

**Motivation:** With Spec 2 reading `.ash.yaml` and Spec 3 displaying suppression state, users can see which findings are suppressed. But they can't create new suppressions from the workbench — they have to hand-edit `.ash.yaml`. This spec closes the loop: when a user marks a finding as "Suppress," the workbench generates a `.ash.yaml` entry, lets the user review it, and writes it to the file. This makes `.ash.yaml` the single source of truth that both the CLI and workbench honor.

**Feature description for `speckit.specify`:**

```
Feature: .ash.yaml Write & Suppress Action

Enable the workbench to write suppression entries to .ash.yaml when users suppress
findings. The suppress action generates a .ash.yaml entry from the finding's data,
shows it for review, and appends it to the file. This establishes a bidirectional
relationship with .ash.yaml: read (Spec 2) and write (this spec).

ASH YAML WRITER:
Add write capability to AshYamlService (from Spec 2):

- addSuppression(suppression: AshSuppression): void
  1. Read the current .ash.yaml file (re-read, don't use cache, to avoid conflicts)
  2. If file doesn't exist, create it with skeleton structure:
     ---
     global_settings:
       suppressions: []
  3. If file exists but has no global_settings.suppressions, add the key
  4. Append the new suppression entry to the suppressions array
  5. Write the file back using a YAML library that preserves existing structure
     and comments as much as possible (prefer the yaml npm package over js-yaml
     for its comment-preservation capability — evaluate during implementation)
  6. The file watcher (from Spec 2) will fire, triggering re-parse and UI refresh

- removeSuppression(suppression: AshSuppression): void
  1. Read current .ash.yaml
  2. Find the matching suppression in the array (match on path + rule_id +
     line_start + line_end — the same composite key ASH uses for suppression IDs)
  3. Remove it from the array
  4. Write back

- updateSuppression(old: AshSuppression, updated: AshSuppression): void
  1. Read current .ash.yaml
  2. Find and replace the matching entry
  3. Write back

CONFLICT SAFETY:
- Always re-read the file before writing (never write from stale cache)
- If the file was modified externally between read and write, detect this via
  file mtime comparison and retry once
- If the file is malformed YAML that can't be parsed, show an error notification:
  "Cannot modify .ash.yaml: file contains invalid YAML. Please fix it manually."
  Do NOT attempt to write to a file we can't parse

SUPPRESS ACTION FLOW:
When the user clicks "Suppress" on a finding (re-enable the button disabled in
Spec 3):

1. GENERATE entry: Build an AshSuppression object from the finding:
   - path: finding.filePath (the relative path already stored in the DB)
   - rule_id: finding.ruleId
   - reason: "" (empty — user must provide)
   - line_start: finding.startLine (include only if the finding has specific lines)
   - line_end: finding.endLine (include only if different from startLine)
   - expiration: null (no expiration by default)

2. SHOW review in SuppressionPanel:
   - The existing SuppressionPanel component (webview/src/components/
     SuppressionPanel.tsx) becomes an interactive form instead of read-only display
   - Fields:
     a. Justification (required): textarea for the reason field. If the finding
        has notes already, pre-populate from notes. User must provide a non-empty
        reason before confirming.
     b. YAML preview: live-generated .ash.yaml entry shown in a CodeBlock, updated
        as the user types the justification
     c. Scope selector: radio/select for suppression scope:
        - "This file + rule" (default): path=filePath, rule_id=ruleId
        - "This rule everywhere": path="**", rule_id=ruleId
        - "This file (all rules)": path=filePath, rule_id=null
        These are convenience presets — advanced users can always hand-edit .ash.yaml
     d. Include line range: checkbox, default off. When on, includes line_start
        and line_end in the entry. Off by default because line numbers shift as
        code changes.
     e. Expiration date: optional date picker. When set, adds the expiration field.

3. CONFIRM: User clicks "Add Suppression" button
   - Validate: reason is non-empty
   - Call AshYamlService.addSuppression() to write to .ash.yaml
   - The file watcher fires → AshYamlService re-parses → the finding's
     isCurrentlySuppressed becomes true → UI updates automatically
   - Show a brief success notification: "Suppression added to .ash.yaml"

4. The finding's DB disposition does NOT change to SUPPRESS. The suppression
   status is derived from .ash.yaml matching (established in Spec 3). The DB
   disposition remains whatever it was (PENDING, FIX, or DEFER). This means:
   - A finding can have disposition=FIX and still be suppressed in .ash.yaml
   - The user decides the in-app triage state independently of the file-level
     suppression

MESSAGE PROTOCOL:
Add to WebviewToExtMessage:
- suppressFinding: { findingId: string, suppression: SuppressionInput }
  Where SuppressionInput = { reason: string, scope: 'file_rule' | 'rule_all' |
  'file_all', includeLines: boolean, expiration: string | null }

Add to ExtToWebviewMessage:
- suppressionWritten: { findingId: string, success: boolean, error?: string }

The handler in FindingsPanelManager:
1. Receives suppressFinding message
2. Looks up the finding by ID
3. Builds AshSuppression from finding data + SuppressionInput
4. Calls AshYamlService.addSuppression()
5. Sends suppressionWritten response
6. The file watcher handles the UI refresh cascade

SUPPRESS BUTTON RE-ENABLEMENT:
- In TriageControls component, re-enable the "Suppress" button (was disabled
  with tooltip in Spec 3)
- Clicking "Suppress" navigates to / expands the SuppressionPanel form
- The button text or icon should distinguish it from FIX/DEFER since suppress
  writes to a file while the others are in-app triage states
- Consider labeling it "Suppress (.ash.yaml)" or using a file icon

UNSUPPRESS ACTION:
- For findings that are currently suppressed (isCurrentlySuppressed === true),
  show an "Unsuppress" option in the finding detail view
- Clicking "Unsuppress" shows a confirmation: "Remove this suppression from
  .ash.yaml?" with the matching rule displayed
- On confirm, calls AshYamlService.removeSuppression()
- File watcher fires → finding becomes unsuppressed → UI updates

AI SUPPRESSION HOOK (FUTURE-READY):
- The suppress flow should have a clear insertion point for AI-generated
  justifications. Design the SuppressionPanel so that a future "Generate with AI"
  button can be added next to the justification textarea
- The AI would populate the reason field; the user reviews and confirms
- No AI implementation in this spec — just ensure the architecture supports it
- The existing SuppressionData type already has justification and yamlEntry
  fields that align with this flow

NPM DEPENDENCIES:
- Consider yaml (https://eemeli.org/yaml/) instead of or in addition to js-yaml
  for write operations — it preserves comments and formatting better
- Evaluate during implementation; if js-yaml is sufficient for append-only
  operations, it may be simpler to stick with one library

AFFECTED FILES:
- vsix/src/services/ashYaml.ts (add write methods)
- vsix/src/models/types.ts (SuppressionInput type)
- webview/src/types/types.ts (mirror)
- vsix/src/models/messages.ts (new message types)
- webview/src/types/messages.ts (mirror)
- vsix/src/providers/findingsPanelManager.ts (suppressFinding handler)
- webview/src/components/SuppressionPanel.tsx (interactive form rewrite)
- webview/src/components/TriageControls.tsx (re-enable Suppress, visual
  distinction)
- webview/src/components/FindingDetailView.tsx (unsuppress action)

NON-GOALS:
- This spec does NOT build the standalone suppression management view (Spec 5)
- This spec does NOT implement AI-generated justifications (future work)
- This spec does NOT modify non-suppression .ash.yaml sections (scanners,
  reporters, etc.)
```

---

## Spec 5: Suppression Management View

**Depends on:** Spec 2 (`.ash.yaml` read), Spec 4 (`.ash.yaml` write)

**Motivation:** With Specs 2-4, the user can see suppression overlays and create suppressions from individual findings. But there's no way to see all suppressions at once, identify unused or expired rules, or manage suppressions that weren't created from the workbench (e.g., hand-edited or committed by teammates). This spec adds a dedicated suppression management interface that gives users full visibility and control over their `.ash.yaml` suppression rules.

**Feature description for `speckit.specify`:**

```
Feature: Suppression Management View

Add a dedicated suppression management interface to the ASH Workbench that shows
all .ash.yaml suppression rules, their status (active, expired, unused), and
provides edit/remove capabilities. This gives users a centralized place to manage
their suppression configuration alongside the findings they suppress.

NAVIGATION:
- Add a "Suppressions" entry point accessible from:
  1. The sidebar dashboard — a "Manage Suppressions" link/button in the summary
     area, showing the count of active suppression rules
  2. The editor panel header — a tab or button alongside the existing navigation
  3. A new VS Code command: ashWorkbench.manageSuppresions (registered in
     package.json)

VIEW STRUCTURE:
The suppression management view is a new WebView page within the existing editor
panel (FindingsPanelManager). It is NOT a separate panel.

Add a new view state: 'suppressionManager' to the ViewState type.

The view has these sections:

1. SUMMARY HEADER:
   - Total suppression rules: N
   - Active: X (not expired, matched at least one finding in latest scan)
   - Unused: Y (not expired, matched zero findings in latest scan)
   - Expired: Z (expiration date in the past)
   - Source file path: ".ash.yaml" or ".ash/.ash.yaml" (clickable to open in editor)

2. SUPPRESSION LIST:
   A table/list of all suppression entries from .ash.yaml with columns:
   - Rule ID: the rule_id field (or "Any" if null)
   - Path: the path glob pattern
   - Line range: "L10-L15" or "Any" if no line range
   - Reason: the justification text (truncated, expandable)
   - Expiration: date or "None"
   - Status badge:
     - "Active" (green) — not expired, matched findings in latest scan
     - "Unused" (yellow/amber) — not expired, matched zero findings
     - "Expired" (red/gray) — past expiration date
   - Match count: number of findings in the latest scan this rule matches
   - Actions: Edit, Remove buttons

   The list should be:
   - Sortable by any column
   - Filterable by status (Active / Unused / Expired toggle chips)
   - Searchable by rule ID, path, or reason text

3. MATCHED FINDINGS (expandable per row):
   - When expanding a suppression row, show the list of findings from the latest
     scan that this rule matches
   - Each finding shows: severity, title, file, line — clickable to navigate to
     the finding detail view
   - This helps users understand the impact of each suppression rule

EDIT SUPPRESSION:
- Clicking "Edit" on a suppression opens an inline form (or modal) with:
  - Path (text input, pre-filled)
  - Rule ID (text input, pre-filled, clearable for "any rule")
  - Reason (textarea, pre-filled)
  - Line start / Line end (number inputs, optional)
  - Expiration (date picker, optional)
- "Save" calls AshYamlService.updateSuppression(old, updated)
- "Cancel" discards changes

REMOVE SUPPRESSION:
- Clicking "Remove" shows a confirmation dialog:
  "Remove this suppression rule? This will unsuppress X finding(s) in the
  current scan."
- On confirm, calls AshYamlService.removeSuppression()
- File watcher fires → suppression list refreshes, finding suppression status
  updates throughout the app

ADD SUPPRESSION (from management view):
- "Add Suppression" button at the top of the list
- Opens a blank form with the same fields as Edit
- For path and rule_id, offer autocomplete from known findings (file paths and
  rule IDs from the latest scan)
- On save, calls AshYamlService.addSuppression()

IGNORE PATHS SECTION (secondary):
- Below the suppressions list, show a read-only section for
  global_settings.ignore_paths from .ash.yaml
- Table with columns: Path, Reason, Expiration, Status (Active/Expired)
- This is informational only — helps users understand why certain files have
  no findings ("they were excluded from scanning")
- No edit/remove capability in this spec (ignore paths are less frequently
  managed than suppressions)

ASH YAML CONFIG INFO (tertiary):
- A small info panel showing other relevant .ash.yaml settings:
  - Project name (if set)
  - Global severity threshold
  - Enabled scanners list
  - fail_on_findings flag
- Read-only, informational. Helps the user understand their scan configuration
  without opening the YAML file

MESSAGE PROTOCOL:
Add to WebviewToExtMessage:
- requestSuppressions: {} (request the full suppression list)
- editSuppression: { old: AshSuppression, updated: AshSuppression }
- removeSuppression: { suppression: AshSuppression }
- addSuppression: { suppression: AshSuppression }
  (Note: addSuppression from Spec 4 is for finding-driven flow with scope presets;
  this one is for freeform entry from the management view — same handler)

Add to ExtToWebviewMessage:
- suppressionsUpdate: { suppressions: SuppressionEntry[], ignorePaths:
  AshIgnorePath[], configInfo: AshYamlConfigSummary }
  Where SuppressionEntry extends AshSuppression with:
  - status: 'active' | 'unused' | 'expired'
  - matchCount: number
  - matchedFindings: Array<{ id: string, severity: string, title: string,
    file: string }> (lightweight finding refs)
- suppressionWriteResult: { success: boolean, error?: string }

The FindingsPanelManager handler:
1. Receives requestSuppressions
2. Gets suppressions from AshYamlService
3. Computes status (active/unused/expired) by matching against latest scan
4. Sends suppressionsUpdate

WEBVIEW STATE:
Add to AppState:
- suppressions: SuppressionEntry[]
- ignorePaths: AshIgnorePath[]
- configInfo: AshYamlConfigSummary | null

Add new reducer actions for suppression management navigation and data.

NEW WEBVIEW COMPONENT:
- webview/src/components/SuppressionManagerView.tsx — the main view component
- webview/src/components/SuppressionTable.tsx — the sortable/filterable table
- webview/src/components/SuppressionForm.tsx — reusable form for add/edit
  (shares logic with the SuppressionPanel from Spec 4 but is a standalone form
  rather than embedded in finding detail)

KITCHEN SINK:
- Add a demo for SuppressionManagerView to the Kitchen Sink with mock data
  showing active, unused, and expired suppressions

AFFECTED FILES:
- vsix/src/models/types.ts (SuppressionEntry, new message payloads)
- webview/src/types/types.ts (mirror)
- vsix/src/models/messages.ts (new message types)
- webview/src/types/messages.ts (mirror)
- vsix/src/providers/findingsPanelManager.ts (suppression management handlers)
- vsix/src/services/ashYaml.ts (getSuppressionStatuses — match against findings)
- webview/src/App.tsx (new view state, reducer actions)
- webview/src/components/SuppressionManagerView.tsx (new)
- webview/src/components/SuppressionTable.tsx (new)
- webview/src/components/SuppressionForm.tsx (new)
- webview/src/components/DashboardView.tsx (link to suppression manager)
- webview/src/components/SidebarDashboard.tsx (suppression count + link)
- webview/src/pages/sink/ (kitchen sink demo)
- vsix/package.json (new command registration)

NON-GOALS:
- Editing non-suppression sections of .ash.yaml (scanners, reporters, etc.)
- Editing ignore_paths from the UI (read-only in this spec)
- Full .ash.yaml visual editor — this is scoped to suppression management
```

---

## Implementation Sequence Summary

| Order | Spec | Key Deliverable | Unlocks |
|-------|------|-----------------|---------|
| 1 | Scan Root Setting | `ashWorkbench.scanRoot` setting with real-time filtering | Scoped context for all downstream features |
| 2 | `.ash.yaml` Read Service | `AshYamlService` with suppression matching | Suppression awareness throughout the app |
| 3 | Unified Current Findings | Default "current findings" view with suppression overlay | The primary user experience |
| 4 | `.ash.yaml` Write & Suppress | Write suppressions to `.ash.yaml` from finding triage | Bidirectional `.ash.yaml` integration |
| 5 | Suppression Management View | Dedicated UI for viewing/editing all suppression rules | Full suppression lifecycle management |

**Dependency chain:** 1 &rarr; 2 &rarr; 3 &rarr; 4 &rarr; 5 (strictly sequential — each builds on the previous)

**Future work** (not specced here, but architecturally supported):
- AI-assisted suppression justification generation (plugs into Spec 4's write flow)
- SARIF suppression parsing as cross-reference (informational, low priority)
- `.ash.yaml` ignore path editing (extends Spec 5)
- Scanner configuration display (extends Spec 5's config info panel)
