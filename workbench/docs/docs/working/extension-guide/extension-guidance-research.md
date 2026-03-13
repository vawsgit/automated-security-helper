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
| **Subtotal** | | **~1,308** | |

### Tier 2: SUPPLEMENTAL — Include condensed (key facts only, no code)

These are relevant for awareness but don't need full implementation guides in the compiled document. Include as a brief reference section (2-5 lines each).

| Topic | Source file | Lines | Why include |
|-------|------------|-------|-------------|
| Walkthroughs | `ux-walkthroughs.md` + `guide-walkthroughs.md` | 86 | First-time setup (future) |
| Workspace Trust | `guide-workspace-trust.md` | 78 | Security extension declaration |
| Telemetry | `guide-telemetry.md` | 69 | Usage tracking (future) |
| AI Extensions | `guide-ai-extensions.md` | 69 | Future AI-assisted triage |
| Panel | `ux-panel.md` | 63 | May use for output/results |
| Editor Actions | `ux-editor-actions.md` | 50 | May annotate files with findings |
| Virtual Documents | `guide-virtual-documents.md` | 110 | May display scan reports |
| Testing | `guide-testing.md` | 116 | Testing infrastructure |
| Extension Capabilities | `extension-capabilities-overview.md` | 70 | Critical restrictions |
| **Subtotal** | | **~711** | Condenses to ~100 lines |

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
| Tier 1 (full) | 1,308 | ~900 lines (merge overlaps, tighten prose) |
| Tier 2 (condensed) | 711 | ~100 lines (key facts only) |
| Tier 3 (excluded) | 1,460 | 0 lines |
| New structural content | — | ~80 lines (preamble, section headers, cross-refs) |
| **Total** | **3,421** | **~1,080 lines (~30KB)** |

This is a ~68% reduction while preserving all actionable implementation guidance.

## Detailed Findings: Content Quality Assessment

### What the downloaded docs do well

1. **Code examples are directly usable.** The tree-view guide's `TreeDataProvider` implementation, the webview's message-passing pattern, and the task provider's execution types are all copy-paste-ready patterns that prevent AI from inventing incorrect approaches.

2. **`package.json` contribution point patterns are complete.** Every relevant guide includes the exact JSON structure needed in the manifest. These are the highest-value content for AI — getting `contributes.views`, `contributes.menus`, `contributes.configuration` right is where most AI-generated extension code goes wrong.

3. **UX do's/don'ts are concise and high-signal.** "Don't use an Activity Bar item solely to launch a Webview Panel", "Don't show actions universally across every file without contextual relevance", "Limit to three or fewer actions per tree item" — these are exactly the kind of constraints AI needs.

### What the downloaded docs lack

1. **No `Diagnostics` API coverage.** ASH Workbench will almost certainly need the `vscode.languages.createDiagnosticCollection()` API to show findings as squiggly underlines in editors. This is a critical gap. The capabilities overview mentions diagnostics under "Programmatic Language Features" but no guide was downloaded for it.

2. **No `OutputChannel` coverage.** Scan output logging will likely use `vscode.window.createOutputChannel()`. This is a basic API but no guide covers it.

3. **No `FileSystemWatcher` coverage.** Monitoring scan result files or workspace changes may need this API.

4. **No `Decoration` API coverage.** File decorations (badges on files in explorer showing finding counts) use `FileDecorationProvider`. Not covered.

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

## 12. Task Provider
   [From: guide-task-provider.md]
   - taskDefinitions contribution point
   - provideTasks / resolveTask
   - ShellExecution, ProcessExecution, CustomExecution
   - Task object construction
   ### UX: Define when-clause for execution support.

## 13. Supplemental Reference
   Brief entries for features that may be needed later:
   - Walkthroughs (onboarding checklists, SVG theming)
   - Workspace Trust (untrustedWorkspaces capability)
   - Telemetry (@vscode/extension-telemetry, consent APIs)
   - AI Chat Participants (ChatRequestHandler, slash commands)
   - Panel views (viewsContainers.panel)
   - Editor Actions (editor/title menu)
   - Virtual Documents (TextDocumentContentProvider)
   - Testing API (TestController, TestItem, run profiles)

## 14. API Quick Reference
   Table of commonly needed APIs not covered in guides:
   - Diagnostics: vscode.languages.createDiagnosticCollection()
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
- **Normalize example names** — replace "cowsay", "catScratch", "nodeDependencies" with ASH-relevant placeholders like "ashWorkbench.runScan", "securityFindings" to make the reference immediately applicable

### Prose compression rules

