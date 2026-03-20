import assert from 'node:assert/strict';
import * as yaml from 'js-yaml';
import {
  inputToSuppression,
  serializeSuppressionEntry,
  generateSkeleton,
  findSuppressionIndex,
  reserializeSuppressionsSection,
} from '../../services/ashYamlWriteCore';
import type { SuppressionInput, AshSuppression } from '../../models/types';

// --- Helpers ---

function makeInput(overrides: Partial<SuppressionInput> = {}): SuppressionInput {
  return {
    findingId: 'f1',
    filePath: 'src/app/main.py',
    ruleId: 'B605',
    scope: 'file_rule',
    justification: 'False positive in test code',
    includeLineRange: false,
    startLine: null,
    endLine: null,
    expiration: null,
    ...overrides,
  };
}

function makeSuppression(overrides: Partial<AshSuppression> = {}): AshSuppression {
  return {
    path: 'src/app/main.py',
    reason: 'False positive',
    rule_id: 'B605',
    line_start: null,
    line_end: null,
    expiration: null,
    ...overrides,
  };
}

// ============================================================
// T017: Pure helper tests
// ============================================================

describe('inputToSuppression', () => {
  it('converts file_rule scope correctly', () => {
    const result = inputToSuppression(makeInput({ scope: 'file_rule' }));
    assert.equal(result.path, 'src/app/main.py');
    assert.equal(result.rule_id, 'B605');
    assert.equal(result.reason, 'False positive in test code');
  });

  it('converts rule_everywhere scope to ** path', () => {
    const result = inputToSuppression(makeInput({ scope: 'rule_everywhere' }));
    assert.equal(result.path, '**');
    assert.equal(result.rule_id, 'B605');
  });

  it('converts file_all_rules scope with null rule_id', () => {
    const result = inputToSuppression(makeInput({ scope: 'file_all_rules' }));
    assert.equal(result.path, 'src/app/main.py');
    assert.equal(result.rule_id, null);
  });

  it('includes line range when includeLineRange is true', () => {
    const result = inputToSuppression(makeInput({
      includeLineRange: true,
      startLine: 10,
      endLine: 15,
    }));
    assert.equal(result.line_start, 10);
    assert.equal(result.line_end, 15);
  });

  it('omits line range when includeLineRange is false', () => {
    const result = inputToSuppression(makeInput({
      includeLineRange: false,
      startLine: 10,
      endLine: 15,
    }));
    assert.equal(result.line_start, null);
    assert.equal(result.line_end, null);
  });

  it('includes expiration when provided', () => {
    const result = inputToSuppression(makeInput({ expiration: '2026-12-31' }));
    assert.equal(result.expiration, '2026-12-31');
  });

  it('sets null expiration when not provided', () => {
    const result = inputToSuppression(makeInput({ expiration: null }));
    assert.equal(result.expiration, null);
  });
});

describe('serializeSuppressionEntry', () => {
  it('produces correct indentation with default indent', () => {
    const s = makeSuppression();
    const result = serializeSuppressionEntry(s);
    assert.ok(result.startsWith('    - path:'), `Expected 4-space indent, got: ${result}`);
  });

  it('includes rule_id when present', () => {
    const result = serializeSuppressionEntry(makeSuppression({ rule_id: 'B605' }));
    assert.ok(result.includes('rule_id: "B605"'));
  });

  it('omits rule_id when null', () => {
    const result = serializeSuppressionEntry(makeSuppression({ rule_id: null }));
    assert.ok(!result.includes('rule_id'));
  });

  it('includes line range when present', () => {
    const result = serializeSuppressionEntry(makeSuppression({
      line_start: 10,
      line_end: 20,
    }));
    assert.ok(result.includes('line_start: 10'));
    assert.ok(result.includes('line_end: 20'));
  });

  it('omits line range when null', () => {
    const result = serializeSuppressionEntry(makeSuppression({
      line_start: null,
      line_end: null,
    }));
    assert.ok(!result.includes('line_start'));
    assert.ok(!result.includes('line_end'));
  });

  it('includes expiration when present', () => {
    const result = serializeSuppressionEntry(makeSuppression({ expiration: '2026-12-31' }));
    assert.ok(result.includes('expiration: "2026-12-31"'));
  });

  it('produces correct field ordering', () => {
    const result = serializeSuppressionEntry(makeSuppression({
      rule_id: 'B605',
      line_start: 10,
      line_end: 20,
      expiration: '2026-12-31',
    }));
    const pathIdx = result.indexOf('path:');
    const ruleIdx = result.indexOf('rule_id:');
    const reasonIdx = result.indexOf('reason:');
    const lineStartIdx = result.indexOf('line_start:');
    const lineEndIdx = result.indexOf('line_end:');
    const expirationIdx = result.indexOf('expiration:');
    assert.ok(pathIdx < ruleIdx);
    assert.ok(ruleIdx < reasonIdx);
    assert.ok(reasonIdx < lineStartIdx);
    assert.ok(lineStartIdx < lineEndIdx);
    assert.ok(lineEndIdx < expirationIdx);
  });
});

