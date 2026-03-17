# Quickstart: Finding Triage

**Branch**: `009-finding-triage` | **Date**: 2026-03-17

## What This Feature Does

Disposition changes and triage notes are persisted to the database. When you set a finding's disposition to Fix, Suppress, or Defer, the choice survives extension reloads. Notes attached to findings are also saved.

## Developer Setup

After pulling the branch, regenerate the Prisma client (schema has a new `notes` column):

```bash
cd workbench/vsix
npx prisma generate
npx prisma db push
npm run compile
npm run test
```

## Verifying the Feature

### Scenario 1: Disposition Persists Across Reload

1. Press F5 to launch the extension development host
2. Run a scan against a project with findings
3. Click a finding in the list to open the detail view
4. Set the disposition to "Fix"
5. **Verify**: The finding list shows "Fix" immediately
6. **Verify**: The summary bar counts update (Pending -1, Fix +1)
7. Close the extension development host
8. Press F5 again to relaunch
9. Open the same finding
10. **Verify**: The disposition still shows "Fix"

### Scenario 2: All Dispositions Work

1. From a finding detail, cycle through all four dispositions: Pending, Fix, Suppress, Defer
2. **Verify**: Each transition succeeds with no errors
3. **Verify**: Summary bar counts are correct after each change

### Scenario 3: Notes Persist Across Reload

1. Select a finding and type a note: "Accepted risk per security review"
2. Click away (blur the notes field)
3. **Verify**: No errors in the console
4. Close and reopen the extension
5. Open the same finding
6. **Verify**: The note text is still there

### Scenario 4: Error Handling

1. This is a programmatic edge case tested by unit tests
2. **Verify**: `setDisposition('non-existent-id', 'FIX')` throws a Prisma error
3. **Verify**: The error is caught and logged, no crash

## Files Modified

| File | Change |
|------|--------|
| `vsix/prisma/schema.prisma` | Add `notes String?` to Finding model |
| `vsix/src/services/findings.ts` | Add `setDisposition()` and `setNotes()` methods |
| `vsix/src/providers/findingsPanelManager.ts` | Route setDisposition through service, add setNotes handler |
| `vsix/src/models/messages.ts` | Add `setNotes` and `notesUpdated` message types |
| `vsix/src/models/mappers.ts` | Read `notes` from DB instead of hardcoded `''` |
| `vsix/src/test/unit/findings.test.ts` | Add tests for setDisposition and setNotes |
| `webview/src/types/messages.ts` | Mirror new message types |
