---
title: Settings Reference
sidebar_position: 1
---

# Settings Reference

All ASH Workbench settings are configured in VS Code Settings (`Ctrl+,` / `Cmd+,`). Search for "ASH Workbench" to see all options, or add them to your `settings.json` directly.

## General Settings

### `ashWorkbench.ashPath`

**Type:** string
**Default:** `"ash"`

Path to the ASH CLI executable. If ASH is installed globally and on your PATH, the default `"ash"` works. Set this to a full path if ASH is installed in a non-standard location.

```json
"ashWorkbench.ashPath": "/usr/local/bin/ash"
```

### `ashWorkbench.ashMode`

**Type:** string (enum: `"local"`, `"container"`)
**Default:** `"local"`

ASH execution mode. `local` runs ASH directly on your machine. `container` runs ASH inside a Docker container (requires Docker).

### `ashWorkbench.scanRoot`

**Type:** string
**Default:** `""` (empty — uses workspace root)
**Scope:** Resource (per-folder)

Root directory for ASH scans. Leave empty to use the workspace root. Must be an absolute path when set. Suppressions in `.ash.yaml` are resolved relative to this directory.

```json
"ashWorkbench.scanRoot": "/home/user/project/src"
```

### `ashWorkbench.scanTimeout`

**Type:** number
**Default:** `600`
**Minimum:** `30`

Scan timeout in seconds. If a scan takes longer than this, the ASH CLI process is terminated and the scan is marked as failed.

### `ashWorkbench.defaultSeverityThreshold`

**Type:** string (enum: `"CRITICAL"`, `"HIGH"`, `"MEDIUM"`, `"LOW"`, `"INFO"`)
**Default:** `"LOW"`

Default severity threshold for filtering scan results. Findings below this severity level can be hidden from the finding list using the severity filter.

## AI / LLM Settings

All AI settings are under the `ashWorkbench.llm.*` namespace.

### `ashWorkbench.llm.provider`

**Type:** string (enum: `"bedrock"`, `"anthropic-api"`)
**Default:** `""` (empty — inherits from Claude Code settings)

LLM provider for AI-assisted analysis. Leave empty to inherit from Claude Code settings when `useClaudeSettings` is true.

### `ashWorkbench.llm.useClaudeSettings`

**Type:** boolean
**Default:** `true`

Inherit LLM configuration from Claude Code settings (`~/.claude/settings.json`). When true, provider, region, model, and AWS profile settings are read from Claude Code. ASH Workbench-specific settings act as overrides only.

### `ashWorkbench.llm.region`

**Type:** string
**Default:** `""` (empty — inherits from Claude Code settings)

AWS region for the LLM provider (e.g., `us-east-1`). Only applies when using the `bedrock` provider. Leave empty to inherit from Claude Code settings.

### `ashWorkbench.llm.modelId`

**Type:** string
**Default:** `""` (empty — inherits from Claude Code settings)

LLM model identifier. Leave empty to use the default model for your provider. When using Bedrock, this is the Bedrock model ID.

### `ashWorkbench.llm.awsProfile`

**Type:** string
**Default:** `""` (empty — inherits from Claude Code settings)

AWS CLI profile name for the LLM provider. Leave empty to use the default profile or inherit from Claude Code settings.

### `ashWorkbench.llm.maxBudgetUsd`

**Type:** number
**Default:** `1.00`
**Minimum:** `0.01`

Maximum cost in USD allowed per individual AI analysis. Analysis stops if this limit is reached.

### `ashWorkbench.llm.maxTurns`

**Type:** number
**Default:** `15`
**Minimum:** `1`
**Maximum:** `50`

Maximum reasoning iterations per AI analysis. Higher values allow deeper analysis but cost more. Lower values produce faster, less detailed results.

### `ashWorkbench.llm.toolMode`

**Type:** string (enum: `"read-only"`, `"full"`)
**Default:** `"read-only"`

Tool access level for AI analysis. `read-only` allows the AI to read files and search code. `full` also allows file editing and shell commands.

:::warning
The `full` tool mode gives the AI agent write access to your filesystem. Use with caution and only when you need the AI to suggest concrete code changes.
:::

### `ashWorkbench.llm.awsAuthRefresh`

**Type:** string
**Default:** `""` (empty)
**Scope:** Application (user settings only)

Shell command to refresh AWS credentials before AI analysis. Useful for SSO-based authentication where credentials expire periodically.

:::warning
This setting is restricted to user settings only (not workspace settings) for security. It cannot be set per-project.
:::

### `ashWorkbench.llm.batchConsecutiveFailureLimit`

**Type:** number
**Default:** `3`
**Minimum:** `1`
**Maximum:** `100`

Maximum consecutive AI analysis failures before batch processing stops. Resets to zero after each successful analysis. Prevents runaway failures during batch analysis.
