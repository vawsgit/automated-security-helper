import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { detectClaudeSettings } from '../../services/claudeSettingsDetector';

describe('detectClaudeSettings', () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ash-test-'));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function settingsFile(name: string): string {
    return path.join(tmpDir, name);
  }

  async function writeSettings(name: string, content: string): Promise<string> {
    const filePath = settingsFile(name);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  // --- Case 1: file doesn't exist ---
  it('returns not-detected when file does not exist', async () => {
    const result = await detectClaudeSettings(settingsFile('nonexistent.json'));
    assert.strictEqual(result.claudeSettingsDetected, false);
    assert.strictEqual(result.detectedProvider, 'none');
  });

  // --- Case 2: malformed JSON ---
  it('returns not-detected when file contains malformed JSON', async () => {
    const filePath = await writeSettings('malformed.json', '{bad json!!!');
    const result = await detectClaudeSettings(filePath);
    assert.strictEqual(result.claudeSettingsDetected, false);
    assert.strictEqual(result.detectedProvider, 'none');
  });

  // --- Case 3: Bedrock via CLAUDE_CODE_USE_BEDROCK ---
  it('detects bedrock when env.CLAUDE_CODE_USE_BEDROCK is present', async () => {
    const filePath = await writeSettings('bedrock-env.json', JSON.stringify({
      env: { CLAUDE_CODE_USE_BEDROCK: '1' },
    }));
    const result = await detectClaudeSettings(filePath);
    assert.strictEqual(result.claudeSettingsDetected, true);
    assert.strictEqual(result.detectedProvider, 'bedrock');
  });

  // --- Case 4: Bedrock via awsAuthRefresh key ---
  it('detects bedrock when awsAuthRefresh key is present', async () => {
    const filePath = await writeSettings('bedrock-auth.json', JSON.stringify({
      awsAuthRefresh: 'aws sso login --profile bedrock',
    }));
    const result = await detectClaudeSettings(filePath);
    assert.strictEqual(result.claudeSettingsDetected, true);
    assert.strictEqual(result.detectedProvider, 'bedrock');
  });

  // --- Case 5: Anthropic API via ANTHROPIC_API_KEY ---
  it('detects anthropic-api when env.ANTHROPIC_API_KEY is present', async () => {
    const filePath = await writeSettings('anthropic.json', JSON.stringify({
      env: { ANTHROPIC_API_KEY: 'sk-ant-test' },
    }));
    const result = await detectClaudeSettings(filePath);
    assert.strictEqual(result.claudeSettingsDetected, true);
    assert.strictEqual(result.detectedProvider, 'anthropic-api');
  });

  // --- Case 6: Both Bedrock and API key — Bedrock takes precedence ---
  it('returns bedrock when both Bedrock and Anthropic API config are present', async () => {
    const filePath = await writeSettings('both.json', JSON.stringify({
      env: { CLAUDE_CODE_USE_BEDROCK: '1', ANTHROPIC_API_KEY: 'sk-ant-test' },
    }));
    const result = await detectClaudeSettings(filePath);
    assert.strictEqual(result.claudeSettingsDetected, true);
    assert.strictEqual(result.detectedProvider, 'bedrock');
  });

  // --- Case 7: Valid JSON with neither config ---
  it('returns not-detected when file has neither Bedrock nor Anthropic config', async () => {
    const filePath = await writeSettings('empty-config.json', JSON.stringify({
      env: { SOME_OTHER_VAR: 'value' },
    }));
    const result = await detectClaudeSettings(filePath);
    assert.strictEqual(result.claudeSettingsDetected, false);
    assert.strictEqual(result.detectedProvider, 'none');
  });
});
