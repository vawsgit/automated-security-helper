---
title: Triaging Findings
sidebar_position: 3
---

# Triaging Findings

Triage each finding by assigning a disposition that records your decision about how to handle it. Dispositions help you track progress and communicate intent to your team.

## Dispositions

Every finding starts as **Pending** and can be set to one of four dispositions:

| Disposition | Meaning | When to use |
|-------------|---------|-------------|
| **Pending** | Not yet reviewed | Default state for all new findings |
| **Fix** | Will be fixed | You plan to change code to resolve this issue |
| **Suppress** | Intentionally accepted | The finding is a false positive or an accepted risk. Managed via `.ash.yaml`. |
| **Defer** | Address later | Not fixing now, but not permanently accepting the risk |

## Set a disposition on a single finding

1. Open a finding from the [finding list](navigating-findings.md).
2. In the **Disposition** section, click the button for the desired disposition (**Pending**, **Fix**, or **Defer**).
3. The disposition updates immediately.

:::info
The **Suppress** button in the triage controls is disabled. To suppress a finding, use the suppression form at the bottom of the finding detail. Suppression requires creating a rule in `.ash.yaml` with a justification. See [Creating Suppressions](../suppressions/creating-suppressions.md).
:::

## Set dispositions in batch

1. In the finding list, select multiple findings using the checkboxes.
2. A batch action bar appears at the bottom.
3. Click **Set Disposition** and choose the desired disposition.
4. All selected findings are updated.

## Add triage notes

Each finding has a **Notes** text area where you can add context about your triage decision. Notes are free-text and are saved automatically as you type.

Use notes to record:
- Why you chose a particular disposition
- What fix you plan to apply
- Who is responsible for addressing the finding
- Any additional context for reviewers

## Track triage progress

The sidebar and dashboard show triage progress:

- **Triage count** — "X of Y triaged" with a percentage
- **Progress bar** — color-coded segments for each disposition (teal for Fix, indigo for Suppress, slate for Defer)
- **Disposition badges** — counts for each disposition

A finding is considered "triaged" when its disposition is anything other than Pending.