describe('generateSkeleton', () => {
  it('produces valid parseable YAML', () => {
    const entry = makeSuppression();
    const skeleton = generateSkeleton(entry);
    const parsed = yaml.load(skeleton) as Record<string, unknown>;
    assert.ok(parsed);
    assert.ok(typeof parsed === 'object');
    assert.ok('global_settings' in parsed);
  });

  it('includes the suppression entry', () => {
    const entry = makeSuppression({ rule_id: 'B605' });
    const skeleton = generateSkeleton(entry);
    const parsed = yaml.load(skeleton) as {
      global_settings: { suppressions: Array<{ path: string; rule_id: string }> };
    };
    assert.equal(parsed.global_settings.suppressions.length, 1);
    assert.equal(parsed.global_settings.suppressions[0].path, 'src/app/main.py');
    assert.equal(parsed.global_settings.suppressions[0].rule_id, 'B605');
  });

  it('includes global_settings.suppressions key', () => {
    const skeleton = generateSkeleton(makeSuppression());
    assert.ok(skeleton.includes('global_settings:'));
    assert.ok(skeleton.includes('suppressions:'));
  });
});

// ============================================================
// T024: findSuppressionIndex and reserializeSuppressionsSection
// ============================================================

describe('findSuppressionIndex', () => {
  it('finds matching entry by all fields', () => {
    const list = [
      makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'reason1' }),
      makeSuppression({ path: 'b.py', rule_id: 'R2', reason: 'reason2' }),
    ];
    const target = makeSuppression({ path: 'b.py', rule_id: 'R2', reason: 'reason2' });
    assert.equal(findSuppressionIndex(list, target), 1);
  });

  it('returns -1 when no match', () => {
    const list = [
      makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'reason1' }),
    ];
    const target = makeSuppression({ path: 'x.py', rule_id: 'R1', reason: 'reason1' });
    assert.equal(findSuppressionIndex(list, target), -1);
  });

  it('distinguishes entries by line range', () => {
    const list = [
      makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'r', line_start: 10, line_end: 20 }),
      makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'r', line_start: null, line_end: null }),
    ];
    const target = makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'r', line_start: null, line_end: null });
    assert.equal(findSuppressionIndex(list, target), 1);
  });

  it('distinguishes entries by expiration', () => {
    const list = [
      makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'r', expiration: '2026-01-01' }),
      makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'r', expiration: null }),
    ];
    const target = makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'r', expiration: '2026-01-01' });
    assert.equal(findSuppressionIndex(list, target), 0);
  });
});

