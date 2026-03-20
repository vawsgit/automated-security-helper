---
title: Overview
---

# Suppressions

Suppressions let you mark findings as intentionally accepted. When you suppress a finding, ASH Workbench creates a rule in a `.ash.yaml` file at your scan root. These rules persist across scans and can be shared with your team through version control.

Suppressions are for findings that are false positives, accepted risks, or not applicable to your project. Use them instead of simply ignoring findings — each suppression requires a justification.

- [Creating Suppressions](creating-suppressions.md) — Add suppression rules from finding details
- [Managing Suppressions](managing-suppressions.md) — View, edit, and remove suppression rules
