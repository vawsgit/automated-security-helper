import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export interface ClaudeSettingsDetection {
  claudeSettingsDetected: boolean;
  detectedProvider: 'bedrock' | 'anthropic-api' | 'none';
}

const NOT_DETECTED: ClaudeSettingsDetection = {
  claudeSettingsDetected: false,
  detectedProvider: 'none',
};

/**
 * Detects whether ~/.claude/settings.json contains usable AI provider configuration.
 * Checks for Bedrock config (CLAUDE_CODE_USE_BEDROCK or awsAuthRefresh) and
 * Anthropic API config (ANTHROPIC_API_KEY). Bedrock takes precedence if both found.
 *
 * Never throws — returns not-detected on any error.
 *
 * @param settingsPath Optional override for testing (defaults to ~/.claude/settings.json)
 */
export async function detectClaudeSettings(settingsPath?: string): Promise<ClaudeSettingsDetection> {
  const filePath = settingsPath ?? path.join(os.homedir(), '.claude', 'settings.json');

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return NOT_DETECTED;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.warn(`[ASH] Claude Code settings at ${filePath} contains malformed JSON, ignoring.`);
    return NOT_DETECTED;
  }

  const env = parsed.env as Record<string, unknown> | undefined;

  // Bedrock detection: CLAUDE_CODE_USE_BEDROCK in env, or awsAuthRefresh key at top level
  if (env?.CLAUDE_CODE_USE_BEDROCK !== undefined || parsed.awsAuthRefresh !== undefined) {
    return { claudeSettingsDetected: true, detectedProvider: 'bedrock' };
  }

  // Anthropic API detection: ANTHROPIC_API_KEY in env
  if (env?.ANTHROPIC_API_KEY !== undefined) {
    return { claudeSettingsDetected: true, detectedProvider: 'anthropic-api' };
  }

  return NOT_DETECTED;
}
