# Feature Specification: Generate Suppression Message

**Feature Branch**: `025-suppression-message-gen`
**Created**: 2026-03-23
**Status**: Draft
**Input**: User description: "In the findings detail view I would like to have the ability to generate a compelling suppression message so the system can provide the most accurate suppression message possible."

## Clarifications

### Session 2026-03-23

- Q: Should message generation work offline/locally or require an external AI service? → A: External AI only — generation always requires an AI service (best quality, requires network + API key).
- Q: Should the generated message adapt based on the suppression scope (file+rule, rule everywhere, file all rules)? → A: Scope-aware — generated message adapts its reasoning based on which suppression scope the user selected.
- Q: Should the generated message follow a structured format or be freeform prose? → A: Structured format — labeled sections (e.g., Finding, Risk Assessment, Rationale, Scope) in a short template; scannable and consistent across all generated messages.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Suppression Justification from Finding Detail (Priority: P1)

A security analyst is triaging a finding in the detail view. They have decided to suppress the finding but need a well-written justification that explains why the risk is acceptable. Instead of writing the justification from scratch, they click a "Generate Message" button. The system analyzes the finding's context — rule ID, description, severity, code snippet, file path, and any existing user notes — and produces a draft suppression justification. The analyst reviews the generated message, optionally edits it, and uses it as the suppression reason.

**Why this priority**: This is the core value proposition. Without message generation, the feature has no purpose. A single-click generation that produces a contextual, audit-ready justification is the minimum viable experience.

**Independent Test**: Can be fully tested by opening any finding detail view, clicking "Generate Message," and verifying a contextual justification appears in the suppression form's justification field.

**Acceptance Scenarios**:

1. **Given** a finding is displayed in the detail view with disposition not yet set, **When** the user clicks "Generate Message" in the suppression section, **Then** the system generates a justification message that references the specific rule, file, and reason for acceptance, tailored to the currently selected suppression scope.
2. **Given** a finding has user-added notes (e.g., "This is a test file, not production code"), **When** the user generates a suppression message, **Then** the generated message incorporates the user's notes as additional context for the justification.
3. **Given** message generation is in progress, **When** the user is waiting, **Then** a loading indicator is displayed and the generate button is disabled until generation completes.
4. **Given** a suppression message has been generated, **When** the user views it in the justification field, **Then** the message is editable and the user can modify it before submitting the suppression.

---

### User Story 2 - Regenerate or Refine Suppression Message (Priority: P2)

The analyst reviews the generated suppression message but feels it doesn't quite capture the right reasoning. They click "Regenerate" to get a fresh alternative, or they edit the message and click "Refine" to have the system improve their edits while preserving their intent.

**Why this priority**: Users will not always be satisfied with the first generated message. The ability to iterate improves trust and adoption, but the feature is still useful without it (users can manually edit).

**Independent Test**: Can be tested by generating a message, then clicking regenerate and verifying a different message appears, or editing the message and clicking refine to see an improved version.

**Acceptance Scenarios**:

1. **Given** a suppression message has already been generated, **When** the user clicks "Regenerate," **Then** a new message is produced that differs from the previous one while remaining contextually accurate.
2. **Given** the user has manually edited a generated message, **When** they click "Refine," **Then** the system improves the edited text (grammar, clarity, completeness) while preserving the user's core reasoning.

---

### User Story 3 - Generate Messages Informed by AI Analysis (Priority: P3)

When a finding has AI analysis data available (risk assessment, exploitability, suggested fix), the suppression message generation incorporates this richer context to produce a more compelling and detailed justification — referencing specific risk factors, mitigating controls, or reasons the vulnerability is not exploitable in this context.

**Why this priority**: AI analysis enrichment is a future capability that may not be available for all findings. This story adds depth but is not required for core functionality.

**Independent Test**: Can be tested by generating a suppression message for a finding that has AI analysis data and verifying the message references risk assessment details not present in the base finding data.

**Acceptance Scenarios**:

1. **Given** a finding has AI analysis with risk assessment data (exploitability, impact, likelihood), **When** the user generates a suppression message, **Then** the message references specific risk factors (e.g., "low exploitability due to internal-only access") to strengthen the justification.
2. **Given** a finding does not have AI analysis data, **When** the user generates a suppression message, **Then** the system still produces a useful message based on available finding data (rule description, code context, severity).

---

### Edge Cases

