import type {
  AiProvider,
  AnalyzeParams,
  AnalysisEvent,
  AnalysisErrorType,
  ConnectionTestResult,
  ProviderCapabilities,
} from './aiProvider';
import type { AiServiceConfig } from './aiService';

// Minimal SDK types inlined to avoid ESM import issues (SDK is ESM-only, this project is CJS).
// These mirror the shapes from @anthropic-ai/claude-agent-sdk/sdk.d.ts.
interface SDKResultSuccess {
  type: 'result';
  subtype: 'success';
  total_cost_usd: number;
  structured_output?: unknown;
  session_id: string;
}

interface SDKResultError {
  type: 'result';
  subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' | 'error_max_structured_output_retries';
  total_cost_usd: number;
  errors: string[];
  session_id: string;
}

type SDKResultMessage = SDKResultSuccess | SDKResultError;

interface SDKAssistantContent {
  type: string;
  name?: string;
}

interface SDKAssistantMessage {
  type: 'assistant';
  message: { content?: SDKAssistantContent[] };
  error?: string;
  session_id: string;
}

interface SDKToolProgressMessage {
  type: 'tool_progress';
  tool_name: string;
  tool_use_id: string;
}

type SDKMessage = SDKResultMessage | SDKAssistantMessage | SDKToolProgressMessage | { type: string; [key: string]: unknown };

// JSON Schema for AiAnalysis structured output
const AI_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    explanation: { type: 'string', description: 'Detailed explanation of the security vulnerability' },
    riskAssessment: {
      type: 'object',
      properties: {
        exploitability: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] },
        exploitabilityRationale: { type: 'string' },
        impact: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] },
        impactRationale: { type: 'string' },
        likelihood: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] },
        likelihoodRationale: { type: 'string' },
      },
      required: ['exploitability', 'exploitabilityRationale', 'impact', 'impactRationale', 'likelihood', 'likelihoodRationale'],
    },
    suggestedFix: {
      oneOf: [
        {
          type: 'object',
          properties: {
            description: { type: 'string' },
            diffText: { type: 'string', description: 'Unified diff or code snippet showing the fix' },
            language: { type: 'string', description: 'Programming language of the fix' },
          },
          required: ['description', 'diffText', 'language'],
        },
        { type: 'null' },
      ],
    },
    references: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['title', 'url'],
      },
    },
  },
  required: ['explanation', 'riskAssessment', 'suggestedFix', 'references'],
};

function buildSystemPrompt(params: AnalyzeParams): string {
  const { finding } = params;
  return `You are an expert application security engineer performing a detailed analysis of a security finding.

## Finding Context
- **Title**: ${finding.title}
- **Description**: ${finding.description}
- **Severity**: ${finding.severity}
- **Scanner**: ${finding.scanner}
- **Rule ID**: ${finding.ruleId}
- **File**: ${finding.filePath}
- **Lines**: ${finding.startLine}–${finding.endLine}
${finding.codeSnippet ? `- **Code Snippet**:\n\`\`\`\n${finding.codeSnippet}\n\`\`\`` : ''}

## Your Task
1. Read the source file at the location indicated above to understand the full context.
2. Search the codebase for related patterns (e.g., similar vulnerabilities, how the function is called).
3. Produce a thorough analysis including:
   - **Explanation**: What the vulnerability is, why it matters, and how it could be exploited in this specific codebase.
   - **Risk Assessment**: Rate exploitability, impact, and likelihood (CRITICAL/HIGH/MEDIUM/LOW/NONE) with rationale specific to this code.
   - **Suggested Fix**: If a fix is possible, provide a code diff. Set to null if the finding is a false positive.
   - **References**: Include relevant CVEs, CWEs, OWASP references, or documentation links.

