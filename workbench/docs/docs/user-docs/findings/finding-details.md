---
title: Finding Details
sidebar_position: 2
---

# Finding Details

The finding detail view shows everything about a single finding — what the issue is, where it appears in your code, its triage status, AI analysis, and suppression state.

## Open a finding

Click any row in the [finding list](navigating-findings.md) to open its detail view. A breadcrumb trail at the top shows your navigation path (Dashboard > Findings > Finding Title).

## What you see

### Header

- **Severity badge** and **title** at the top
- **Metadata row** with:
  - Rule ID (e.g., `B101`)
  - Scanner name (e.g., Bandit)
  - First detected date
  - Current disposition badge
  - "Suppressed via .ash.yaml" badge (if an active suppression applies)

### Disposition and notes

- Four triage buttons: **Pending**, **Fix**, **Suppress**, **Defer**
- A notes text area for your comments about this finding

See [Triaging Findings](triaging-findings.md) for details on dispositions.

### Description

A paragraph explaining the security issue and why it matters.

### Code location

- **Clickable file path** — click it to open the file in the VS Code editor at the relevant line
- **Line numbers** — the specific line range where the issue was found
- **Code snippet** — a syntax-highlighted block showing the affected code with the relevant lines highlighted

### AI Analysis

If configured, you can analyze the finding with AI. See [Analyzing Findings](../ai-analysis/analyzing-findings.md) for details.

### Suppression

If the finding is suppressed via `.ash.yaml`, this section shows the suppression details including justification, expiration, and the YAML entry. If not suppressed, a **Suppress Finding** button lets you create a new suppression rule.

See [Creating Suppressions](../suppressions/creating-suppressions.md) for the suppression workflow.

## Navigate to source code

Click the **file path link** or the **Open in Editor** button to jump to the exact location in your code where the issue was found. VS Code opens the file and scrolls to the relevant line.

## Navigate between findings

Use the **Previous** (left arrow) and **Next** (right arrow) buttons in the header to step through findings without going back to the list.
