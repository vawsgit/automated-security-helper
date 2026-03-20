---
title: Analyzing Findings
sidebar_position: 2
---

# Analyzing Findings

Use AI analysis to get an explanation of a finding, understand its risk, and see a suggested fix. Analysis is powered by Claude and runs against the finding's context and your source code.

## Analyze a single finding

1. Open a finding from the [finding list](../findings/navigating-findings.md).
2. Scroll to the **AI Analysis** section.
3. Click **Analyze with AI**.
4. Analysis starts — you see a progress indicator showing what Claude is doing (reading files, searching code, reasoning).
5. When complete, the results appear in an expandable panel.

To cancel an in-progress analysis, click the **Cancel** button next to the progress indicator.

## Analyze all findings in batch

To analyze all unanalyzed findings at once:

1. Open the finding list.
2. Click **Analyze All Findings** at the top of the list.
3. Batch analysis processes findings one at a time, showing progress ("Analyzing finding N of M...").
4. Click **Cancel** at any time to stop the batch.

Batch analysis skips findings that already have an analysis result. If multiple consecutive analyses fail (default: 3 in a row), the batch stops automatically.

## Read analysis results

After analysis completes, the finding detail shows an expandable panel with these sections:

### Explanation

A plain-language description of what the security issue is, why it matters, and how it could be exploited.

### Risk Assessment

Three risk dimensions, each rated High, Medium, or Low with a rationale:

- **Exploitability** — How easy it is to exploit this issue
- **Impact** — What damage could result from exploitation
- **Likelihood** — How likely exploitation is given the context

### Suggested Fix

When applicable, a description of how to fix the issue along with a code diff showing the specific changes.

### References

Links to relevant security documentation, CWE entries, or scanner rule documentation.

### Analysis Details

Metadata about the analysis:

- **Model** — which Claude model was used
- **Cost** — how much the analysis cost in USD
- **Analyzed at** — timestamp
- **Tools used** — what tools Claude used during analysis (e.g., file reading, code search)

## Blocked operations

During analysis, the AI agent may attempt to read files or run commands that are blocked by [safety guardrails](setup.md#safety-guardrails). When this happens, you see a progress message like "Blocked: attempted to read .env". This is expected — the guardrails protect your sensitive files while still allowing the AI to analyze the finding using other available context.

## Re-analyze a finding

If a finding's code has changed or you want a fresh analysis, click the **Re-analyze** button at the bottom of the analysis panel. This runs a new analysis and replaces the previous results.

## Analysis persistence

Analysis results are saved to the database and persist across VS Code sessions. If you close and reopen VS Code, previously analyzed findings still show their results.

## Cost tracking

Each analysis costs a small amount depending on the model used and the complexity of the finding. The cost is displayed in the analysis details. Monitor the **Max Budget Usd** setting to control per-analysis spending — see [AI Analysis Setup](setup.md) for configuration.