describe('reserializeSuppressionsSection', () => {
  const twoEntryYaml = [
    'global_settings:',
    '  suppressions:',
    '    - path: "src/a.py"',
    '      rule_id: "R1"',
    '      reason: "reason1"',
    '    - path: "src/b.py"',
    '      rule_id: "R2"',
    '      reason: "reason2"',
    '',
  ].join('\n');

  it('removes the specified entry and preserves others', () => {
    const remaining = [
      makeSuppression({ path: 'src/b.py', rule_id: 'R2', reason: 'reason2' }),
    ];
    const result = reserializeSuppressionsSection(twoEntryYaml, remaining);
    const parsed = yaml.load(result) as {
      global_settings: { suppressions: Array<{ path: string; rule_id: string }> };
    };
    assert.equal(parsed.global_settings.suppressions.length, 1);
    assert.equal(parsed.global_settings.suppressions[0].path, 'src/b.py');
  });

  it('produces valid YAML output', () => {
    const remaining = [
      makeSuppression({ path: 'src/a.py', rule_id: 'R1', reason: 'reason1' }),
    ];
    const result = reserializeSuppressionsSection(twoEntryYaml, remaining);
    assert.doesNotThrow(() => yaml.load(result));
  });

  it('handles empty suppressions array', () => {
    const result = reserializeSuppressionsSection(twoEntryYaml, []);
    const parsed = yaml.load(result) as {
      global_settings: { suppressions: unknown[] };
    };
    assert.equal(parsed.global_settings.suppressions.length, 0);
  });

  it('preserves other global_settings keys', () => {
    const yamlWithExtra = [
      'global_settings:',
      '  severity_threshold: HIGH',
      '  suppressions:',
      '    - path: "src/a.py"',
      '      rule_id: "R1"',
      '      reason: "reason1"',
      '',
    ].join('\n');
    const result = reserializeSuppressionsSection(yamlWithExtra, []);
    const parsed = yaml.load(result) as {
      global_settings: { severity_threshold: string; suppressions: unknown[] };
    };
    assert.equal(parsed.global_settings.severity_threshold, 'HIGH');
  });
});

// ============================================================
// T018: AshYamlWriteService.addSuppression integration-style tests
// (These test the appendEntry logic via the pure functions since
//  the service itself requires vscode.workspace.fs which isn't
//  available in unit tests. The critical paths are the pure helpers.)
// ============================================================

describe('addSuppression append logic', () => {
  it('generateSkeleton creates a file that can be parsed and re-appended', () => {
    const entry1 = makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'first' });
    const skeleton = generateSkeleton(entry1);

    // Verify the skeleton is valid
    const parsed = yaml.load(skeleton) as {
      global_settings: { suppressions: Array<Record<string, unknown>> };
    };
    assert.equal(parsed.global_settings.suppressions.length, 1);
    assert.equal(parsed.global_settings.suppressions[0].path, 'a.py');
  });

  it('skeleton file can be round-tripped through reserializeSuppressionsSection', () => {
    const entry = makeSuppression({ path: 'a.py', rule_id: 'R1', reason: 'test' });
    const skeleton = generateSkeleton(entry);

    // Add another entry via reserialize
    const entries = [
      { path: 'a.py', rule_id: 'R1', reason: 'test', line_start: null, line_end: null, expiration: null },
      { path: 'b.py', rule_id: 'R2', reason: 'second', line_start: null, line_end: null, expiration: null },
    ];
    const result = reserializeSuppressionsSection(skeleton, entries);
    const parsed = yaml.load(result) as {
      global_settings: { suppressions: Array<Record<string, unknown>> };
    };
    assert.equal(parsed.global_settings.suppressions.length, 2);
  });

  it('inputToSuppression correctly maps all 3 scopes for addSuppression', () => {
    const base = makeInput();

    const fileRule = inputToSuppression({ ...base, scope: 'file_rule' });
    assert.equal(fileRule.path, 'src/app/main.py');
    assert.equal(fileRule.rule_id, 'B605');

    const ruleEverywhere = inputToSuppression({ ...base, scope: 'rule_everywhere' });
    assert.equal(ruleEverywhere.path, '**');
    assert.equal(ruleEverywhere.rule_id, 'B605');

    const fileAll = inputToSuppression({ ...base, scope: 'file_all_rules' });
    assert.equal(fileAll.path, 'src/app/main.py');
    assert.equal(fileAll.rule_id, null);
  });
});
