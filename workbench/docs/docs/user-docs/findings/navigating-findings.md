---
title: Navigating Findings
sidebar_position: 1
---

# Navigating Findings

Review scan results in a filterable, sortable table. Focus on the findings that matter most by applying filters for severity, disposition, scanner, and text search.

## Open the finding list

1. Open the Workbench panel using **ASH: Open Workbench** from the Command Palette, or click **View Dashboard** in the sidebar.
2. From the dashboard, click a **scan target card** to see findings for that target, or click **View Findings** to see all findings.

The finding list shows a header with total and filtered counts (e.g., "42 total · 15 shown").

## Finding list columns

| Column | What it shows |
|--------|--------------|
| **Checkbox** | Select findings for batch actions |
| **Severity** | Icon and label (Critical, High, Medium, Low, Info) |
| **Title** | Short description of the issue |
| **File** | File path and line number (e.g., `src/auth.py:42`) |
| **Scanner** | Which tool detected it (e.g., Bandit, Semgrep) |
| **Status** | Disposition (Pending, Fix, Suppress, Defer) with a "Suppressed" badge if an active `.ash.yaml` rule applies |

Click any column header to sort by that column. Click again to reverse the sort order.

## Filter findings

Use the filter toolbar above the table to narrow results:

- **Text search** — Type in the search box to filter by finding title or file path
- **Severity** — Select one or more severity levels. Facet counts show how many findings match each level.
- **Status** — Filter by disposition (Pending, Fix, Suppress, Defer)
- **Scanner** — Filter by scanner tool

Active filters show a count badge. Click the **Reset** button to clear all filters.

### Show or hide suppressed findings

Findings with an active `.ash.yaml` suppression are dimmed in the list by default. Use the **Show/Hide suppressed** toggle on the right side of the filter bar to include or exclude them.

## Select findings for batch actions

1. Check the checkbox in the row for each finding, or use the header checkbox to select all visible findings.
2. A sticky bar appears at the bottom showing the selected count.
3. Choose a batch action:
   - **Set Disposition** — Apply Fix, Suppress, Defer, or Reset to Pending to all selected findings
   - **Deselect All** — Clear the selection

## View a finding

Click any row in the finding list to open its [detail view](finding-details.md).

## Navigate between findings

In the finding detail view, use the **Previous** and **Next** arrows to step through findings without returning to the list.
