import type { FindingRow, SuppressionScope, StructuredJustification } from '../models/types';

export interface SuppressionPromptResult {
  systemPrompt: string;
  schema: Record<string, unknown>;
}

const SUPPRESSION_JUSTIFICATION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    finding: { type: 'string', description: 'One sentence identifying the finding.' },
    riskAssessment: { type: 'string', description: 'One to two sentences on the actual risk in this context.' },
    rationale: { type: 'string', description: 'One to two sentences on why suppression is appropriate.' },
    scope: { type: 'string', description: 'One sentence on what this suppression covers.' },
  },
  required: ['finding', 'riskAssessment', 'rationale', 'scope'],
};

function buildScopeInstruction(finding: FindingRow, scope: SuppressionScope): string {
  switch (scope) {
    case 'file_rule':
      return `Explain why rule "${finding.ruleId}" is acceptable in "${finding.filePath}" at lines ${finding.startLine}–${finding.endLine}. Focus on file-specific context.`;
    case 'rule_everywhere':
      return `Explain why rule "${finding.ruleId}" from ${finding.scanner} is globally inapplicable or acceptable across the entire codebase. Provide broad reasoning.`;
    case 'file_all_rules':
      return `Explain why all security findings in files matching "${finding.filePath}" are acceptable. Common reasons include test files, generated code, or vendored dependencies.`;
  }
}

function buildModeInstruction(mode: 'generate' | 'regenerate' | 'refine', existingMessage?: string): string {
  switch (mode) {
    case 'generate':
      return '';
    case 'regenerate':
      return '\n\nIMPORTANT: Provide a different perspective and reasoning than previously generated messages. Offer a fresh justification angle.';
    case 'refine':
      return `\n\nThe user has written the following justification. Improve its clarity, completeness, and professional tone while preserving their core reasoning:\n\n---\n${existingMessage ?? ''}\n---`;
  }
}

export function buildSuppressionPrompt(
  finding: FindingRow,
  scope: SuppressionScope,
  mode: 'generate' | 'regenerate' | 'refine',
  existingMessage?: string,
): SuppressionPromptResult {
  const scopeInstruction = buildScopeInstruction(finding, scope);
  const modeInstruction = buildModeInstruction(mode, existingMessage);

  let findingContext = `## Finding Context
- **Title**: ${finding.title}
- **Description**: ${finding.description}
- **Severity**: ${finding.severity}
- **Scanner**: ${finding.scanner}
- **Rule ID**: ${finding.ruleId}
- **File**: ${finding.filePath}
- **Lines**: ${finding.startLine}–${finding.endLine}`;

  if (finding.codeSnippet) {
    findingContext += `\n- **Code Snippet**:\n\`\`\`\n${finding.codeSnippet}\n\`\`\``;
  }

  if (finding.notes) {
    findingContext += `\n- **User Notes**: ${finding.notes}`;
  }

  // AI analysis enrichment (US3 / FR-009)
  let aiAnalysisSection = '';
  if (finding.aiAnalysis) {
    const risk = finding.aiAnalysis.riskAssessment;
    aiAnalysisSection = `\n\n## Prior AI Analysis
- **Exploitability**: ${risk.exploitability} — ${risk.exploitabilityRationale}
- **Impact**: ${risk.impact} — ${risk.impactRationale}
- **Likelihood**: ${risk.likelihood} — ${risk.likelihoodRationale}`;
    if (finding.aiAnalysis.suggestedFix) {
      aiAnalysisSection += `\n- **Suggested Fix**: ${finding.aiAnalysis.suggestedFix.description}`;
    } else {
      aiAnalysisSection += '\n- **Suggested Fix**: None (AI determined this may be a false positive or low-risk issue)';
    }
  }

  const systemPrompt = `You are an expert application security engineer writing a suppression justification for a security finding.

CRITICAL CONSTRAINTS:
- Total output MUST be 150 words or fewer across all four sections combined.
- Do NOT use any tools. Do NOT read files or search the codebase. Answer strictly from the context provided below.
- Be direct and specific. No filler, no preamble, no generic security advice.

${findingContext}${aiAnalysisSection}

## Suppression Scope
${scopeInstruction}

## Your Task
Write a structured suppression justification with four sections:
1. **Finding**: One sentence identifying the finding.
2. **Risk Assessment**: One to two sentences on the actual risk in this specific context.
3. **Rationale**: One to two sentences on why suppression is appropriate.
4. **Scope**: One sentence on what this suppression covers.${modeInstruction}`;

  return {
    systemPrompt,
    schema: SUPPRESSION_JUSTIFICATION_SCHEMA,
  };
}

export function assembleMessage(sections: StructuredJustification): string {
  return `Finding: ${sections.finding}
Risk Assessment: ${sections.riskAssessment}
Rationale: ${sections.rationale}
Scope: ${sections.scope}`;
}
