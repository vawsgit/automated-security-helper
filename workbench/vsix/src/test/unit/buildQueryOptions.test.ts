import assert from 'node:assert/strict';
import { buildQueryOptions } from '../../services/claudeAgentProvider';
import type { AiServiceConfig } from '../../services/aiService';

function makeConfig(overrides: Partial<AiServiceConfig> = {}): AiServiceConfig {
  return {
    provider: '',
    region: '',
    modelId: '',
    awsProfile: '',
    awsAuthRefresh: '',
    useClaudeSettings: true,
    maxBudgetUsd: 1.0,
    maxTurns: 15,
    toolMode: 'read-only',
    batchConsecutiveFailureLimit: 3,
    ...overrides,
  };
}

describe('buildQueryOptions', () => {
  // --- US1: Zero-Config / Base Layer ---

  it('includes settingSources when useClaudeSettings is true', () => {
    const opts = buildQueryOptions(makeConfig({ useClaudeSettings: true }));
    assert.deepStrictEqual(opts.settingSources, ['user']);
  });

  it('omits settingSources when useClaudeSettings is false', () => {
    const opts = buildQueryOptions(makeConfig({ useClaudeSettings: false }));
    assert.strictEqual(opts.settingSources, undefined);
  });

  it('includes model when modelId is non-empty', () => {
    const opts = buildQueryOptions(makeConfig({ modelId: 'claude-sonnet-4-6' }));
    assert.strictEqual(opts.model, 'claude-sonnet-4-6');
  });

  it('omits model when modelId is empty', () => {
    const opts = buildQueryOptions(makeConfig({ modelId: '' }));
    assert.strictEqual(opts.model, undefined);
  });

  it('omits env when all override fields are empty', () => {
    const opts = buildQueryOptions(makeConfig({
      provider: '',
      region: '',
      awsProfile: '',
    }));
    assert.strictEqual(opts.env, undefined);
  });

  // --- US2: Override Settings ---

  it('sets AWS_REGION when region is non-empty', () => {
    const opts = buildQueryOptions(makeConfig({ region: 'us-west-2' }));
    const env = opts.env as Record<string, string>;
    assert.strictEqual(env.AWS_REGION, 'us-west-2');
  });

  it('sets CLAUDE_CODE_USE_BEDROCK when provider is bedrock', () => {
    const opts = buildQueryOptions(makeConfig({ provider: 'bedrock' }));
    const env = opts.env as Record<string, string>;
    assert.strictEqual(env.CLAUDE_CODE_USE_BEDROCK, '1');
  });

  it('does not set CLAUDE_CODE_USE_BEDROCK when provider is anthropic-api', () => {
    const opts = buildQueryOptions(makeConfig({ provider: 'anthropic-api' }));
    assert.strictEqual(opts.env, undefined);
  });

  it('sets AWS_PROFILE when awsProfile is non-empty', () => {
    const opts = buildQueryOptions(makeConfig({ awsProfile: 'prod' }));
    const env = opts.env as Record<string, string>;
    assert.strictEqual(env.AWS_PROFILE, 'prod');
  });

  it('merges multiple overrides into env with process.env as base', () => {
    const opts = buildQueryOptions(makeConfig({
      region: 'eu-west-1',
      provider: 'bedrock',
      awsProfile: 'staging',
    }));
    const env = opts.env as Record<string, string>;
    assert.strictEqual(env.AWS_REGION, 'eu-west-1');
    assert.strictEqual(env.CLAUDE_CODE_USE_BEDROCK, '1');
    assert.strictEqual(env.AWS_PROFILE, 'staging');
    // process.env keys should be present (PATH is always defined)
    assert.strictEqual(env.PATH, process.env.PATH);
  });

  // --- US4: Safety Controls Exclusion ---

  it('does not include maxBudgetUsd in output', () => {
    const opts = buildQueryOptions(makeConfig({ maxBudgetUsd: 5.0 }));
    assert.strictEqual(opts.maxBudgetUsd, undefined);
  });

  it('does not include toolMode in output', () => {
    const opts = buildQueryOptions(makeConfig({ toolMode: 'full' }));
    assert.strictEqual(opts.toolMode, undefined);
  });

  it('does not include maxTurns in output', () => {
    const opts = buildQueryOptions(makeConfig({ maxTurns: 30 }));
    assert.strictEqual(opts.maxTurns, undefined);
  });
});
