# Quickstart: Finding Queries, Filters & Summary

## Integration Scenarios

### Scenario 1: Real Findings Display (US1 — P1)

1. Open VS Code with the ASH Workbench extension
2. Run a scan (command palette → "ASH: Start Scan" → select workspace root)
3. Wait for scan to complete
4. Open the findings panel (click scan in tree view, or "ASH: Open Workbench")
5. **Verify**: Findings list shows the actual findings from the scan (titles, severities, file paths match the scanned code)
6. **Verify**: Dashboard disposition summary shows correct counts (all findings should be PENDING initially)
7. **Verify**: No mock data text or placeholder values appear

### Scenario 2: Dashboard Summary Accuracy (US1 — P1)

1. Complete a scan that produces findings
2. Navigate to the dashboard
3. Triage some findings: set 2 to FIX, 1 to SUPPRESS
4. Return to dashboard
5. **Verify**: Summary shows correct counts (e.g., PENDING: 7, FIX: 2, SUPPRESS: 1, DEFER: 0, Total: 10)
6. **Verify**: Summary updates without requiring a page refresh

### Scenario 3: Filter by Severity (US2 — P2)

1. Open findings list for a scan with mixed severities
2. Apply severity filter: select CRITICAL and HIGH only
3. **Verify**: Only CRITICAL and HIGH findings appear in the list
4. Clear the severity filter
5. **Verify**: All findings reappear

### Scenario 4: Filter by File Pattern (US2 — P2)

1. Open findings list for a scan with findings across multiple directories
2. Enter file pattern filter: "src/auth"
3. **Verify**: Only findings in files containing "src/auth" in the path appear
4. Change pattern to "test/"
5. **Verify**: List updates to show only test-related findings
6. Clear the pattern
7. **Verify**: Full list restored

### Scenario 5: Combined Filters (US2 — P2)

1. Open findings list with 20+ findings
2. Apply severity filter: HIGH
3. Apply scanner filter: "bandit"
4. **Verify**: Only HIGH-severity bandit findings appear (AND logic)
5. **Verify**: If no findings match, an empty state message appears

### Scenario 6: Enriched Scan Targets (US3 — P3)

1. Run scans against two different target folders
2. Open the dashboard
3. **Verify**: Each scan target card shows its specific finding count and severity breakdown
4. **Verify**: Triage progress per target reflects only that target's findings
5. Triage a finding for target A
6. **Verify**: Only target A's triage progress updates; target B remains unchanged

## Smoke Test Checklist

- [ ] Extension activates and shows dashboard (no mock data in initial state)
- [ ] Sidebar shows real scan list from database
- [ ] Sidebar summary shows real disposition counts
- [ ] Findings panel shows real findings for selected scan
- [ ] Disposition change updates summary without refresh
- [ ] Severity filter narrows finding list
- [ ] Scanner filter narrows finding list
- [ ] File pattern filter narrows finding list
- [ ] Combined filters use AND logic
- [ ] Empty filter result shows informative message
- [ ] Scan target cards show computed counts
- [ ] No `mock-data` imports in App.tsx
- [ ] `npm run compile` passes in vsix/
- [ ] `npm run build` passes in webview/
- [ ] `npm run test:unit` passes in vsix/