- What happens when the finding has minimal data (e.g., no code snippet, no description)? The system generates a message using whatever data is available, with a note that more context would improve the justification.
- What happens when message generation fails (e.g., AI service unavailable, network error, API key missing)? The user sees an error message and can still manually type a justification.
- What happens when the user has no AI service configured or no API key? The generate button is visible but disabled with a tooltip explaining that an AI service configuration is required.
- What happens when the finding is already suppressed? The generate button is hidden or disabled since the finding already has a justification.
- What happens when the user navigates away during generation? The generation is cancelled and no partial result is stored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Generate Message" action in the finding detail view's suppression section that produces a draft justification based on the finding's available data.
- **FR-002**: The generated message MUST reference the specific finding context: at minimum the rule ID, scanner name, file path, and a characterization of the finding.
- **FR-002a**: The generated message MUST adapt its reasoning to the selected suppression scope:
  - **File+Rule**: Justification focuses on why this specific rule is acceptable in this specific file/location.
  - **Rule Everywhere**: Justification explains why this rule is globally inapplicable or acceptable across the entire codebase.
  - **File All Rules**: Justification explains why all findings in the matching file(s) are acceptable (e.g., test files, generated code).
- **FR-003**: The generated message MUST be placed into the suppression form's justification field as editable text that the user can modify before submitting.
- **FR-004**: System MUST display a loading indicator while message generation is in progress and disable the generate action to prevent duplicate requests.
- **FR-005**: System MUST incorporate user-added notes (from the finding's notes field) into the generated message when notes are present.
- **FR-006**: System MUST handle generation failures gracefully by displaying an error message and preserving any existing justification text in the field.
- **FR-007**: System SHOULD provide a "Regenerate" action that produces an alternative message when the user is not satisfied with the initial result.
- **FR-008**: System SHOULD provide a "Refine" action that improves user-edited text while preserving their core reasoning.
- **FR-009**: When AI analysis data is available for the finding, the system SHOULD incorporate risk assessment details (exploitability, impact, likelihood) into the generated message.
- **FR-010**: The generated message MUST be suitable for audit purposes — clear, specific, and professional in tone. Messages MUST follow a consistent structured format with labeled sections (e.g., Finding, Risk Assessment, Rationale, Scope) to ensure scannability and consistency across all generated messages.
- **FR-011**: The generate action MUST NOT be available when the finding is already actively suppressed (suppression already has a justification on file).
- **FR-012**: The generate action MUST require a configured AI service. When no AI service is configured, the action MUST be visible but disabled with an explanation of the prerequisite.

### Key Entities

- **Suppression Justification**: A text message explaining why a security finding is being suppressed. Contains references to the finding's rule, location, and risk rationale. Stored as the `reason` field in the `.ash.yaml` suppression entry.
- **Finding Context**: The collection of finding attributes (rule ID, description, severity, code snippet, file path, line range, scanner name, user notes, AI analysis) used as input for message generation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate a contextual suppression justification in under 5 seconds from clicking the generate button.
- **SC-002**: 90% of generated messages require only minor edits (fewer than 20% of characters changed) before the user accepts them.
- **SC-003**: Generated messages reference at least 3 finding-specific attributes (rule ID, file, severity, description, code context) making each message unique to its finding.
- **SC-004**: Users who use the generate feature complete the suppression workflow at least 50% faster compared to typing justifications manually.

## Assumptions

- The suppression form and justification text area already exist in the finding detail view and will be reused as the target for generated messages.
- The system has access to all `FindingRow` attributes (title, description, severity, scanner, ruleId, filePath, codeSnippet, notes, aiAnalysis) at the time of generation.
- Message generation requires an external AI service. The feature will not function without network connectivity and a configured AI service API key. The specific AI provider is an implementation decision.
- The generated message format follows the existing `.ash.yaml` `reason` field conventions (plain text string).

## Scope Boundaries

**In Scope**:
- Generating suppression justification text from finding context
- Placing generated text into the existing suppression form
- Regenerate and refine capabilities
- Incorporating AI analysis data when available
- Loading states and error handling for the generation process

**Out of Scope**:
- Automatically submitting the suppression (user must still review and confirm)
- Generating inline suppression comments (e.g., `# nosec`, `# nosemgrep`)
- Batch generation of suppression messages for multiple findings at once
- Training or fine-tuning models for suppression message quality
- Changes to the `.ash.yaml` format or suppression matching logic
