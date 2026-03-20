---
title: Running Scans
sidebar_position: 1
---

# Running Scans

Scan any directory in your workspace to detect security issues. ASH Workbench spawns the ASH CLI, parses the SARIF output, and stores findings in a local database.

## Start a scan

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Type **ASH: Start Scan** and select it.
3. Choose a target directory:
   - **Workspace root** — scans the entire workspace (or the configured scan root)
   - **A previous target** — rescans a directory you scanned before
   - **Browse...** — pick any directory using the file picker

Alternatively, click **Scan Workspace** in the ASH sidebar to scan the workspace root.

:::info
Only one scan can run at a time. Starting a new scan while one is in progress is not allowed.
:::

## Monitor progress

While a scan is running:

- The **sidebar** shows a pulsing yellow indicator with elapsed time and a cancel button
- The **editor panel** shows a scan progress view (if the Workbench panel is open)
- The **ASH Output Channel** shows real-time CLI output — open it from **View > Output** and select **ASH** from the dropdown

## Cancel a scan

To stop a running scan:

- Click the **Cancel** button in the sidebar scan indicator, or
- Use the Command Palette: **ASH: Cancel Scan**

Cancelled scans are marked in the scan history. Any findings already detected before cancellation are not saved.

## Scan modes

ASH Workbench supports two scan modes:

| Mode | Setting value | What it does |
|------|--------------|---------------|
| **Local** | `local` | Runs ASH CLI directly on your machine. Requires ASH and its scanner dependencies installed locally. |
| **Container** | `container` | Runs ASH inside a Docker container. Requires Docker to be installed and running. |

Set the mode in VS Code Settings under **ASH Workbench > Ash Mode**, or set `ashWorkbench.ashMode` in `settings.json`.

## Scan root

By default, ASH Workbench scans your workspace root. To scan a specific subdirectory:

1. Open VS Code Settings (`Ctrl+,` / `Cmd+,`).
2. Search for **ASH Workbench Scan Root**.
3. Enter the absolute path to the directory you want to scan.

When a scan root is configured, the **Scan Workspace** button scans that directory instead of the workspace root. Suppression rules in `.ash.yaml` are also resolved relative to the scan root.

## Scan timeout

Scans have a configurable timeout (default: 600 seconds / 10 minutes). If a scan exceeds the timeout, the ASH CLI process is terminated and the scan is marked as failed.

Adjust the timeout in VS Code Settings under **ASH Workbench > Scan Timeout**, or set `ashWorkbench.scanTimeout` in `settings.json`. The minimum is 30 seconds.
