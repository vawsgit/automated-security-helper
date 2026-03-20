---
title: Understanding Results
sidebar_position: 3
---

# Understanding Results

After a scan completes, ASH Workbench displays findings organized by severity, scanner, and location. This page explains what each piece of information means.

## Severities

Each finding has a severity level indicating its importance:

| Severity | Meaning |
|----------|---------|
| **Critical** | Exploitable vulnerability with severe impact. Address immediately. |
| **High** | Significant security risk. Should be fixed before release. |
| **Medium** | Moderate risk. Plan to address in normal development. |
| **Low** | Minor concern. Fix when convenient. |
| **Info** | Informational note. No immediate action required. |

Severity levels come from the scanner that detected the finding. Different scanners may assign different severities to similar issues.

## Scanners

ASH runs multiple security scanners, each specialized for different languages and patterns:

| Scanner | What it scans |
|---------|--------------|
| **Bandit** | Python code for common security issues |
| **Semgrep** | Multi-language pattern matching for security anti-patterns |
| **Checkov** | Infrastructure-as-code (Terraform, CloudFormation, Kubernetes) |
| **CDK-Nag** | AWS CDK constructs for security best practices |
| **CFN-Nag** | CloudFormation templates |
| **detect-secrets** | Hardcoded secrets and credentials |
| **Grype** | Container image and dependency vulnerabilities |
| **npm-audit** | Node.js dependency vulnerabilities |

Not all scanners run on every scan — ASH selects scanners based on the file types found in your project.

## Rule IDs

Each finding has a **rule ID** that identifies the specific check that triggered it. For example:

- `B101` — Bandit rule for `assert` usage in Python
- `CKV_AWS_18` — Checkov rule for S3 bucket logging
- `javascript.express.security.audit.xss.mustache-escape` — Semgrep rule for XSS

Rule IDs are useful for:

- Looking up documentation about the specific issue
- Creating targeted suppression rules in `.ash.yaml`
- Understanding patterns across multiple findings

## SARIF format

ASH produces scan results in [SARIF](https://sarifweb.azurewebsites.net/) (Static Analysis Results Interchange Format), a standard JSON format for static analysis tools. ASH Workbench parses these SARIF reports automatically — you do not need to interact with the SARIF files directly.

## Severity threshold

You can filter out low-priority findings by setting a severity threshold. Findings below the threshold are hidden from the finding list.

Set the threshold in VS Code Settings under **ASH Workbench > Default Severity Threshold**, or set `ashWorkbench.defaultSeverityThreshold` in `settings.json`. The default is `LOW` (shows everything except Info-level findings with the filter active).
