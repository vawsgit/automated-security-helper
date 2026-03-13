---
title: extension-guidance-research
---

# Strategy: Compiling VS Code Extension Guidance into a Single AI Reference

## Overview

This document analyzes the 37 downloaded VS Code documentation files (3,421 lines, ~95KB) and formulates a strategy for compiling them into a single, efficient reference document that AI can consume in-context when building ASH Workbench features.

The goal: give the AI everything it needs to build correct, convention-following VS Code extension features — and nothing it doesn't.

## Architecture of the Source Material

The downloaded docs fall into three categories:

| Category | File count | Lines | Content character |
|----------|-----------|-------|-------------------|
| Overviews | 3 | 171 | High-level maps, light on implementation |
| Extension Guides | 20 | 2,255 | Technical depth, code examples, `package.json` patterns |
| UX Guidelines | 13 | 995 | Do's/don'ts, short convention lists, some code |
| **Total** | **37** | **3,421** | |

### Key structural observations

1. **Extension Guides and UX Guidelines overlap significantly.** The tree-view guide (156 lines) covers the same territory as ux-views (89 lines). The webview guide (249 lines) overlaps with ux-webviews (45 lines). Merging these per-surface-area eliminates redundancy.

2. **Code examples are the most valuable content.** Prose descriptions of what an API does are less useful than a 5-line TypeScript snippet showing the pattern. The single document should preserve all code examples from relevant guides.

3. **`package.json` contribution patterns are critical.** AI-generated features frequently get the declarative `package.json` configuration wrong — wrong keys, wrong nesting, missing `when` clauses. Every contribution point pattern should be preserved with complete JSON examples.

4. **Do's and Don'ts are low-token, high-value.** The UX guideline bullet lists (e.g., "Don't use an Activity Bar item solely to launch a Webview Panel") prevent common mistakes. They compress well and should be included inline with each surface area section.

## Relevance Analysis: What ASH Workbench Actually Needs

Based on the user stories in `docs/docs/working/app-design/app-design-notes.md`, the extension will need to:

- Run/stop ASH scans with progress tracking
- Display a scan list (current + history)
- Show scan details and findings
- Support finding triage (todo/suppress/wontfix)
- Show cumulative findings across scans
- Scope activities to projects

### Tier 1: CORE — Include in full with code examples

These map directly to ASH Workbench features. Include all implementation patterns, `package.json` snippets, and UX conventions.

| Topic | Source files | Lines | Maps to ASH feature |
|-------|-------------|-------|-------------------|
| Commands | `guide-command.md` + `ux-command-palette.md` | 151 | Every user action |
| Tree View | `guide-tree-view.md` + `ux-views.md` | 245 | Scan list, findings list, project explorer |
| Webview | `guide-webview.md` + `ux-webviews.md` | 294 | Scan details, finding details, dashboards |
| Status Bar | `ux-status-bar.md` | 71 | Scan progress, security status |
| Notifications | `ux-notifications.md` | 85 | Scan completion, errors, progress |
| Settings | `ux-settings.md` | 84 | ASH configuration, scan options |
| Quick Picks | `ux-quick-picks.md` | 76 | Project selection, triage actions |
| Activity Bar | `ux-activity-bar.md` | 60 | ASH view container |
| Sidebars | `ux-sidebars.md` | 49 | Primary sidebar layout |
| Context Menus | `ux-context-menus.md` | 88 | Right-click on findings, scans |
| Task Provider | `guide-task-provider.md` | 105 | ASH scan execution |
| Panel | `ux-panel.md` | 63 | Scan output, results display |
| Diagnostics | `guide-diagnostics.md` (fetched) | ~120 | Inline findings in editors, quick fixes |
| **Subtotal** | | **~1,491** | |

### Tier 2: SUPPLEMENTAL — Include condensed (key facts only, no code)

These are relevant for awareness but don't need full implementation guides in the compiled document. Include as a brief reference section (2-5 lines each).

| Topic | Source file | Lines | Why include |
|-------|------------|-------|-------------|
| Walkthroughs | `ux-walkthroughs.md` + `guide-walkthroughs.md` | 86 | First-time setup (future) |
| Workspace Trust | `guide-workspace-trust.md` | 78 | Security extension declaration |
| Telemetry | `guide-telemetry.md` | 69 | Usage tracking (future) |
| AI Extensions | `guide-ai-extensions.md` | 69 | Future AI-assisted triage |
| Editor Actions | `ux-editor-actions.md` | 50 | May annotate files with findings |
| Virtual Documents | `guide-virtual-documents.md` | 110 | May display scan reports |
| Testing | `guide-testing.md` | 116 | Testing infrastructure |
| Extension Capabilities | `extension-capabilities-overview.md` | 70 | Critical restrictions |
| **Subtotal** | | **~648** | Condenses to ~90 lines |

