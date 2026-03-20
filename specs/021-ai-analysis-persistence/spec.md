# Feature Specification: AI Analysis Persistence

**Feature Branch**: `021-ai-analysis-persistence`
**Created**: 2026-03-20
**Status**: Draft
**Input**: Database persistence for AI analysis results so they survive across sessions and don't require re-analysis.
**Depends On**: Spec 018 (AI Provider Abstraction)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persisted Analysis Survives Session Restart (Priority: P1)

When a user triggers AI analysis on a security finding, the analysis result (explanation, risk assessment, suggested fix, references) and its metadata (timestamp, model used, cost, tools used) are persisted to the database. When the user reopens VS Code or reloads the extension, previously analyzed findings display their cached AI analysis immediately without requiring re-analysis.

**Why this priority**: This is the core value proposition — analysis results are expensive (time and money) and should never be lost between sessions.

**Independent Test**: Analyze a finding, close and reopen the extension, verify the analysis is displayed without re-running the AI provider.

**Acceptance Scenarios**:

1. **Given** a finding with no AI analysis, **When** AI analysis completes successfully, **Then** the analysis result and metadata are saved to the database and the finding displays the analysis.
2. **Given** a finding with a previously persisted AI analysis, **When** the extension loads and displays findings, **Then** the finding shows the cached analysis without making any AI provider calls.
3. **Given** a finding with a persisted AI analysis, **When** the user requests re-analysis, **Then** the new result overwrites the previous one in the database.

---

### User Story 2 - Clear Stale Analysis (Priority: P2)

A user can clear a previously persisted AI analysis from a finding. This is useful when the user knows the analysis is outdated (e.g., after code changes) and wants to start fresh, or when they want to re-analyze with a different model or configuration.

**Why this priority**: Supports the re-analysis workflow; without the ability to clear, stale results could mislead the user.

**Independent Test**: Analyze a finding, clear the analysis, verify the finding no longer shows AI analysis data.

**Acceptance Scenarios**:

1. **Given** a finding with a persisted AI analysis, **When** the user clears the analysis, **Then** the stored analysis is removed from the database and the finding displays no AI analysis.
2. **Given** a finding with no AI analysis, **When** the user attempts to clear analysis, **Then** the operation completes without error (idempotent).

---

### User Story 3 - Analysis Metadata Visibility (Priority: P3)

The system stores metadata alongside each AI analysis — when it was analyzed, which model produced it, what the analysis cost, and which tools the AI used. This metadata is available for display so the user can assess the freshness and provenance of the analysis.

**Why this priority**: Metadata supports trust and cost awareness, but the feature delivers value even without displaying metadata.

**Independent Test**: Analyze a finding, verify the stored result includes analyzedAt timestamp, modelId, costUsd, and toolsUsed.

**Acceptance Scenarios**:

1. **Given** a successful AI analysis, **When** the result is persisted, **Then** metadata includes the timestamp, model identifier, cost in USD, and list of tools used during analysis.
2. **Given** a persisted analysis, **When** the user views the finding, **Then** the metadata is available alongside the analysis content.

---

### Edge Cases

- What happens when a finding is deleted (e.g., via scan deletion)? The AI analysis is cascade-deleted with the finding.
- What happens when analysis is interrupted mid-stream? No partial result is persisted — only successful, complete analyses are saved.
- What happens when the stored JSON shape doesn't match the expected schema (e.g., after a schema evolution)? The mapper returns null for that finding's analysis, treating it as unanalyzed.
- What happens when two analysis requests target the same finding concurrently? The system rejects duplicate in-progress analyses, so the persisted result is always from a single run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist AI analysis results (explanation, risk assessment, suggested fix, references) alongside each finding in the database.
- **FR-002**: System MUST persist analysis metadata (analyzed-at timestamp, model identifier, cost in USD, tools used) alongside the analysis result.
- **FR-003**: System MUST load and display previously persisted AI analysis when findings are retrieved, without re-invoking the AI provider.
- **FR-004**: System MUST allow clearing a persisted AI analysis from a finding, resetting it to the unanalyzed state.
- **FR-005**: System MUST overwrite the existing AI analysis when a finding is re-analyzed, replacing both the analysis and its metadata.
- **FR-006**: System MUST persist the analysis only after a fully successful AI analysis — partial or errored analyses MUST NOT be saved.
- **FR-007**: System MUST cascade-delete AI analysis data when the parent finding or scan is deleted.
- **FR-008**: System MUST gracefully handle corrupted or schema-mismatched stored analysis by treating the finding as unanalyzed (returning null).

### Key Entities

- **StoredAiAnalysis**: The persisted unit combining an AI analysis (explanation, risk assessment, suggested fix, references) with its metadata (timestamp, model, cost, tools). Stored as a JSON document on the Finding record.
- **Finding** (extended): Existing finding entity gains an optional AI analysis attachment. The analysis is a denormalized JSON blob rather than a separate table, keeping the data model simple for a 1:1 relationship.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: AI analysis results survive extension reload — 100% of previously analyzed findings display their analysis on next session without re-analysis.
- **SC-002**: Re-analysis overwrites the prior result — after re-analysis, only the latest result is stored and displayed.
- **SC-003**: Clearing analysis resets the finding to unanalyzed state — the finding shows no AI analysis after clearing.
- **SC-004**: No data loss on cascade — deleting a scan removes all associated findings and their AI analyses.
- **SC-005**: Corrupted stored data does not crash the extension — malformed analysis JSON is silently treated as "no analysis."
