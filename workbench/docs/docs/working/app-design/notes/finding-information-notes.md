---
title: Finding Information - Interface Design Guidance
---

# Finding Information: What the User Needs to See

Design guidance for presenting security findings in a remediation-focused interface. Organized by information tier -- what the user needs at a glance, what they need when investigating, and what they need when deciding how to act.

## Guiding Principle

A finding is not useful until the user understands **what** is wrong, **where** it is, **why** it matters, and **what to do about it**. Most scanner output covers only the first two. The interface must bridge the gap to the last two -- that's where AI enrichment adds the most value.

---

## Tier 1: At-a-Glance (List/Summary View)

The minimum information needed to scan a list of findings and prioritize attention. Every finding row should show:

| Field | Source | Notes |
|-------|--------|-------|
| **Severity** | Scanner | HIGH / MEDIUM / LOW / INFO. Visual weight (color, icon) should make severity scannable without reading. |
| **Title** | Scanner + AI | Short (one line) description of the issue. Scanner descriptions are often verbose or cryptic -- AI should normalize to plain-language summaries. |
| **File** | Scanner | Primary affected file path, relative to project root. |
| **Rule ID(s)** | Scanner | e.g., `CKV_AWS_18`, `AwsSolutions-IAM4`. Shown but secondary -- most users recognize issues by title, not rule ID. |
| **Scanner** | Scanner | Which tool produced this (checkov, cdk-nag, semgrep, etc.). Useful for trust calibration. |
| **Status** | System | Current lifecycle state: Pending, Researched, Fix Planned, Fixed, Suppressed, Deferred. |

**Design notes:**
- Findings should be groupable/filterable by severity, file, scanner, and status.
- Consider a "category" grouping (same root issue across files) so users can batch-decide. A finding about "S3 bucket missing encryption" across 4 files is one decision, not four.

---

## Tier 2: Investigation (Finding Detail View)

When the user selects a finding, they need enough context to understand the issue without leaving the interface.

### 2a. Affected Code Locations

A finding may affect **one or more locations**. Each location should show:

| Field | Source | Notes |
|-------|--------|-------|
| **File path** | Scanner | Full relative path. Clickable to open in editor. |
| **Line range** | Scanner | Start line -- end line. Used for editor navigation. |
| **Code excerpt** | Scanner + System | The offending lines with surrounding context (5-10 lines above/below). Syntax-highlighted for the file's language. |
| **Annotation** | AI | 1-2 sentences below the excerpt explaining what the scanner flagged in this specific location. Points to the exact property, line, or pattern that triggered the finding. |

**Why multiple locations matter:** A single finding category (e.g., "S3 buckets missing access logging") may manifest in 4 different files. The user needs to see all affected locations to understand the scope of the decision. Show the primary location prominently, with expandable sections for additional locations.

**What the annotation should say:**
- What is missing or misconfigured (e.g., "No `LoggingConfiguration` property on this S3 bucket resource")
- What the scanner expected to find (e.g., "CKV_AWS_18 requires a `LoggingConfiguration` block with a `DestinationBucketName`")
- If the issue is a *missing* property, the annotation should indicate where in the resource definition it should be added

### 2b. Vulnerability Explanation

| Field | Source | Notes |
|-------|--------|-------|
| **What** | AI | Plain-language description of the vulnerability. What security control is missing or misconfigured? |
| **Why it matters** | AI | The attack vector or risk. What could an attacker do? What compliance requirement does this violate? What data is exposed? Be specific to the user's code, not generic boilerplate. |
| **Severity rationale** | AI | Why this severity level. A "HIGH" on a public-facing S3 bucket is different from a "HIGH" on an internal logging bucket. Context matters. |
| **References** | Scanner + AI | Links to the scanner rule documentation, relevant CWE/CVE, AWS security best practices, or compliance frameworks (SOC2, HIPAA, etc.). |

**AI enrichment opportunity:** Scanner descriptions are often terse and rule-focused ("Ensure S3 bucket has access logging enabled"). The AI should rewrite in terms of the actual attack: "Without access logging, unauthorized access to this bucket leaves no audit trail. An attacker who gains read access via the overly-broad IAM policy in `iam/builder-policy.yml` could exfiltrate data without detection."

Cross-referencing between findings is valuable here. If a permissive IAM policy (Finding A) grants access to an unencrypted S3 bucket (Finding B), the explanation should connect them.

---

## Tier 3: Decision Support (Action View)

This is where the user decides what to do. The interface must present options clearly, with enough information to choose confidently.

### 3a. Repair Options

Present as an ordered list of concrete approaches, from most to least interventive:

| Field | Source | Notes |
|-------|--------|-------|
| **Option title** | AI | e.g., "Add encryption configuration to resource" |
| **Description** | AI | What the change involves. Specific enough to act on: which property to add, which resource to modify, what value to set. |
| **Code diff / preview** | AI | A before/after preview or diff showing the proposed change. This is the most valuable piece -- the user should be able to see exactly what will change. |
| **Effort** | AI | Low / Medium / High. Low = single property addition. Medium = new parameters or conditions. High = new resources or architectural changes. |
| **Risk** | AI | What could break. Will existing deployments fail? Does this require resource replacement? Does it add cost (KMS keys, logging buckets, NAT gateways)? Is it reversible? |
| **Completeness** | AI | Does this fully resolve the finding, or only partially? If partial, what remains? |