### Tier 3: EXCLUDE — Not relevant to ASH Workbench

These are domain-specific guides for extension types ASH will never be.

| Topic | Source file | Lines | Why exclude |
|-------|------------|-------|-------------|
| Color Theme | `guide-color-theme.md` | 65 | ASH is not a theme |
| File Icon Theme | `guide-file-icon-theme.md` | 185 | ASH is not an icon theme |
| Product Icon Theme | `guide-product-icon-theme.md` | 88 | ASH is not a product icon theme |
| Notebook | `guide-notebook.md` | 294 | ASH doesn't use notebooks |
| Custom Editors | `guide-custom-editors.md` | 69 | Standard views suffice |
| Virtual Workspaces | `guide-virtual-workspaces.md` | 74 | Not the use case |
| Web Extensions | `guide-web-extensions.md` | 82 | Desktop-first extension |
| Source Control | `guide-source-control.md` | 89 | ASH is not an SCM provider |
| Debugger Extension | `guide-debugger-extension.md` | 131 | ASH is not a debugger |
| Markdown Extension | `guide-markdown-extension.md` | 77 | ASH doesn't extend markdown |
| Custom Data Extension | `guide-custom-data-extension.md` | 89 | ASH doesn't extend HTML/CSS |
| Overview indexes | 3 files | 159 | Replaced by compiled doc structure |
| Downloaded README | `README.md` | 58 | Superseded by compiled doc |
| **Subtotal** | | **~1,460** | **0 lines in output** |

### Size estimate

| Source | Raw lines | Compiled estimate |
|--------|----------|-------------------|
| Tier 1 (full) | 1,491 | ~1,000 lines (merge overlaps, tighten prose) |
| Tier 2 (condensed) | 648 | ~90 lines (key facts only) |
| Tier 3 (excluded) | 1,460 | 0 lines |
| New structural content | — | ~80 lines (preamble, section headers, cross-refs) |
| **Total** | **3,599** | **~1,170 lines (~33KB)** |

This is a ~67% reduction while preserving all actionable implementation guidance.

## Detailed Findings: Content Quality Assessment

### What the downloaded docs do well

1. **Code examples are directly usable.** The tree-view guide's `TreeDataProvider` implementation, the webview's message-passing pattern, and the task provider's execution types are all copy-paste-ready patterns that prevent AI from inventing incorrect approaches.

2. **`package.json` contribution point patterns are complete.** Every relevant guide includes the exact JSON structure needed in the manifest. These are the highest-value content for AI — getting `contributes.views`, `contributes.menus`, `contributes.configuration` right is where most AI-generated extension code goes wrong.

3. **UX do's/don'ts are concise and high-signal.** "Don't use an Activity Bar item solely to launch a Webview Panel", "Don't show actions universally across every file without contextual relevance", "Limit to three or fewer actions per tree item" — these are exactly the kind of constraints AI needs.

### What the downloaded docs lack

1. ~~**No `Diagnostics` API coverage.**~~ **RESOLVED** — Fetched and saved as `guide-diagnostics.md`. Now a Tier 1 topic.

2. **No `OutputChannel` coverage.** Scan output logging will likely use `vscode.window.createOutputChannel()`. This is a basic API but no guide covers it. Will be included in API Quick Reference.

3. **No `FileSystemWatcher` coverage.** Monitoring scan result files or workspace changes may need this API. Will be included in API Quick Reference.

4. **No `Decoration` API coverage.** File decorations (badges on files in explorer showing finding counts) use `FileDecorationProvider`. Not covered. Will be included in API Quick Reference.

5. **Progress API is fragmented.** Progress reporting is scattered across ux-notifications (notification progress), ux-status-bar (status bar progress), and ux-views (view progress). These should be unified in a single "Progress Patterns" section.

### Content that's surprisingly thin

- **`ux-webviews.md`** (45 lines) is almost entirely do's/don'ts with zero implementation detail. All the technical substance is in `guide-webview.md` (249 lines). Merging these is straightforward.
- **`ux-editor-actions.md`** (50 lines) is mostly "don't include multiple icons" with one JSON snippet. Could be 5 lines in the compiled doc.
- **`ux-activity-bar.md`** (60 lines) says "pick a good icon, don't duplicate existing ones." Could be 3 lines.

