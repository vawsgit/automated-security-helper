---
title: Creating Suppressions
sidebar_position: 1
---

# Creating Suppressions

Suppress a finding to mark it as an accepted risk, false positive, or non-applicable issue. Each suppression creates a rule in your `.ash.yaml` file with a justification and optional expiration.

## Suppress from a finding

1. Open a finding from the [finding list](../findings/navigating-findings.md).
2. Scroll to the **Suppress** section at the bottom of the finding detail.
3. Click **Suppress Finding** to open the suppression form.

## Fill in the suppression form

### Scope

Choose how broadly this suppression applies:

| Scope | What it suppresses | Example |
|-------|--------------------|---------|
| **This rule in this file** | Only this specific rule in this specific file | Suppress `B101` in `src/auth.py` only |
| **This rule everywhere** | This rule across all files (uses `**` glob) | Suppress `B101` in every file |
| **All rules in this file** | All rules in this specific file | Suppress everything in `src/generated.py` |

### Justification (required)

Enter a reason for the suppression. This is stored in `.ash.yaml` and visible to your team. Be specific — explain why this finding is acceptable.

Good justifications:
- "False positive — this assert is in test code, not production"
- "Accepted risk — internal-only service behind VPN, no public exposure"
- "Not applicable — this file is auto-generated and overwritten on each build"

### Line range (optional)

If the finding has line information, you can restrict the suppression to a specific line range. Toggle **Restrict to lines X-Y** to enable this. The line range defaults to the finding's location.

### Expiration (optional)

Set an expiration date if the suppression is temporary. After the expiration date, the suppression is marked as expired in the suppression manager.

## Preview and save

Before saving, the form shows a preview of the `.ash.yaml` entry that will be created:

```yaml
suppressions:
  - path: "src/auth.py"
    rule_id: "B101"
    reason: "False positive — assert is in test code only"
    lines:
      start: 42
      end: 42
    expires: "2025-06-01"
```

Click **Add Suppression** to save the rule to `.ash.yaml`. If the file does not exist, it is created automatically.

## What happens after suppressing

- The finding's disposition changes to **Suppress**
- The finding shows a "Suppressed via .ash.yaml" badge
- The finding appears dimmed in the finding list
- The suppression rule is written to `.ash.yaml` at your scan root
- Future scans automatically match the suppression rule against findings