- Replace flowing paragraphs with bullet lists
- Remove "As the documentation states:" and similar meta-commentary
- Remove "Related Resources" link lists (they point to external URLs)
- Remove source attribution lines (the compiled doc credits the source once)
- Convert multi-sentence explanations to single-line summaries when the code example already illustrates the concept

## Issues and Risks

### Gap: Diagnostics API

ASH Workbench will almost certainly need the `vscode.languages.createDiagnosticCollection()` API to show security findings as inline editor markers (squiggly underlines). This is the standard VS Code pattern for linting/analysis tools, and it's not covered in any downloaded guide. **The compiled document must include a hand-written Diagnostics section** or the API reference should be fetched separately.

### Gap: Output Channel

Scan output logging will use `vscode.window.createOutputChannel()`. Simple API but important for ASH. Should be documented in the compiled reference.

### Gap: File Decoration Provider

Showing finding counts as badges on files in the explorer tree (e.g., "3 findings" badge) uses `FileDecorationProvider`. Not covered in downloaded docs. Brief mention needed.

### Risk: Stale information

The downloaded content reflects VS Code documentation as of March 2026. The compiled document should note its provenance date. API changes in future VS Code versions may invalidate specific patterns.

### Risk: Token budget vs. completeness trade-off

At ~1,080 lines (~30KB), the compiled document is moderate for AI context inclusion. If it needs to fit in a CLAUDE.md or a skill prompt, it may need further compression. Two approaches:

1. **Full reference** (~1,080 lines) — loaded via file read when needed
2. **Essential patterns** (~400 lines) — could fit in a skill file's context section

Recommend producing the full reference and a separate condensed "cheat sheet" if needed.

## Key Takeaways

1. **42% of the downloaded content is irrelevant to ASH Workbench** (theme guides, notebook, debugger, SCM, etc.) and should be excluded entirely.

2. **The remaining content has ~30% internal redundancy** from overlap between Extension Guides and UX Guidelines covering the same surface areas.

3. **The compiled document should be organized by developer intent** (what am I building?) not by VS Code API taxonomy (what API am I calling?).

4. **Code examples and `package.json` patterns are the highest-value content** — these are what prevent AI from generating incorrect extension code. Preserve them all from Tier 1 guides.

5. **Four API gaps must be filled:** Diagnostics, OutputChannel, FileDecorationProvider, and FileSystemWatcher. These are simple APIs but essential for a security scanning extension. Brief hand-written sections should be added.

6. **The target document is ~1,080 lines (~30KB)** — a 68% reduction from the raw downloaded material while retaining all actionable implementation guidance.

7. **UX conventions should be embedded inline** with their corresponding technical sections, not in a separate "UX Guidelines" area. This ensures AI reads the "don't" right next to the code it's writing.

## Outstanding Questions

1. **Should the compiled document normalize example code to use ASH-specific names?** (e.g., `ashWorkbench.scanView` instead of `nodeDependencies`) — this would make it immediately applicable but diverges from source material.

2. **Should the compiled doc be a working doc or go into CLAUDE.md as persistent guidance?** The size (~30KB) is too large for CLAUDE.md but could be referenced as a skill context file or loaded on-demand.

3. **Should we fetch the Diagnostics API reference from VS Code docs?** This is the biggest content gap for a security scanner extension.

4. **Is the Panel area (bottom views) needed for ASH?** The user stories don't clearly call for it, but a "Scan Output" panel view is a natural fit. This would promote the Panel guide from Tier 2 to Tier 1.

## Recommended Implementation Plan

### Phase 1: Compile the reference document
1. Create the target file at a chosen location (e.g., `extension-guide/vscode-extension-reference.md`)
2. Write the preamble (constraints, lifecycle, activation) from the capabilities overview
3. For each Tier 1 topic: merge the Extension Guide and UX Guideline content, compress prose, preserve all code examples and `package.json` patterns
4. Write the Tier 2 supplemental section (condensed entries, 2-5 lines each)
5. Write the API quick reference section covering the four identified gaps (Diagnostics, OutputChannel, FileDecorationProvider, FileSystemWatcher)

### Phase 2: Review and refine
1. Human reviews the compiled document for accuracy and completeness
2. Verify all `package.json` contribution patterns are syntactically correct
3. Verify all TypeScript examples compile conceptually (no missing imports, correct API signatures)
4. Assess whether example code should use ASH-specific names

### Phase 3: Integrate into development workflow
1. Decide on delivery mechanism (skill context, on-demand file read, or CLAUDE.md reference)
2. If using as skill context: create a skill that loads the reference when building extension features
3. If on-demand: document the file path in CLAUDE.md so AI knows where to find it
4. Optionally create a condensed ~400-line "cheat sheet" version for tighter context windows