### Content that's surprisingly deep

- **`guide-webview.md`** (249 lines) is the most implementation-rich file. It covers lifecycle, local resources, theming, message passing, security (CSP), state persistence (3 options), accessibility, and debugging. Nearly all of this is relevant since ASH will likely use webviews for scan detail panels.
- **`guide-tree-view.md`** (156 lines) covers the full lifecycle including view containers, welcome content, context menu actions, and refresh patterns. All relevant for scan/findings tree views.
- **`guide-notebook.md`** (294 lines) is the longest file but entirely irrelevant. Excluding it saves 8.6% of total content.

## Proposed Document Structure

The compiled document should be organized by **what the developer is trying to do**, not by VS Code's API taxonomy. An AI building a "scan results sidebar" shouldn't need to know it's looking at the "Tree View API Guide" — it should find the section about building sidebar content.

### Recommended structure

```
# VS Code Extension Development Reference
## For ASH Workbench AI-Assisted Development

## 1. Critical Constraints
   - No DOM access
   - No custom stylesheets
   - Extensions run in Node.js (not browser)
   - `package.json` is the declarative manifest for all contributions

## 2. Extension Lifecycle
   - Activation events (onCommand, onView, onStartupFinished)
   - activate() / deactivate() pattern
   - Context subscriptions and disposables

## 3. Commands
   [Merged: guide-command.md + ux-command-palette.md]
   - Registration (programmatic + package.json)
   - Naming conventions (title case, verb-noun)
   - Conditional display with when-clauses
   - Custom context via setContext
   - Command URIs in markdown/webviews
   ### UX: Command titles must be title-case, verb-first, no "command" word

## 4. Activity Bar & View Containers
   [Merged: guide-tree-view.md (container section) + ux-activity-bar.md + ux-sidebars.md]
   - viewsContainers contribution point
   - Icon requirements
   - View registration in containers
   ### UX: One container per extension. 3-5 views max. Descriptive names.

## 5. Tree Views
   [Merged: guide-tree-view.md (core) + ux-views.md (tree section)]
   - TreeDataProvider implementation
   - Refresh with EventEmitter
   - Welcome content for empty views
   - View actions (title, context, inline)
   - collapsibleState patterns
   ### UX: Descriptive labels. Product icons. ≤3 actions per item. No command-button items.

## 6. Webviews
   [Merged: guide-webview.md + ux-webviews.md]
   - When to use (and when not to)
   - Panel creation and lifecycle
   - HTML content requirements
   - Loading local resources (asWebviewUri, localResourceRoots)
   - Theming (CSS classes, CSS variables)
   - Message passing (extension↔webview, bidirectional)
   - Security (CSP, sanitization)
   - State persistence (getState/setState, serialization, retainContextWhenHidden)
   - Accessibility classes
   ### UX: Only when native APIs insufficient. Theme everything. No promotional content.

## 7. Status Bar
   [From: ux-status-bar.md]
   - createStatusBarItem (alignment, priority)
   - Standard, progress (spin animation), error/warning items
   - Codicon syntax in text
   ### UX: Concise labels. Left=global, right=contextual. Minimal items.

## 8. Notifications & Progress
   [Merged: ux-notifications.md + progress content from ux-status-bar + ux-views]
   - showInformationMessage / showWarningMessage / showErrorMessage
   - Decision framework (when to use what)
   - Progress API (Notification, StatusBar, View locations)
   - Modal dialogs
   ### UX: Minimal notifications. "Do not show again" option. One at a time.

## 9. Quick Picks & Input
   [From: ux-quick-picks.md]
   - showQuickPick / createQuickPick
   - Rich items (label, description, detail)
   - Multi-step and multi-select
   - Separators
   ### UX: Titles for multi-step. Placeholders always. No wizard-length flows.

## 10. Settings (Configuration)
   [From: ux-settings.md]
   - contributes.configuration structure
   - Setting types (boolean, string, enum, array, object)
   - Linking to settings from notifications
   ### UX: Defaults on everything. Clear descriptions. No custom settings UI.

## 11. Context Menus
   [From: ux-context-menus.md]
   - editor/context, explorer/context, view/item/context
   - Menu groups (navigation, 1_modification, 9_cutcopypaste)
   - Submenus for large action sets
   - when clauses for contextual display
   ### UX: Only show when contextually relevant. Group similar actions.

## 12. Panel
   [From: ux-panel.md]
   - viewsContainers.panel contribution point
   - Panel toolbar behavior (single vs. multiple views)
   - When to use panel vs. sidebar
   ### UX: For views needing horizontal space. Not for always-visible content. Resize properly.

## 13. Task Provider
   [From: guide-task-provider.md]
   - taskDefinitions contribution point
   - provideTasks / resolveTask
   - ShellExecution, ProcessExecution, CustomExecution
   - Task object construction
   ### UX: Define when-clause for execution support.

## 14. Diagnostics & Code Actions
   [From: guide-diagnostics.md (fetched)]
   - createDiagnosticCollection() pattern
   - DiagnosticSeverity levels (Error, Warning, Information, Hint)
   - Diagnostic properties (source, code, relatedInformation, tags)
   - Managing diagnostics (set, delete, clear per URI)
   - CodeActionProvider for quick fixes
   - No package.json contribution needed — purely programmatic

## 15. Supplemental Reference
   Brief entries for features that may be needed later:
   - Walkthroughs (onboarding checklists, SVG theming)
   - Workspace Trust (untrustedWorkspaces capability)
   - Telemetry (@vscode/extension-telemetry, consent APIs)
   - AI Chat Participants (ChatRequestHandler, slash commands)
   - Editor Actions (editor/title menu)
   - Virtual Documents (TextDocumentContentProvider)
   - Testing API (TestController, TestItem, run profiles)

## 16. API Quick Reference
   Table of commonly needed APIs not covered in depth above:
   - Output Channel: vscode.window.createOutputChannel()
   - File Decorations: vscode.window.registerFileDecorationProvider()
   - File System Watcher: vscode.workspace.createFileSystemWatcher()
   - Storage: context.workspaceState / context.globalState
   - Secrets: context.secrets
```

