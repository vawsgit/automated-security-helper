import type { TriageClassification } from '../models/triageTypes.js';

export interface TriagePromptResult {
  systemPrompt: string;
  outputSchema: Record<string, unknown>;
}

const SUPPRESS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: ['suppress'] },
    explanation: { type: 'string', description: 'What the issue is (1-2 sentences).' },
    risk: { type: 'string', description: 'Risk assessment (1-2 sentences).' },
    suppressionRationale: { type: 'string', description: 'Why it is safe to suppress this finding.' },
    suggestedScope: { type: 'string', enum: ['file_rule', 'rule_everywhere', 'file_all_rules'], description: 'Recommended suppression scope.' },
    suggestedJustification: { type: 'string', description: 'Pre-written justification for the suppression entry (1-3 sentences).' },
  },
  required: ['category', 'explanation', 'risk', 'suppressionRationale', 'suggestedScope', 'suggestedJustification'],
};

const EASY_FIX_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: ['easy_fix'] },
    explanation: { type: 'string', description: 'What the issue is (1-2 sentences).' },
    risk: { type: 'string', description: 'Risk assessment (1-2 sentences).' },
    fixDescription: { type: 'string', description: 'How to fix it (1-2 sentences).' },
    codeBefore: { type: 'string', description: 'The exact original code lines to replace (copy from the snippet).' },
    codeAfter: { type: 'string', description: 'The replacement code lines (the fix).' },
    filePath: { type: 'string', description: 'Relative file path to modify.' },
    startLine: { type: 'number', description: 'Start line of codeBefore (1-indexed).' },
    endLine: { type: 'number', description: 'End line of codeBefore (1-indexed, inclusive).' },
  },
  required: ['category', 'explanation', 'risk', 'fixDescription', 'codeBefore', 'codeAfter', 'filePath', 'startLine', 'endLine'],
};

const SYSTEMIC_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: ['systemic'] },
    explanation: { type: 'string', description: 'What the issue is (1-2 sentences).' },
    risk: { type: 'string', description: 'Risk assessment (1-2 sentences).' },
    complexityRationale: { type: 'string', description: 'Why this is hard to fix (1-2 sentences).' },
    repairGuidance: {
      type: 'object',
      properties: {
        affectedAreas: { type: 'array', items: { type: 'string' }, description: 'List of affected code areas/files.' },
        vulnerabilityNature: { type: 'string', description: 'Detailed vulnerability description.' },
        remediationApproach: { type: 'string', description: 'Step-by-step remediation strategy.' },
        sideEffects: { type: 'array', items: { type: 'string' }, description: 'Potential side effects of the fix.' },
        testingRecommendations: { type: 'string', description: 'What to test after fixing.' },
      },
      required: ['affectedAreas', 'vulnerabilityNature', 'remediationApproach', 'sideEffects', 'testingRecommendations'],
    },
  },
  required: ['category', 'explanation', 'risk', 'complexityRationale', 'repairGuidance'],
};

const TRIAGE_CLASSIFICATION_SCHEMA: Record<string, unknown> = {
  oneOf: [SUPPRESS_SCHEMA, EASY_FIX_SCHEMA, SYSTEMIC_SCHEMA],
};

export function buildTriagePrompt(finding: {
  ruleId: string;
  severity: string;
  file: string;
  startLine: number;
  endLine: number | null;
  snippet: string | null;
  title: string;
  description: string;
  scanner: string;
  notes: string | null;
}): TriagePromptResult {
  let findingContext = `## Finding Context
- **Title**: ${finding.title}
- **Description**: ${finding.description}
- **Severity**: ${finding.severity}
- **Scanner**: ${finding.scanner}
- **Rule ID**: ${finding.ruleId}
- **File**: ${finding.file}
- **Lines**: ${finding.startLine}–${finding.endLine ?? finding.startLine}`;

  if (finding.snippet) {
    findingContext += `\n- **Code Snippet**:\n\`\`\`\n${finding.snippet}\n\`\`\``;
  }

  if (finding.notes) {
    findingContext += `\n- **User Notes**: ${finding.notes}`;
  }

  const systemPrompt = `You are an expert application security engineer performing repairability triage on a security finding. Your goal is to classify the finding into exactly one of three categories and provide category-specific action data.

## Classification Categories

### suppress
The finding should be suppressed. Use this when:
- It is a false positive (the tool misidentified secure code as vulnerable)
- The risk is acceptable in this context (e.g., test code, internal tooling, mitigated elsewhere)
- The finding is not applicable to the deployment context

### easy_fix
The finding has a straightforward, non-risky fix affecting typically one file. Use this when:
- The fix is a simple code change (e.g., adding input validation, escaping output, updating a dependency version)
- The change is low-risk and unlikely to break other functionality
- The fix can be expressed as a before/after code replacement
- IMPORTANT: The codeBefore MUST be an exact copy of lines from the provided code snippet. The codeAfter must be a drop-in replacement.

### systemic
The finding requires a complex or risky fix. Use this when:
- The fix involves multiple files or architectural changes
- The vulnerability is deeply embedded in the codebase
- The fix has significant side effects or risk of regression
- Expert judgment or a coding agent is needed to safely remediate

## CONSTRAINTS
- Do NOT use any tools. Do NOT read files or search the codebase.
- Answer strictly from the context provided below.
- Be direct and specific. No filler or generic security advice.
- For easy_fix: codeBefore must be an EXACT match of lines from the code snippet. Include enough surrounding context for unique matching.
- For easy_fix: filePath must be the relative path from the finding context.

${findingContext}

## Your Task
Classify this finding into exactly one category (suppress, easy_fix, or systemic) and provide all required fields for that category.`;

  return {
    systemPrompt,
    outputSchema: TRIAGE_CLASSIFICATION_SCHEMA,
  };
}

export function parseTriageResponse(raw: unknown): TriageClassification | null {
  if (!raw || typeof raw !== 'object') { return null; }
  const obj = raw as Record<string, unknown>;
  const category = obj.category;
  if (category !== 'suppress' && category !== 'easy_fix' && category !== 'systemic') { return null; }
  if (typeof obj.explanation !== 'string' || typeof obj.risk !== 'string') { return null; }

  switch (category) {
    case 'suppress':
      if (typeof obj.suppressionRationale !== 'string' || typeof obj.suggestedJustification !== 'string') { return null; }
      if (!['file_rule', 'rule_everywhere', 'file_all_rules'].includes(obj.suggestedScope as string)) { return null; }
      return obj as unknown as TriageClassification;
    case 'easy_fix':
      if (typeof obj.fixDescription !== 'string' || typeof obj.codeBefore !== 'string' || typeof obj.codeAfter !== 'string') { return null; }
      if (typeof obj.filePath !== 'string' || typeof obj.startLine !== 'number' || typeof obj.endLine !== 'number') { return null; }
      return obj as unknown as TriageClassification;
    case 'systemic':
      if (typeof obj.complexityRationale !== 'string' || !obj.repairGuidance || typeof obj.repairGuidance !== 'object') { return null; }
      return obj as unknown as TriageClassification;
  }
}
