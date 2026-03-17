# Quickstart: Settings, Admin & Application Lifecycle

## Verification Scenarios

### Scenario 1: Settings Visibility (US1)

1. Open VS Code with the ASH Workbench extension installed
2. Open Settings (Cmd+,) and type "ASH Workbench" in the search bar
3. Verify ALL of these settings appear with correct defaults:
   - ASH Path: "ash"
   - ASH Mode: "local" (dropdown with local, container)
   - Scan Timeout: 600 (minimum 30)
   - Default Severity Threshold: "LOW" (dropdown with CRITICAL, HIGH, MEDIUM, LOW, INFO)
   - LLM Provider: "bedrock" (dropdown)
   - LLM Region: "us-east-1"
   - LLM Model ID: "anthropic.claude-sonnet-4-20250514"

### Scenario 2: Settings Are Read by Scanner (US1)

1. Change "ASH Path" to a non-existent path like "/tmp/fake-ash"
2. Start a scan via the command palette (ASH: Start Scan)
3. Verify the error message references "/tmp/fake-ash" (proving the setting was read)
4. Reset the path to "ash"

### Scenario 3: Application Reset (US2)

1. Run a scan to populate some data
2. Verify scans appear in the tree view and sidebar
3. Open command palette and run "ASH: Reset Application"
4. Verify a modal warning dialog appears asking for confirmation
5. Click "Reset"
6. Verify VS Code window reloads
7. After reload, verify the scan history tree is empty and the sidebar dashboard shows zero counts

### Scenario 4: Reset Blocked During Scan (US2)

1. Start a scan
2. While the scan is running, run "ASH: Reset Application"
3. Verify the extension shows a warning message: "Cannot reset while a scan is running. Cancel the scan first."
4. The reset does NOT proceed

### Scenario 5: Application Info (US3)

1. Run a scan to populate data
2. Request application info from the WebView (sidebar admin section)
3. Verify the response shows:
   - Extension version matching package.json version
   - Schema version (name of the latest applied migration)
   - Project count: 1
   - Scan count: >= 1
   - Finding count: matches actual data

### Scenario 6: Migration on Activation (US4)

This scenario requires simulating an older schema, which is difficult in a normal extension host environment. Verified through unit tests:
1. Unit test creates a DB with migration N-1 applied
2. Calls DatabaseService.initialize() which runs pending migrations
3. Verifies migration N is now applied
4. Verifies existing data is preserved

### Scenario 7: Reset Cancellation (US2)

1. Run "ASH: Reset Application"
2. When the confirmation dialog appears, click "Cancel"
3. Verify all data is still intact — scans, findings, and triage are unchanged