## Patterns and Conventions for Compilation

### Merge strategy for overlapping content

For each surface area where an Extension Guide and UX Guideline overlap:

1. **Lead with the UX conventions** (do's/don'ts) as a brief callout box or bullet list
2. **Follow with the implementation pattern** (code examples from the Extension Guide)
3. **Include the full `package.json` snippet** — never abbreviate manifest patterns
4. **Remove prose that restates what the code shows** — e.g., "The collapsibleState property controls whether items display as collapsed, expanded, or leaf nodes" is unnecessary when the code example already demonstrates it

### Code example handling

- **Keep all TypeScript examples** from Tier 1 guides — they're the primary value
- **Keep all `package.json` examples** — these prevent manifest errors
- **Remove duplicate patterns** — if tree view and webview both show command registration, keep it once in the Commands section
- **Keep example names generic** — preserve original VS Code documentation names ("cowsay", "catScratch", "nodeDependencies") or use neutral placeholders like "myExtension". This keeps the reference applicable to any VS Code extension, not just ASH.

### Prose compression rules

- Replace flowing paragraphs with bullet lists
- Remove "As the documentation states:" and similar meta-commentary
- Remove "Related Resources" link lists (they point to external URLs)
- Remove source attribution lines (the compiled doc credits the source once)
- Convert multi-sentence explanations to single-line summaries when the code example already illustrates the concept

## Issues and Risks

### ~~Gap: Diagnostics API~~ RESOLVED

Diagnostics API has been fetched and saved to `downloaded/guide-diagnostics.md`. Covers `DiagnosticCollection`, `DiagnosticSeverity`, full implementation pattern, `CodeActionProvider` for quick fixes, and diagnostic properties (`source`, `code`, `relatedInformation`, `tags`). This is now a Tier 1 topic with ~120 lines of implementation-ready content.

### Gap: Output Channel

Scan output logging will use `vscode.window.createOutputChannel()`. Simple API but important for ASH. Should be documented in the compiled reference.

### Gap: File Decoration Provider

Showing finding counts as badges on files in the explorer tree (e.g., "3 findings" badge) uses `FileDecorationProvider`. Not covered in downloaded docs. Brief mention needed.

### Risk: Stale information

The downloaded content reflects VS Code documentation as of March 2026. The compiled document should note its provenance date. API changes in future VS Code versions may invalidate specific patterns.

### Risk: Token budget vs. completeness trade-off

Two documents address this:

1. **Full reference** (~1,170 lines, ~33KB) at `docs/docs/developer-docs/reference/vscode-extension-reference.md` — complete, included in production doc builds, loaded when deep detail is needed
2. **Cheat sheet** (~400 lines, ~12KB) at `docs/docs/working/extension-guide/vscode-extension-cheat-sheet.md` — compressed working doc for quick context loading, excluded from production builds

The cheat sheet is the default for AI context; the full reference is read on-demand for specific topics.

## Key Takeaways

1. **42% of the downloaded content is irrelevant to ASH Workbench** (theme guides, notebook, debugger, SCM, etc.) and should be excluded entirely.

2. **The remaining content has ~30% internal redundancy** from overlap between Extension Guides and UX Guidelines covering the same surface areas.

3. **The compiled document should be organized by developer intent** (what am I building?) not by VS Code API taxonomy (what API am I calling?).

4. **Code examples and `package.json` patterns are the highest-value content** — these are what prevent AI from generating incorrect extension code. Preserve them all from Tier 1 guides.

5. **Three remaining API gaps to fill in the API Quick Reference:** OutputChannel, FileDecorationProvider, and FileSystemWatcher. The Diagnostics gap has been resolved with a full fetched guide (now Tier 1).

6. **Two output documents:** Full reference (~1,170 lines, ~33KB) at `developer-docs/reference/vscode-extension-reference.md` for permanent developer docs, plus a cheat sheet (~400 lines, ~12KB) at `working/extension-guide/vscode-extension-cheat-sheet.md` for quick AI context loading. Together they represent a ~67% reduction from raw material.

7. **UX conventions should be embedded inline** with their corresponding technical sections, not in a separate "UX Guidelines" area. This ensures AI reads the "don't" right next to the code it's writing.

## Resolved Questions

1. **Should the compiled document normalize example code to use ASH-specific names?** No. Keep examples generic so the reference applies to any VS Code extension development, not just ASH. Use the original example names from the VS Code docs.

2. **Should the compiled doc be a working doc or go into CLAUDE.md as persistent guidance?** Two outputs: the full reference goes to `docs/docs/developer-docs/reference/vscode-extension-reference.md` (permanent developer docs), and a condensed cheat sheet goes to `docs/docs/working/extension-guide/vscode-extension-cheat-sheet.md` (working doc for quick context loading). Both are read into context as needed.

3. **Should we fetch the Diagnostics API reference from VS Code docs?** Yes — done. Fetched and saved to `downloaded/guide-diagnostics.md`. The gap is now filled with full implementation patterns including `DiagnosticCollection`, severity levels, `CodeActionProvider` for quick fixes, and `package.json` patterns.

4. **Is the Panel area (bottom views) needed for ASH?** Yes. A "Scan Output" panel view is a natural fit. Panel is promoted from Tier 2 to Tier 1 in the compilation plan.

## Recommended Implementation Plan

### Phase 1: Compile the full reference document
1. Create `docs/docs/developer-docs/reference/vscode-extension-reference.md` (permanent developer docs)
2. Add `_category_.json` to `docs/docs/developer-docs/reference/` if the directory is new
3. Write the preamble (constraints, lifecycle, activation) from the capabilities overview
4. For each Tier 1 topic: merge the Extension Guide and UX Guideline content, compress prose, preserve all code examples and `package.json` patterns
5. Write the Tier 2 supplemental section (condensed entries, 2-5 lines each)
6. Write the API quick reference section covering the remaining gaps (OutputChannel, FileDecorationProvider, FileSystemWatcher)

### Phase 2: Compile the cheat sheet
1. Create `docs/docs/working/extension-guide/vscode-extension-cheat-sheet.md` (working doc)
2. Extract the essential patterns from each Tier 1 section: one code example + key UX rules per surface area
3. Target ~400 lines — enough for quick context loading without reading the full reference
4. Include a pointer to the full reference for deeper detail
5. Focus on `package.json` patterns and the most common API calls — the things AI gets wrong most often

### Phase 3: Review and refine
1. Human reviews both documents for accuracy and completeness
2. Verify all `package.json` contribution patterns are syntactically correct
3. Verify all TypeScript examples compile conceptually (no missing imports, correct API signatures)
4. Confirm generic example names are clear and instructive

### Phase 4: Integrate into development workflow
1. Document both file paths in CLAUDE.md so AI knows where to find them
2. For feature implementation sessions: read the cheat sheet first; read the full reference when deeper detail is needed
3. The full reference in `developer-docs/reference/` is included in production doc builds and serves as a lasting contributor resource
4. The cheat sheet in `working/` is excluded from production builds — it's an AI working aid only
