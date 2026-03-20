---
title: Installation
sidebar_position: 1
---

# Installation

Install the ASH CLI and the ASH Workbench VS Code extension to start scanning your code for security issues.

## Prerequisites

You need two things before using ASH Workbench:

1. **VS Code** version 1.110.0 or later
2. **ASH CLI** — the Automated Security Helper command-line tool

### Install the ASH CLI

ASH is a Python package. Install it with pip, pipx, or uvx:

```bash
pip install automated-security-helper
```

Verify the installation:

```bash
ash --version
```

If you install ASH in a non-standard location, note the full path — you will need it to configure the extension.

:::tip
If you plan to run scans in container mode (using Docker), make sure Docker is installed and running on your machine.
:::

## Install ASH Workbench

<!-- TODO: Update installation method when published to marketplace -->

Install the ASH Workbench extension in VS Code. After installation, the ASH icon appears in the Activity Bar on the left side of VS Code.

## Configure the ASH path

If the `ash` command is on your system PATH, ASH Workbench finds it automatically. If not, point the extension to your ASH installation:

1. Open VS Code Settings (`Ctrl+,` / `Cmd+,`).
2. Search for **ASH Workbench**.
3. Set **Ash Path** to the full path of the ASH executable (e.g., `/usr/local/bin/ash`).

## Verify the setup

1. Open a workspace folder in VS Code.
2. Click the ASH icon in the Activity Bar to open the sidebar.
3. Click **Scan Workspace** in the sidebar.

If the scan starts and you see progress in the sidebar, you are ready to go. If you see an error, check [Troubleshooting](../troubleshooting.md).

## Next steps

- [Run your first scan](first-scan.md)
