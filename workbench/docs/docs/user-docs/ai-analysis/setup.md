---
title: Setup
sidebar_position: 1
---

# AI Analysis Setup

Configure ASH Workbench to use Claude for AI-powered finding analysis. You need access to a Claude model through either AWS Bedrock or the Anthropic API.

## Provider options

| Provider | Setting value | What you need |
|----------|--------------|---------------|
| **AWS Bedrock** | `bedrock` | An AWS account with Bedrock model access enabled for Claude |
| **Anthropic API** | `anthropic-api` | An Anthropic API key |

For instructions on setting up AWS Bedrock access or obtaining an Anthropic API key, refer to the [AWS Bedrock documentation](https://docs.aws.amazon.com/bedrock/) and [Anthropic API documentation](https://docs.anthropic.com/) respectively.

## Inherit from Claude Code

If you use [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and have a `~/.claude/settings.json` file, ASH Workbench can inherit your provider, region, model, and AWS profile settings automatically.

This is enabled by default (`ashWorkbench.llm.useClaudeSettings` is `true`). When enabled, ASH Workbench reads your Claude Code settings and uses them as defaults. Any ASH Workbench-specific settings you configure act as overrides.

## Configure manually

To configure AI settings without Claude Code:

1. Open VS Code Settings (`Ctrl+,` / `Cmd+,`).
2. Search for **ASH Workbench LLM**.
3. Set the following:

| Setting | Required | Description |
|---------|----------|-------------|
| **Provider** | Yes | `bedrock` or `anthropic-api` |
| **Region** | For Bedrock | AWS region (e.g., `us-east-1`) |
| **Model Id** | No | Model identifier. Leave empty for the default. |
| **Aws Profile** | For Bedrock | AWS CLI profile name for credentials |

Or add to your `settings.json`:

```json
{
  "ashWorkbench.llm.provider": "bedrock",
  "ashWorkbench.llm.region": "us-east-1",
  "ashWorkbench.llm.awsProfile": "my-profile"
}
```

## Budget and limits

Control costs and behavior with these settings:

| Setting | Default | Description |
|---------|---------|-------------|
| **Max Budget Usd** | `1.00` | Maximum cost in USD per individual analysis. Analysis stops if this limit is reached. |
| **Max Turns** | `15` | Maximum reasoning iterations per analysis. Higher values allow deeper analysis but cost more. |
| **Tool Mode** | `read-only` | What the AI can access. `read-only` allows file reading and searching. `full` also allows file editing and shell commands. |
| **Batch Consecutive Failure Limit** | `3` | How many consecutive failures before batch analysis stops. Resets to zero after each success. |

## Safety guardrails

ASH Workbench automatically prevents the AI agent from accessing sensitive files or running dangerous commands during analysis:

- **Sensitive files blocked:** `.env*`, `credentials*`, `*.pem`, `*.key`, `secrets.*`, and `.aws/` paths are never read by the AI agent.
- **Dangerous commands blocked:** In `full` tool mode, destructive commands (`rm -rf`, `DROP TABLE`, `DELETE FROM`, `format`, `mkfs`) are denied.

Blocked operations appear in the analysis progress as "Blocked: attempted to read .env" and are logged to the **ASH** Output Channel. No configuration is needed — guardrails are always active.

## AWS credential refresh

If your AWS credentials expire periodically (e.g., SSO sessions), you can configure a shell command to refresh them:

Set `ashWorkbench.llm.awsAuthRefresh` to a command that refreshes your credentials (e.g., `aws sso login --profile my-profile`).

:::warning
This setting is restricted to **User settings only** (not Workspace settings) for security reasons. It cannot be set per-project.
:::

## Test the connection

Verify that your AI configuration works:

1. Open the ASH sidebar.
2. In the **AI Analysis** section, click **Test AI Connection**.
3. A success message shows the model name and response time, or an error message indicates what went wrong.

You can also test from the dashboard in the editor panel.

## Troubleshooting AI setup

**"No AI provider configured"** — Set `ashWorkbench.llm.provider` to `bedrock` or `anthropic-api`.

**"Access denied" or credential errors with Bedrock** — Verify your AWS profile has Bedrock model access enabled for Claude. Check that your credentials are current.

**"Invalid API key" with Anthropic API** — Verify your API key is correct and active.

**Connection test succeeds but analysis fails** — Check the budget setting. If `ashWorkbench.llm.maxBudgetUsd` is too low, analysis may be cut short.
