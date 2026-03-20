---
title: Troubleshooting
sidebar_position: 7
---

# Troubleshooting

Common problems and solutions when using ASH Workbench.

## Scan issues

### Scan fails to start — "ASH CLI not found"

**Problem:** You see an error that the ASH CLI was not found at the configured path.

**Cause:** ASH is not installed, not on your PATH, or the `ashWorkbench.ashPath` setting points to the wrong location.

**Solution:**
1. Verify ASH is installed: run `ash --version` in a terminal.
2. If ASH is installed but not on your PATH, set `ashWorkbench.ashPath` to the full path (e.g., `/usr/local/bin/ash`).
3. If ASH is not installed, install it: `pip install automated-security-helper`.

### Scan fails — "No workspace folder open"

**Problem:** The scan command does nothing or shows an error about no workspace.

**Cause:** ASH Workbench requires an open workspace folder. It cannot scan without one.

**Solution:** Open a folder in VS Code using **File > Open Folder**.

### Scan times out

**Problem:** The scan fails after a long wait with a timeout error.

**Cause:** The ASH CLI did not finish within the configured timeout (default: 600 seconds).

**Solution:**
- Increase `ashWorkbench.scanTimeout` in settings (value is in seconds).
- Scan a smaller directory instead of the full workspace.
- Check that the ASH CLI is not stuck — open the **ASH** Output Channel (**View > Output** > select **ASH**) to see CLI output.

### Scan fails with container mode errors

**Problem:** Scan fails when `ashWorkbench.ashMode` is set to `container`.

**Cause:** Docker is not running or not installed.

**Solution:**
1. Verify Docker is installed and running: `docker info` in a terminal.
2. Ensure your user has permission to run Docker commands.
3. Try `local` mode instead if you have ASH scanner dependencies installed locally.

## Finding issues

### No findings appear after a successful scan

**Problem:** The scan completes but the finding list is empty.

**Cause:** Either the scan found no issues, or the severity threshold is filtering them out.

**Solution:**
- Check the scan summary in the sidebar — it shows finding counts by severity.
- Lower the `ashWorkbench.defaultSeverityThreshold` setting to `INFO` to show all findings.
- Reset any active filters in the finding list filter toolbar.

### Cannot click file path to navigate to code

**Problem:** Clicking a file path in the finding detail does nothing.

**Cause:** The file may have been moved, renamed, or deleted since the scan.

**Solution:** The file path shown is from the time of the scan. If the file has moved, the navigation link will not work. Rescan the project to get updated file paths.

## Suppression issues

### Suppression write fails

**Problem:** Adding or removing a suppression shows an error.

**Cause:** The `.ash.yaml` file may be locked by another process, or a write conflict was detected (another tool modified the file at the same time).

**Solution:**
- Close any other editors or tools that may have the `.ash.yaml` file open.
- Try the operation again — ASH Workbench retries automatically on conflict detection.
- If the error persists, open `.ash.yaml` manually and check for YAML syntax errors.

### Suppression does not match expected findings

**Problem:** A suppression rule exists but findings are not being suppressed.

**Cause:** The path pattern or rule ID in the suppression may not match the finding.

**Solution:**
- Open the [Suppression Manager](suppressions/managing-suppressions.md) and check the match count for the rule.
- Verify the `path` field matches the finding's file path (paths are relative to the scan root).
- Verify the `rule_id` matches exactly (case-sensitive).
- Check if the suppression has expired.

## AI analysis issues

### "No AI provider configured"

**Problem:** Clicking "Analyze with AI" shows an error about no provider.

**Cause:** No LLM provider is configured.

**Solution:** Set `ashWorkbench.llm.provider` to `bedrock` or `anthropic-api`. See [AI Analysis Setup](ai-analysis/setup.md).

### AI analysis fails with credential errors

**Problem:** Analysis starts but fails with an access denied or authentication error.

**Cause:** AWS credentials are expired or invalid, or the Anthropic API key is wrong.

**Solution:**
- **Bedrock:** Run `aws sts get-caller-identity --profile <your-profile>` to check credentials. If expired, refresh them. Consider setting `ashWorkbench.llm.awsAuthRefresh`.
- **Anthropic API:** Verify your API key is valid.

### AI analysis produces empty or incomplete results

**Problem:** Analysis completes but results are minimal.

**Cause:** The budget or turn limit may be too low.

**Solution:**
- Increase `ashWorkbench.llm.maxBudgetUsd` (default: $1.00).
- Increase `ashWorkbench.llm.maxTurns` (default: 15).

### Batch analysis stops early

**Problem:** Batch analysis stops after a few findings.

**Cause:** Multiple consecutive failures triggered the failure limit.

**Solution:**
- Check the error on the last failed finding to understand the root cause.
- Fix the underlying issue (usually credentials or budget).
- Increase `ashWorkbench.llm.batchConsecutiveFailureLimit` if failures are intermittent.

## General issues

### Extension does not activate

**Problem:** The ASH icon does not appear in the Activity Bar, or commands are not available.

**Cause:** The extension may not be installed correctly, or VS Code may need to be reloaded.

**Solution:**
1. Check that ASH Workbench appears in the Extensions view (**Ctrl+Shift+X** / **Cmd+Shift+X**).
2. If installed, try reloading the window: **Developer: Reload Window** from the Command Palette.

### Reset all data

If ASH Workbench is in a bad state and nothing else works:

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Type **ASH: Reset Application** and select it.
3. Confirm the reset.

This deletes all scan history, findings, and triage data. It does not affect your `.ash.yaml` file or VS Code settings. The window reloads automatically.

:::danger
Application reset is irreversible. All scan history, findings, dispositions, notes, and AI analysis results are permanently deleted.
:::
