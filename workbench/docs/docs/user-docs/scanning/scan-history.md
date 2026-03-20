---
title: Scan History
sidebar_position: 2
---

# Scan History

ASH Workbench stores every scan you run. Use scan history to review past results, rescan targets, or clean up old data.

## View scan history

The scan history tree view in the sidebar lists all past scans grouped by scan target (the directory that was scanned). Each scan shows:

- **Timestamp** — when the scan ran
- **Status** — completed, failed, cancelled, or running
- **Finding count** — how many issues were detected
- **Severity breakdown** — counts per severity level

Click any scan in the tree to load its findings in the editor panel.

## Scan targets

Each directory you scan becomes a **scan target**. The dashboard groups findings and scans by target. You can:

- Click a scan target card on the dashboard to filter findings to that target
- Choose a previous target when starting a new scan to rescan it

## Delete a scan

To remove a scan and all its findings:

1. Find the scan in the sidebar tree view.
2. Right-click it and select **Delete Scan**, or use the Command Palette: **ASH: Delete Scan**.
3. Confirm the deletion.

Deleting a scan permanently removes all its findings from the database. This cannot be undone.

## Scan statuses

| Status | Meaning |
|--------|---------|
| **Completed** | Scan finished successfully. Findings are available for review. |
| **Failed** | Scan encountered an error (CLI crash, timeout, ASH not found). Check the ASH Output Channel for details. |
| **Cancelled** | You cancelled the scan before it finished. |
| **Running** | Scan is currently in progress. |

If VS Code closes while a scan is running, the scan is automatically marked as failed the next time the extension activates.
