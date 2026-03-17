# Quickstart: Finding Detail & Code Navigation

**Branch**: `008-finding-detail-navigation` | **Date**: 2026-03-17

## What This Feature Does

When you click a finding in the findings list, full details load from the database. When you click a file path in the detail view, the source file opens in your editor at the correct line.

## Developer Setup

No additional setup needed beyond the standard development environment:

```bash
cd workbench/vsix
npm run compile   # Verify clean build
npm run test      # Verify all tests pass
```

## Verifying the Feature

### Scenario 1: Finding Detail Loads from Database

1. Press F5 to launch the extension development host
2. Run a scan against a project with known findings (`Cmd+Shift+P` > "ASH: Start Scan")
3. Wait for the scan to complete
4. Open the findings panel (click a scan in the tree view)
5. Click any finding in the list
6. **Verify**: The detail view populates with all fields (severity, title, description, rule ID, scanner, file, lines, snippet, disposition)
7. **Verify**: The data matches what the SARIF file contained

### Scenario 2: Code Navigation Opens File

1. From a finding detail view (Scenario 1), click the file path
2. **Verify**: The file opens in the editor
3. **Verify**: The cursor is positioned at the finding's start line
4. **Verify**: The line is visible (scrolled into view)

### Scenario 3: Missing File Handling

1. Run a scan, then delete one of the scanned files
2. Open the finding that references the deleted file
3. Click the file path
4. **Verify**: A message appears saying "File not found: /path/to/deleted/file"

### Scenario 4: Non-Existent Finding ID

1. This is a programmatic edge case tested by unit tests
2. **Verify**: `getFindingDetail('non-existent-id')` returns `null`
3. **Verify**: No unhandled exceptions

## Files Modified

| File | Change |
|------|--------|
| `vsix/src/services/findings.ts` | Add `getFindingDetail()` method |
| `vsix/src/providers/findingsPanelManager.ts` | Replace inline DB call with service call |
| `vsix/src/test/unit/findings.test.ts` | Add tests for `getFindingDetail()` |
