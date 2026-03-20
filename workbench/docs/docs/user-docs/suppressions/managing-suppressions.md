---
title: Managing Suppressions
sidebar_position: 2
---

# Managing Suppressions

View, edit, and remove suppression rules from a central manager. The suppression manager shows all rules in your `.ash.yaml` file and their current status.

## Open the suppression manager

Use any of these methods:

- Command Palette: **ASH: Manage Suppressions**
- Dashboard: click **Manage Suppressions** in the quick actions
- Sidebar: click the **Suppressions** button (shows the rule count)

## Suppression summary

The manager shows four summary cards at the top:

| Card | Meaning |
|------|---------|
| **Total** | Total number of suppression rules in `.ash.yaml` |
| **Active** | Rules that match at least one finding in the current scan |
| **Unused** | Rules that do not match any current findings (may be outdated) |
| **Expired** | Rules whose expiration date has passed |

## View suppression rules

The suppression table lists each rule with:

- **Path** — the file pattern the rule applies to
- **Rule ID** — the scanner rule being suppressed (blank if all rules for that path)
- **Reason** — the justification text
- **Status** — Active, Unused, or Expired
- **Match count** — how many current findings this rule matches

## Edit a suppression

1. Click the **Edit** action on a suppression rule.
2. An inline form appears where you can change:
   - Justification text
   - Expiration date
3. Click **Save** to update the rule in `.ash.yaml`.

:::info
You cannot change a suppression's path, rule ID, or line range through the edit form. To change these, remove the existing suppression and create a new one.
:::

## Remove a suppression

1. Click the **Remove** action on a suppression rule.
2. Confirm the deletion.
3. The rule is removed from `.ash.yaml`.

When a suppression is removed, affected findings revert to the **Pending** disposition.

## Add a suppression rule directly

Click the **Add Suppression** button in the suppression manager header to create a new rule. The form lets you specify:

- **Path** — file path or glob pattern (e.g., `src/main.ts` or `**/*.py`)
- **Rule ID** — optional scanner rule ID (e.g., `B101`, `CKV_AWS_18`)
- **Reason** — justification (required)
- **Line range** — optional start and end line numbers
- **Expiration** — optional date

Path and rule ID fields offer autocomplete based on known file paths and rule IDs from your scan results.

## Scan exclusions

If your `.ash.yaml` includes `ignore_paths`, they appear in a **Scan Exclusions** section below the suppression table. These are read-only — scan exclusions must be edited directly in the `.ash.yaml` file.

## Configuration info

A collapsible **Configuration** section shows settings from your `.ash.yaml`:

- Project name
- Severity threshold
- Enabled scanners

These are also read-only in the manager.

## Edit `.ash.yaml` directly

Click the `.ash.yaml` link at the top of the suppression manager to open the file in the VS Code editor. You can edit the YAML directly — changes are detected and reflected in the suppression manager automatically.

See [`.ash.yaml` Reference](../configuration/ash-yaml-reference.md) for the file format.