**Minimum viable set of options to always present:**

1. **Fix in code** -- The direct repair. Add the missing property, tighten the permission, enable the configuration. Show the specific code change.
2. **Fix with configuration** -- If applicable, add a parameter/toggle that enables the security control with a secure default. Preserves backward compatibility for existing deployments.
3. **Suppress** -- Accept the risk with documentation. (See 3b below.)
4. **Defer** -- Flag for later. Appropriate when the fix requires architectural changes beyond current scope.

### 3b. Suppression Guidance

When the user is considering suppression, the interface should present:

| Field | Source | Notes |
|-------|--------|-------|
| **Justification template** | AI | Pre-drafted justification the user can edit. Must address: why this is acceptable, what mitigating controls exist, what should change for production. |
| **Mitigating controls** | AI | What other security measures reduce the risk from this finding. The AI should scan the codebase for these (e.g., "Access is restricted by CloudFront origin header" or "VPC has no internet gateway"). |
| **Scope statement** | AI | The context in which suppression is valid (e.g., "POC/prototype only", "Internal-facing service", "Dev environment"). |
| **Production guidance** | AI | What should the production team do differently. This becomes part of the handoff documentation. |
| **Expiration** | System | Suggested review date (default: 12 months). The suppression should have a TTL. |

**The justification is not optional.** A suppression without justification is a finding with its eyes closed. The interface should require the user to provide or accept a justification before suppression takes effect.

### 3c. Recommendation

| Field | Source | Notes |
|-------|--------|-------|
| **Recommended action** | AI | Fix / Suppress / Defer -- with one sentence explaining why. |
| **Confidence** | AI | How confident the recommendation is. High confidence for straightforward fixes (missing encryption property). Lower confidence when the fix has side effects the AI can't fully evaluate. |
| **Factors considered** | AI | Brief list: effort, risk, scope, severity, context. Helps the user understand the reasoning. |

**The recommendation is a suggestion, not a decision.** The interface must make it easy to accept the recommendation and equally easy to choose differently.

---

## Tier 4: Verification (Post-Action View)

After the user acts on a finding, the interface should show:

| Field | Source | Notes |
|-------|--------|-------|
| **Action taken** | System | What was done: code change applied, suppression added, deferred with rationale. |
| **Verification status** | System | Has a re-scan confirmed the finding is resolved? Pending verification / Verified resolved / Still present. |
| **Delta** | System | If re-scanned: did this fix introduce new findings? Regressions should be surfaced immediately. |

---

## Information Enrichment: What AI Adds vs. What Scanners Provide

| Information | Scanner Provides | AI Enriches |
|-------------|-----------------|-------------|
| Rule ID and severity | Yes | No (pass through) |
| File and line number | Yes | No (pass through) |
| Code excerpt | Partial (SARIF snippet) | Expanded context with surrounding lines |
| Finding description | Terse, rule-focused | Plain-language, attack-vector-focused |
| Affected code annotation | No | Yes -- explains what's wrong at each location |
| Vulnerability explanation | Generic rule description | Context-specific to the user's code |
| Attack vector | No | Yes -- how this could be exploited |
| Cross-reference to related findings | No | Yes -- connects related issues |
| Repair options with code diffs | No | Yes -- proposes specific changes |
| Effort and risk assessment | No | Yes -- evaluates fix complexity |
| Suppression justification | No | Yes -- drafts context-aware justification |
| Mitigating controls | No | Yes -- scans codebase for compensating controls |
| Recommendation | No | Yes -- weighs factors and suggests action |

---

## Structural Notes for Interface Design

### Grouping and Batching

Findings should support a **category view** alongside the flat finding list. When 12 findings across 6 files all have the same root cause ("IAM managed policies"), the user should be able to:
- See them as one group
- Read one explanation that covers all of them
- Apply one disposition that propagates to all 12
- Still drill into individual locations when needed

### Progressive Disclosure

Not all information should be visible at once. Layer it:

1. **List view** -- severity, title, file, status (Tier 1)
2. **Detail panel** -- code excerpts, vulnerability explanation (Tier 2)
3. **Action panel** -- repair options, suppression guidance, recommendation (Tier 3)
4. **Verification** -- post-action confirmation (Tier 4)

### State Visibility

The user should always know where a finding stands:

```
Pending --> Researched --> Action Planned --> [Fixed | Suppressed | Deferred] --> Verified
```

Each state should have a distinct visual treatment. The interface should make it trivially easy to see "how many findings are still pending" and "what's blocking completion."

### Batch Operations

For common patterns (all encryption findings get the same treatment, all "missing description" findings are quick fixes), the interface should support:
- Select multiple findings or a category
- Apply the same disposition to all
- Generate research/remediation for the group, not per-finding

### The "Research" Intermediate State

Not every finding can be immediately classified as Fix/Suppress/Defer. The interface should support a "I need to think about this" state (Research) that:
- Queues the finding for deeper investigation
- Triggers AI-generated research when the user is ready
- Doesn't force a premature decision

This is the most important UX insight from the existing process: **Research is the safe default when the user is unsure.** The interface should make it the easiest non-terminal action to take.