Focus on this specific codebase — do not give generic advice. Read the actual code.`;
}

function categorizeError(err: unknown): AnalysisErrorType {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('abort') || msg.includes('cancel')) {
      return 'cancelled';
    }
    if (msg.includes('credentials') || msg.includes('aws_access_key') || msg.includes('no credentials')) {
      return 'credentials_missing';
    }
    if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('authentication')) {
      return 'auth_failed';
    }
    if (msg.includes('model') && (msg.includes('not found') || msg.includes('unavailable') || msg.includes('not available'))) {
      return 'model_unavailable';
    }
    if (msg.includes('timeout') || msg.includes('enotfound') || msg.includes('econnrefused') || msg.includes('network')) {
      return 'network_error';
    }
    if (msg.includes('budget')) {
      return 'budget_exceeded';
    }
  }
  return 'unknown';
}

function handleResultMessage(
  result: SDKResultMessage,
  config: AiServiceConfig,
  params: AnalyzeParams,
  toolsUsed: Set<string>,
): AnalysisEvent {
  if (result.subtype === 'success') {
    const structuredOutput = result.structured_output;
    if (structuredOutput && typeof structuredOutput === 'object') {
      const analysis = structuredOutput as {
        explanation: string;
        riskAssessment: {
          exploitability: string;
          exploitabilityRationale: string;
          impact: string;
          impactRationale: string;
          likelihood: string;
          likelihoodRationale: string;
        };
        suggestedFix: { description: string; diffText: string; language: string } | null;
        references: Array<{ title: string; url: string }>;
      };

      return {
        type: 'result',
        analysis: {
          explanation: analysis.explanation,
          riskAssessment: {
            exploitability: analysis.riskAssessment.exploitability as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE',
            exploitabilityRationale: analysis.riskAssessment.exploitabilityRationale,
            impact: analysis.riskAssessment.impact as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE',
            impactRationale: analysis.riskAssessment.impactRationale,
            likelihood: analysis.riskAssessment.likelihood as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE',
            likelihoodRationale: analysis.riskAssessment.likelihoodRationale,
          },
          suggestedFix: analysis.suggestedFix,
          references: analysis.references,
        },
        metadata: {
          analyzedAt: new Date().toISOString(),
          modelId: config.modelId || 'claude',
          costUsd: result.total_cost_usd,
          toolsUsed: Array.from(toolsUsed),
        },
      };
    }
    return {
      type: 'error',
      errorType: 'format_error',
      message: 'AI did not return structured output. The analysis result could not be parsed.',
    };
  }

  // Error result subtypes: error_during_execution, error_max_turns, error_max_budget_usd, error_max_structured_output_retries
  const { subtype } = result;
  if (subtype === 'error_max_budget_usd') {
    return {
      type: 'error',
      errorType: 'budget_exceeded',
      message: `Analysis stopped: cost limit reached ($${params.maxBudgetUsd.toFixed(2)} budget).`,
    };
  }
  if (subtype === 'error_max_turns') {
    return {
      type: 'error',
      errorType: 'max_turns_exceeded',
      message: `Analysis stopped: maximum reasoning iterations reached (${params.maxTurns} turns).`,
    };
  }
  const errorMsg = result.errors.join('; ') || 'Analysis failed';
  return {
    type: 'error',
    errorType: categorizeError(new Error(errorMsg)),
    message: errorMsg,
  };
}

function extractProgressFromMessage(message: SDKMessage, toolsUsed: Set<string>): AnalysisEvent | null {
  if (message.type === 'assistant') {
    const assistantMsg = message as SDKAssistantMessage;
    if (assistantMsg.error) {
      return {
        type: 'error',
        errorType: categorizeError(new Error(assistantMsg.error)),
        message: `AI error: ${assistantMsg.error}`,
      };
    }
    const content = assistantMsg.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_use' && block.name) {
          toolsUsed.add(block.name);
          return {
            type: 'progress',
            message: `Using ${block.name}...`,
            toolName: block.name,
          };
        }
      }
    }
  }

  if (message.type === 'tool_progress') {
    const toolMsg = message as SDKToolProgressMessage;
    return {
      type: 'progress',
      message: `Running ${toolMsg.tool_name}...`,
      toolName: toolMsg.tool_name,
    };
  }

  return null;
}

/**
 * Builds shared SDK query options from the merged AI service configuration.
 * Handles: settingSources (base layer), model override, and env overrides.
 * Does NOT include per-call options (abortController, maxTurns, maxBudgetUsd, allowedTools).
 */
export function buildQueryOptions(config: AiServiceConfig): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  if (config.useClaudeSettings) {
    options.settingSources = ['user'];
  }

  if (config.modelId) {
    options.model = config.modelId;
  }

  const envOverrides: Record<string, string> = {};
  if (config.region) {
    envOverrides.AWS_REGION = config.region;
  }
  if (config.provider === 'bedrock') {
    envOverrides.CLAUDE_CODE_USE_BEDROCK = '1';
  }
  if (config.awsProfile) {
    envOverrides.AWS_PROFILE = config.awsProfile;
  }

  if (Object.keys(envOverrides).length > 0) {
    options.env = { ...process.env, ...envOverrides };
  }

  return options;
}

export class ClaudeAgentProvider implements AiProvider {
  constructor(private readonly config: AiServiceConfig) {}

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 10_000);

      const options: Record<string, unknown> = {
        ...buildQueryOptions(this.config),
        abortController,
        maxTurns: 1,
        permissionMode: 'dontAsk',
        allowedTools: [] as string[],
      };

      const messages = query({
        prompt: 'Respond with exactly: "Connection test successful."',
        options: options as never,
      });

      let sessionId = '';

      for await (const raw of messages) {
        const message = raw as SDKMessage;
        if (message.type === 'assistant') {
          sessionId = (message as SDKAssistantMessage).session_id;
        }
        if (message.type === 'result') {
          clearTimeout(timeout);
          const result = message as SDKResultMessage;
          if (result.subtype === 'success') {
            return {
              success: true,
              model: this.config.modelId || 'claude',
              latencyMs: Date.now() - startTime,
            };
          }
          const errResult = result as SDKResultError;
          return {
            success: false,
            latencyMs: Date.now() - startTime,
            error: {
              type: categorizeError(new Error(errResult.errors?.join('; ') ?? 'unknown')),
              message: errResult.errors?.join('; ') ?? 'Connection test failed',
            },
          };
        }
      }

      clearTimeout(timeout);
      return {
        success: !!sessionId,
        model: sessionId ? (this.config.modelId || 'claude') : undefined,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: {
          type: categorizeError(err),
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      structuredOutput: true,
      toolUse: true,
      codeEditing: true,
      webSearch: true,
      sessionPersistence: true,
    };
  }

  async *analyzeFinding(params: AnalyzeParams): AsyncGenerator<AnalysisEvent, void, undefined> {
    // Yield initial progress event (contract rule: must yield progress before result/error)
    yield { type: 'progress', message: 'Starting security analysis...' };

    try {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      const readOnlyTools = ['Read', 'Glob', 'Grep'];
      const fullTools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
      const allowedTools = params.toolMode === 'full' ? fullTools : readOnlyTools;

      const abortController = new AbortController();
      params.abortSignal.addEventListener('abort', () => abortController.abort(), { once: true });

      const options: Record<string, unknown> = {
        ...buildQueryOptions(this.config),
        abortController,
        cwd: params.workspaceRoot,
        maxTurns: params.maxTurns,
        maxBudgetUsd: params.maxBudgetUsd,
        permissionMode: 'dontAsk',
        allowedTools,
        outputFormat: { type: 'json_schema', schema: AI_ANALYSIS_SCHEMA },
      };

      const messages = query({
        prompt: buildSystemPrompt(params),
        options: options as never,
      });

      const toolsUsed = new Set<string>();

      for await (const raw of messages) {
        const message = raw as SDKMessage;

        if (params.abortSignal.aborted) {
          yield { type: 'error', errorType: 'cancelled', message: 'Analysis cancelled by user.' };
          return;
        }

        // Handle result (terminal event)
        if (message.type === 'result') {
          yield handleResultMessage(message as SDKResultMessage, this.config, params, toolsUsed);
          return;
        }

        // Extract progress events from other message types
        const progressEvent = extractProgressFromMessage(message, toolsUsed);
        if (progressEvent) {
          yield progressEvent;
          if (progressEvent.type === 'error') {
            return;
          }
        }
      }
    } catch (err) {
      if (params.abortSignal.aborted) {
        yield { type: 'error', errorType: 'cancelled', message: 'Analysis cancelled by user.' };
      } else {
        yield {
          type: 'error',
          errorType: categorizeError(err),
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
}
