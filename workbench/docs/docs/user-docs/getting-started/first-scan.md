---
title: First Scan
sidebar_position: 2
---

# Run Your First Scan

Scan your project to find security issues. ASH Workbench runs the ASH CLI against your code and imports the results for review.

## Start a scan

1. Open a workspace folder in VS Code.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Type **ASH: Start Scan** and select it.
4. Choose a scan target:
   - **Workspace root** — scans the entire workspace
   - **Browse...** — pick any directory
5. The scan starts. Progress appears in the sidebar with elapsed time.

You can also click **Scan Workspace** in the ASH sidebar to scan the workspace root directly.

:::info
Only one scan can run at a time. To cancel a running scan, use the **ASH: Cancel Scan** command or click the cancel button in the sidebar.
:::

## Watch scan progress

While a scan runs:

- The sidebar shows a pulsing indicator with elapsed time
- The **ASH** Output Channel shows detailed CLI output (open it from **View > Output**, then select **ASH** from the dropdown)
- The editor panel shows a scan progress view if open

## Review the results

When the scan completes:

1. The sidebar updates with a severity breakdown showing how many findings were detected at each level (Critical, High, Medium, Low, Info).
2. Click **View Dashboard** in the sidebar or use **ASH: Open Workbench** from the Command Palette to open the main panel.
3. The dashboard shows summary cards with total findings, scan targets, and triage progress.
4. Click a scan target card or click **View Findings** to see the full finding list.

## Understand what you see

Each finding represents a security issue detected by one of the ASH scanners (Bandit, Semgrep, Checkov, and others). Findings include:

- **Severity** — Critical, High, Medium, Low, or Info
- **Title** — A short description of the issue
- **File and line** — Where the issue was found in your code
- **Scanner** — Which tool detected it (e.g., Bandit for Python, Semgrep for pattern matching)
- **Rule ID** — The specific rule that triggered (e.g., `B101`, `CKV_AWS_18`)

## What to do next

Now that you have scan results, you can:

- [Navigate and filter findings](../findings/navigating-findings.md) to focus on what matters
- [View finding details](../findings/finding-details.md) including code snippets
- [Triage findings](../findings/triaging-findings.md) by marking them as Fix, Suppress, or Defer
