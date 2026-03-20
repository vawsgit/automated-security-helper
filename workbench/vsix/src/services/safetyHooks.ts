/**
 * Safety hooks for AI analysis tool guardrails.
 *
 * Provides PreToolUse hook callbacks that block the AI agent from:
 * - Reading sensitive files (.env, credentials, .pem, .key, secrets, .aws/)
 * - Executing dangerous Bash commands (rm -rf, DROP TABLE, DELETE FROM, format, mkfs)
 *
 * Hook callbacks use structural typing (not SDK imports) to avoid ESM issues.
 * All hooks are fail-closed: errors result in denial.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A denied tool call record, pushed to a shared queue for the generator to drain. */
export interface BlockedOperation {
  toolName: string;
  /** The input that triggered the denial (truncated to 200 chars). */
  blockedInput: string;
  reason: string;
}

/** Structural type matching the SDK's PreToolUseHookInput (avoids ESM import). */
interface PreToolUseHookInput {
  hook_event_name: string;
  tool_name: string;
  tool_input: unknown;
}

/** Structural type matching the SDK's HookCallback return value. */
interface HookResult {
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision: 'deny';
    permissionDecisionReason: string;
  };
}

/** Hook callback signature (structural match for SDK HookCallback). */
type HookCallback = (
  input: unknown,
  toolUseId: string | null,
  context: { signal: AbortSignal },
) => Promise<HookResult | Record<string, never>>;

// ---------------------------------------------------------------------------
// Deny reasons (constants)
// ---------------------------------------------------------------------------

const FILE_DENY_REASON = 'Sensitive file blocked by ASH Workbench';
const COMMAND_DENY_REASON = 'Dangerous command blocked by ASH Workbench';

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

/** Patterns matching sensitive file paths (case-insensitive). */
export const SENSITIVE_FILE_PATTERNS: readonly RegExp[] = [
  /(^|[/\\])\.env/i,       // .env, .env.local, .env.production
  /credentials/i,           // credentials.json, aws_credentials
  /\.pem$/i,                // server.pem, cert.pem
  /\.key$/i,                // private.key, tls.key
  /secrets\./i,             // secrets.json, secrets.yaml
  /[/\\]\.aws[/\\]/i,      // .aws/credentials, .aws/config
];

/** Patterns matching dangerous Bash commands (case-insensitive). */
export const DANGEROUS_COMMAND_PATTERNS: readonly RegExp[] = [
  /rm\s+-rf/i,              // rm -rf, rm  -rf
  /drop\s+table/i,          // DROP TABLE, drop table
  /delete\s+from/i,         // DELETE FROM, delete from
  /\bformat\b/i,            // format (word boundary)
  /\bmkfs\b/i,              // mkfs (word boundary)
];

// ---------------------------------------------------------------------------
// Pattern matching functions
// ---------------------------------------------------------------------------

/** Returns true if `input` matches any sensitive file pattern. */
export function isSensitiveFilePath(input: string): boolean {
  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(input));
}

/** Returns true if `command` matches any dangerous command pattern. */
export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
}

// ---------------------------------------------------------------------------
// Helper: truncate string
// ---------------------------------------------------------------------------

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 3) + '...';
}

// ---------------------------------------------------------------------------
// Helper: build deny result
// ---------------------------------------------------------------------------

/** Calls log safely — swallows errors so a broken logger cannot escape the catch block. */
function safeLog(log: (msg: string) => void, msg: string): void {
  try {
    log(msg);
  } catch {
    // Intentionally swallowed — the hook must return deny regardless.
  }
}

function denyResult(hookEventName: string, reason: string): HookResult {
  return {
    hookSpecificOutput: {
      hookEventName,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

// ---------------------------------------------------------------------------
// Hook callback factories
// ---------------------------------------------------------------------------

/**
 * Creates a PreToolUse hook that blocks Read/Glob/Grep calls targeting sensitive files.
 * Iterates all string values in tool_input and checks against SENSITIVE_FILE_PATTERNS.
 * Fail-closed: any error in the hook results in denial.
 */
export function createFilePathHook(
  log: (msg: string) => void,
  blockedOps: BlockedOperation[],
): HookCallback {
  return async (input: unknown) => {
    try {
      const preInput = input as PreToolUseHookInput;
      const toolInput = preInput.tool_input as Record<string, unknown> | undefined;
      if (!toolInput || typeof toolInput !== 'object') {
        return {};
      }

      for (const value of Object.values(toolInput)) {
        if (typeof value === 'string' && isSensitiveFilePath(value)) {
          const blocked = truncate(value, 200);
          blockedOps.push({
            toolName: preInput.tool_name,
            blockedInput: blocked,
            reason: FILE_DENY_REASON,
          });
          log(`[BLOCKED] ${preInput.tool_name} denied: ${blocked} — ${FILE_DENY_REASON}`);
          return denyResult(preInput.hook_event_name, FILE_DENY_REASON);
        }
      }

      return {};
    } catch (err) {
      safeLog(log, `[BLOCKED] Hook error (fail-closed): ${err instanceof Error ? err.message : String(err)}`);
      return denyResult('PreToolUse', FILE_DENY_REASON);
    }
  };
}

/**
 * Creates a PreToolUse hook that blocks Bash calls containing dangerous commands.
 * Checks the `command` field of tool_input against DANGEROUS_COMMAND_PATTERNS.
 * Fail-closed: any error in the hook results in denial.
 */
export function createBashCommandHook(
  log: (msg: string) => void,
  blockedOps: BlockedOperation[],
): HookCallback {
  return async (input: unknown) => {
    try {
      const preInput = input as PreToolUseHookInput;
      const toolInput = preInput.tool_input as Record<string, unknown> | undefined;
      const command = toolInput?.command;
      if (typeof command !== 'string') {
        return {};
      }

      if (isDangerousCommand(command)) {
        const blocked = truncate(command, 200);
        blockedOps.push({
          toolName: preInput.tool_name,
          blockedInput: blocked,
          reason: COMMAND_DENY_REASON,
        });
        log(`[BLOCKED] Bash denied: ${blocked} — ${COMMAND_DENY_REASON}`);
        return denyResult(preInput.hook_event_name, COMMAND_DENY_REASON);
      }

      return {};
    } catch (err) {
      safeLog(log, `[BLOCKED] Hook error (fail-closed): ${err instanceof Error ? err.message : String(err)}`);
      return denyResult('PreToolUse', COMMAND_DENY_REASON);
    }
  };
}

// ---------------------------------------------------------------------------
// Hook builder
// ---------------------------------------------------------------------------

/**
 * Builds the complete hooks configuration for the SDK query() options.
 * Returns a hooks object with PreToolUse matchers for file-path and bash-command filtering.
 */
export function buildSafetyHooks(
  log: (msg: string) => void,
  blockedOps: BlockedOperation[],
): Record<string, unknown> {
  return {
    PreToolUse: [
      { matcher: 'Read|Glob|Grep', hooks: [createFilePathHook(log, blockedOps)] },
      { matcher: 'Bash', hooks: [createBashCommandHook(log, blockedOps)] },
    ],
  };
}
