---
title: .ash.yaml Reference
sidebar_position: 2
---

# .ash.yaml Reference

The `.ash.yaml` file (also `.ash.yml` or `.ash.json`) stores suppression rules and scan configuration for your project. ASH Workbench reads and writes this file automatically through the suppression manager and finding detail views.

## File location

Place `.ash.yaml` at the root of your scan directory (the workspace root or the configured scan root). ASH Workbench watches this file for changes and updates the UI automatically.

## File structure

```yaml
# Project identification (optional)
project_name: "my-project"

# Severity threshold (optional)
severity_threshold: "MEDIUM"

# Enabled scanners (optional)
enabled_scanners:
  - bandit
  - semgrep
  - checkov

# Suppression rules
suppressions:
  - path: "src/auth.py"
    rule_id: "B101"
    reason: "Assert used in test helper, not production code"
    lines:
      start: 42
      end: 42
    expires: "2025-12-31"

  - path: "**/*.py"
    rule_id: "B105"
    reason: "Hardcoded password is a test fixture"

  - path: "src/generated.py"
    reason: "Auto-generated file, all findings accepted"

# Paths to exclude from scanning
ignore_paths:
  - path: "node_modules/**"
    reason: "Third-party dependencies"
  - path: "dist/**"
    reason: "Build output"
```

## Suppression rule fields

Each entry under `suppressions:` accepts these fields:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `path` | Yes | string | File path or glob pattern to match. Use `**` for recursive matching. |
| `rule_id` | No | string | Scanner rule ID to suppress (e.g., `B101`, `CKV_AWS_18`). Omit to suppress all rules for the path. |
| `reason` | Yes | string | Justification for the suppression. |
| `lines` | No | object | Line range restriction. Has `start` and `end` integer fields. |
| `expires` | No | string | Expiration date in `YYYY-MM-DD` format. After this date, the suppression is marked as expired. |

### Path patterns

- **Exact file:** `src/auth.py` — matches only that file
- **Glob pattern:** `**/*.py` — matches all Python files in any directory
- **Directory glob:** `src/generated/**` — matches everything under a directory

### Rule ID matching

- **With `rule_id`:** Only findings from that specific rule are suppressed
- **Without `rule_id`:** All findings in the matched files are suppressed

### Line ranges

When `lines` is specified, only findings within the given line range are suppressed. Both `start` and `end` are inclusive.

```yaml
lines:
  start: 10
  end: 25
```

## Ignore paths

Entries under `ignore_paths:` tell ASH to skip scanning those directories or files entirely. Unlike suppressions, ignored paths prevent findings from being generated at all.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `path` | Yes | string | Path or glob pattern to exclude from scanning |
| `reason` | No | string | Why this path is excluded |
| `expires` | No | string | Expiration date in `YYYY-MM-DD` format |

## Configuration fields

| Field | Type | Description |
|-------|------|-------------|
| `project_name` | string | Project identifier (informational) |
| `severity_threshold` | string | Minimum severity to report (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`) |
| `enabled_scanners` | list of strings | Which scanners to run (e.g., `bandit`, `semgrep`, `checkov`) |

## Editing

You can edit `.ash.yaml` directly in VS Code or use the [Suppression Manager](../suppressions/managing-suppressions.md) for a guided interface. Changes made in either location are automatically synchronized.
