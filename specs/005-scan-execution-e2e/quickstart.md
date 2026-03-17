# Quickstart: Scan Execution End-to-End

**Feature**: 005-scan-execution-e2e
**Date**: 2026-03-16

## Integration Scenarios

### Scenario 1: Command Palette Scan (Happy Path)

1. User presses Ctrl+Shift+P, types "ASH: Start Scan"
2. QuickPick shows: workspace root, previously scanned targets, "Browse..."
3. User selects workspace root
4. Findings panel opens showing "Scanning..." with elapsed timer
5. Sidebar shows scanning indicator with elapsed time
6. ASH CLI runs, produces SARIF output
7. Findings panel updates to show results (finding list)
8. Sidebar updates with new scan summary
9. Scan tree refreshes with new entry

### Scenario 2: Context Menu Scan

1. User right-clicks `src/` folder in Explorer
2. Selects "ASH: Run Security Scan"
3. Findings panel opens immediately showing scanning state for `src/`
4. Same completion flow as Scenario 1

### Scenario 3: Cancel Running Scan

1. Scan is running (Scenario 1, step 4-6)
2. User presses Ctrl+Shift+P, types "ASH: Cancel Scan"
3. ASH process receives SIGTERM
4. Findings panel shows "Scan cancelled"
5. Scan tree shows scan with cancelled icon

### Scenario 4: WebView-Initiated Scan

1. Findings panel is open showing previous results
2. User clicks "Run Scan" button in the panel
3. Panel transitions to scanning state
4. Same completion flow as Scenario 1, step 7-9

### Scenario 5: Sidebar-Initiated Scan

1. User clicks "Scan Workspace" in the sidebar
2. Findings panel opens for workspace root scan
3. Both sidebar and findings panel show progress
4. Same completion flow as Scenario 1, step 7-9

### Scenario 6: Scan While Another Running

1. Scan is running
2. User tries to start another scan (any entry point)
3. Warning message: "A scan is already in progress."
4. Original scan continues unaffected

## Smoke Test Checklist

After implementation, manually verify:

- [ ] `ASH: Start Scan` from command palette shows target picker
- [ ] Target picker lists workspace root and "Browse..."
- [ ] Selecting a target opens findings panel with scanning state
- [ ] Progress timer updates in both findings panel and sidebar
- [ ] Scan completes and findings appear
- [ ] Scan tree view shows new scan entry
- [ ] Right-click folder → "ASH: Run Security Scan" works
- [ ] `ASH: Cancel Scan` terminates a running scan
- [ ] Cancel from WebView works
- [ ] Second scan attempt shows warning
- [ ] Sidebar "Scan Workspace" triggers scan
- [ ] Findings panel "Run Scan" triggers rescan
- [ ] All mock "(mock)" messages are gone
