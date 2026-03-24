import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  discoverConfigFile,
  parseConfigFile,
  parseRawConfig,
  parseSuppressions,
  parseIgnorePaths,
  parseScanners,
  isExpired,
  matchesRuleId,
  matchesFilePath,
  matchesLineRange,
  findMatchingSuppression,
  batchMatchSuppressions,
} from '../../services/ashYamlCore';
import type { AshSuppression, FindingRow } from '../../models/types';

// --- Helpers ---

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ash-yaml-test-'));
}

function makeFinding(overrides: Partial<FindingRow> = {}): FindingRow {
  return {
    id: 'f1',
    scanId: 's1',
    scanTargetId: 'st1',
    title: 'Test finding',
    description: 'desc',
    severity: 'HIGH',
    disposition: 'PENDING',
    scanner: 'bandit',
    ruleId: 'B605',
    filePath: 'src/app/main.py',
    startLine: 10,
    endLine: 10,
    codeSnippet: '',
    notes: '',
    firstDetectedAt: '2025-01-01T00:00:00Z',
    aiAnalysis: null,
    analysisMetadata: null,
    suppression: null,
    isCurrentlySuppressed: false,
    suppressionSource: null,
    triageAnalysis: null,
    triageMetadata: null,
    triageFingerprint: null,
    isTriageStale: false,
    ...overrides,
  };
}

function makeSuppression(overrides: Partial<AshSuppression> = {}): AshSuppression {
  return {
    path: 'src/**/*.py',
    reason: 'test reason',
    rule_id: null,
    line_start: null,
    line_end: null,
    expiration: null,
    ...overrides,
  };
}

// --- Tests ---

describe('AshYaml', () => {
  // ===== Discovery =====

  describe('discoverConfigFile', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = makeTmpDir();
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns null when no config file exists', () => {
      assert.equal(discoverConfigFile(tmpDir), null);
    });

    it('finds .ash.yml in root directory (first priority)', () => {
      fs.writeFileSync(path.join(tmpDir, '.ash.yml'), 'project_name: test');
      assert.equal(discoverConfigFile(tmpDir), path.join(tmpDir, '.ash.yml'));
    });

    it('finds .ash.yaml in root directory', () => {
      fs.writeFileSync(path.join(tmpDir, '.ash.yaml'), 'project_name: test');
      assert.equal(discoverConfigFile(tmpDir), path.join(tmpDir, '.ash.yaml'));
    });

    it('finds .ash.json in root directory', () => {
      fs.writeFileSync(path.join(tmpDir, '.ash.json'), '{}');
      assert.equal(discoverConfigFile(tmpDir), path.join(tmpDir, '.ash.json'));
    });

    it('finds ash.yml (non-dot-prefixed) in root directory', () => {
      fs.writeFileSync(path.join(tmpDir, 'ash.yml'), 'project_name: test');
      assert.equal(discoverConfigFile(tmpDir), path.join(tmpDir, 'ash.yml'));
    });

    it('finds config in .ash/ subdirectory', () => {
      fs.mkdirSync(path.join(tmpDir, '.ash'));
      fs.writeFileSync(path.join(tmpDir, '.ash', '.ash.yaml'), 'project_name: test');
      assert.equal(discoverConfigFile(tmpDir), path.join(tmpDir, '.ash', '.ash.yaml'));
    });

    it('prefers root over .ash/ subdirectory', () => {
      fs.writeFileSync(path.join(tmpDir, '.ash.yml'), 'project_name: root');
      fs.mkdirSync(path.join(tmpDir, '.ash'));
      fs.writeFileSync(path.join(tmpDir, '.ash', '.ash.yml'), 'project_name: subdir');
      assert.equal(discoverConfigFile(tmpDir), path.join(tmpDir, '.ash.yml'));
    });

    it('prefers .ash.yml over .ash.yaml when both exist in root', () => {
      fs.writeFileSync(path.join(tmpDir, '.ash.yml'), 'project_name: yml');
      fs.writeFileSync(path.join(tmpDir, '.ash.yaml'), 'project_name: yaml');
      assert.equal(discoverConfigFile(tmpDir), path.join(tmpDir, '.ash.yml'));
    });
  });

  // ===== Parsing =====

  describe('parseConfigFile', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = makeTmpDir();
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('parses a valid YAML config with all sections', () => {
      const yamlContent = `
project_name: my-project
fail_on_findings: false
global_settings:
  severity_threshold: HIGH
  suppressions:
    - path: "src/**/*.py"
      reason: "accepted risk"
      rule_id: "B605"
      line_start: 1
      line_end: 50
      expiration: "2030-12-31"
  ignore_paths:
    - path: "vendor/**"
      reason: "third party"
scanners:
  bandit:
    enabled: true
  semgrep:
    enabled: false
`;
      const filePath = path.join(tmpDir, '.ash.yaml');
      fs.writeFileSync(filePath, yamlContent);
      const config = parseConfigFile(filePath);

      assert.equal(config.projectName, 'my-project');
      assert.equal(config.failOnFindings, false);
      assert.equal(config.severityThreshold, 'HIGH');
      assert.equal(config.suppressions.length, 1);
      assert.equal(config.suppressions[0].path, 'src/**/*.py');
      assert.equal(config.suppressions[0].rule_id, 'B605');
      assert.equal(config.suppressions[0].line_start, 1);
      assert.equal(config.suppressions[0].line_end, 50);
      assert.equal(config.ignorePaths.length, 1);
      assert.equal(config.ignorePaths[0].path, 'vendor/**');
      assert.equal(config.scanners.length, 2);
      assert.equal(config.scanners[0].name, 'bandit');
      assert.equal(config.scanners[0].enabled, true);
      assert.equal(config.scanners[1].name, 'semgrep');
      assert.equal(config.scanners[1].enabled, false);
      assert.equal(config.configFilePath, filePath);
    });

    it('parses a JSON config file', () => {
      const jsonContent = JSON.stringify({
        project_name: 'json-project',
        global_settings: {
          suppressions: [{ path: 'test.py', reason: 'test' }],
        },
      });
      const filePath = path.join(tmpDir, '.ash.json');
      fs.writeFileSync(filePath, jsonContent);
      const config = parseConfigFile(filePath);

      assert.equal(config.projectName, 'json-project');
      assert.equal(config.suppressions.length, 1);
    });

    it('returns default config for invalid YAML', () => {
      const filePath = path.join(tmpDir, '.ash.yaml');
      fs.writeFileSync(filePath, '{{{{invalid yaml');
      const config = parseConfigFile(filePath);

      assert.deepEqual(config.suppressions, []);
      assert.equal(config.severityThreshold, 'MEDIUM');
    });

    it('returns default config for nonexistent file', () => {
      const config = parseConfigFile('/nonexistent/path/.ash.yaml');
      assert.deepEqual(config.suppressions, []);
    });
  });

  describe('parseRawConfig', () => {
    it('returns default config for null input', () => {
      const config = parseRawConfig(null);
      assert.deepEqual(config.suppressions, []);
      assert.equal(config.severityThreshold, 'MEDIUM');
      assert.equal(config.projectName, 'ash-scan');
      assert.equal(config.failOnFindings, true);
    });

    it('returns default config for undefined input', () => {
      const config = parseRawConfig(undefined);
      assert.deepEqual(config.suppressions, []);
    });

    it('returns default config for non-object input', () => {
      const config = parseRawConfig('string');
      assert.deepEqual(config.suppressions, []);
    });

    it('extracts project_name', () => {
      const config = parseRawConfig({ project_name: 'my-app' });
      assert.equal(config.projectName, 'my-app');
    });

    it('uses default project_name when missing', () => {
      const config = parseRawConfig({});
      assert.equal(config.projectName, 'ash-scan');
    });

    it('extracts fail_on_findings', () => {
      const config = parseRawConfig({ fail_on_findings: false });
      assert.equal(config.failOnFindings, false);
    });

    it('uses default fail_on_findings when missing', () => {
      const config = parseRawConfig({});
      assert.equal(config.failOnFindings, true);
    });

    it('extracts severity_threshold from global_settings', () => {
      const config = parseRawConfig({
        global_settings: { severity_threshold: 'critical' },
      });
      assert.equal(config.severityThreshold, 'CRITICAL');
    });

    it('defaults severity_threshold to MEDIUM for invalid value', () => {
      const config = parseRawConfig({
        global_settings: { severity_threshold: 'INVALID' },
      });
      assert.equal(config.severityThreshold, 'MEDIUM');
    });

    it('handles missing global_settings gracefully', () => {
      const config = parseRawConfig({ project_name: 'test' });
      assert.deepEqual(config.suppressions, []);
      assert.deepEqual(config.ignorePaths, []);
    });
  });

  describe('parseSuppressions', () => {
    it('returns empty array for non-array input', () => {
      assert.deepEqual(parseSuppressions(null), []);
      assert.deepEqual(parseSuppressions(undefined), []);
      assert.deepEqual(parseSuppressions('string'), []);
      assert.deepEqual(parseSuppressions({}), []);
    });

    it('parses valid suppression entries', () => {
      const result = parseSuppressions([
        { path: 'src/*.py', reason: 'accepted', rule_id: 'B605', line_start: 1, line_end: 10, expiration: '2030-01-01' },
      ]);
      assert.equal(result.length, 1);
      assert.equal(result[0].path, 'src/*.py');
      assert.equal(result[0].reason, 'accepted');
      assert.equal(result[0].rule_id, 'B605');
      assert.equal(result[0].line_start, 1);
      assert.equal(result[0].line_end, 10);
      assert.equal(result[0].expiration, '2030-01-01');
    });

    it('sets optional fields to null when missing', () => {
      const result = parseSuppressions([{ path: 'test.py', reason: 'minimal' }]);
      assert.equal(result.length, 1);
      assert.equal(result[0].rule_id, null);
      assert.equal(result[0].line_start, null);
      assert.equal(result[0].line_end, null);
      assert.equal(result[0].expiration, null);
    });

    it('skips entries missing required path field', () => {
      const result = parseSuppressions([{ reason: 'no path' }]);
      assert.equal(result.length, 0);
    });

    it('skips entries missing required reason field', () => {
      const result = parseSuppressions([{ path: 'test.py' }]);
      assert.equal(result.length, 0);
    });

    it('skips non-object entries', () => {
      const result = parseSuppressions(['string', 42, null]);
      assert.equal(result.length, 0);
    });

    it('skips entries with empty path', () => {
      const result = parseSuppressions([{ path: '', reason: 'test' }]);
      assert.equal(result.length, 0);
    });

    it('skips entries with empty reason', () => {
      const result = parseSuppressions([{ path: 'test.py', reason: '' }]);
      assert.equal(result.length, 0);
    });
  });

  describe('parseIgnorePaths', () => {
    it('returns empty array for non-array input', () => {
      assert.deepEqual(parseIgnorePaths(null), []);
      assert.deepEqual(parseIgnorePaths(undefined), []);
    });

    it('parses valid ignore path entries', () => {
      const result = parseIgnorePaths([
        { path: 'vendor/**', reason: 'third party', expiration: '2030-06-15' },
      ]);
      assert.equal(result.length, 1);
      assert.equal(result[0].path, 'vendor/**');
      assert.equal(result[0].reason, 'third party');
      assert.equal(result[0].expiration, '2030-06-15');
    });

    it('skips entries missing required fields', () => {
      const result = parseIgnorePaths([{ path: 'vendor/**' }, { reason: 'no path' }]);
      assert.equal(result.length, 0);
    });
  });

  describe('parseScanners', () => {
    it('returns empty array for non-object input', () => {
      assert.deepEqual(parseScanners(null), []);
      assert.deepEqual(parseScanners(undefined), []);
      assert.deepEqual(parseScanners([]), []);
      assert.deepEqual(parseScanners('string'), []);
    });

    it('parses scanner entries from object keys', () => {
      const result = parseScanners({
        bandit: { enabled: true },
        semgrep: { enabled: false },
      });
      assert.equal(result.length, 2);
      assert.equal(result[0].name, 'bandit');
      assert.equal(result[0].enabled, true);
      assert.equal(result[1].name, 'semgrep');
      assert.equal(result[1].enabled, false);
    });

    it('defaults enabled to true when not specified', () => {
      const result = parseScanners({ bandit: {} });
      assert.equal(result.length, 1);
      assert.equal(result[0].enabled, true);
    });
  });

  // ===== Matching =====

  describe('isExpired', () => {
    it('returns false for null expiration (permanent)', () => {
      assert.equal(isExpired(null), false);
    });

    it('returns true for past date', () => {
      assert.equal(isExpired('2020-01-01'), true);
    });

    it('returns false for future date', () => {
      assert.equal(isExpired('2099-12-31'), false);
    });

    it('returns false for invalid date format (treated as non-expiring)', () => {
      assert.equal(isExpired('not-a-date'), false);
      assert.equal(isExpired('2025/01/01'), false);
      assert.equal(isExpired('Jan 1, 2025'), false);
    });
  });

  describe('matchesRuleId', () => {
    it('returns true when suppression rule_id is null (matches all)', () => {
      assert.equal(matchesRuleId('B605', null), true);
    });

    it('returns true for exact match', () => {
      assert.equal(matchesRuleId('B605', 'B605'), true);
    });

    it('returns true for glob match', () => {
      assert.equal(matchesRuleId('B605', 'B*'), true);
    });

    it('returns false when finding ruleId is empty', () => {
      assert.equal(matchesRuleId('', 'B605'), false);
    });

    it('returns false when glob does not match', () => {
      assert.equal(matchesRuleId('CKV_AWS_1', 'B*'), false);
    });

    it('matches with ** glob pattern', () => {
      assert.equal(matchesRuleId('semgrep.python.security.injection', 'semgrep.**'), true);
    });
  });

  describe('matchesFilePath', () => {
    it('returns true for exact match', () => {
      assert.equal(matchesFilePath('src/main.py', 'src/main.py'), true);
    });

    it('returns true for glob match', () => {
      assert.equal(matchesFilePath('src/app/main.py', 'src/**/*.py'), true);
    });

    it('returns false when finding filePath is empty', () => {
      assert.equal(matchesFilePath('', 'src/**'), false);
    });

    it('returns false when glob does not match', () => {
      assert.equal(matchesFilePath('test/main.js', 'src/**/*.py'), false);
    });

    it('matches single wildcard in directory', () => {
      assert.equal(matchesFilePath('src/main.py', 'src/*.py'), true);
    });
  });

  describe('matchesLineRange', () => {
    it('matches when suppression has no line range', () => {
      const finding = makeFinding({ startLine: 50, endLine: 55 });
      const suppression = makeSuppression({ line_start: null, line_end: null });
      assert.equal(matchesLineRange(finding, suppression), true);
    });

    it('matches when finding line is within range', () => {
      const finding = makeFinding({ startLine: 10, endLine: 10 });
      const suppression = makeSuppression({ line_start: 5, line_end: 15 });
      assert.equal(matchesLineRange(finding, suppression), true);
    });

    it('does not match when finding line is outside range', () => {
      const finding = makeFinding({ startLine: 20, endLine: 20 });
      const suppression = makeSuppression({ line_start: 5, line_end: 15 });
      assert.equal(matchesLineRange(finding, suppression), false);
    });

    it('matches when only line_start specified and finding is at or after', () => {
      const finding = makeFinding({ startLine: 15, endLine: 15 });
      const suppression = makeSuppression({ line_start: 10, line_end: null });
      assert.equal(matchesLineRange(finding, suppression), true);
    });

    it('does not match when only line_start specified and finding is before', () => {
      const finding = makeFinding({ startLine: 5, endLine: 5 });
      const suppression = makeSuppression({ line_start: 10, line_end: null });
      assert.equal(matchesLineRange(finding, suppression), false);
    });

    it('matches when only line_end specified and finding is at or before', () => {
      const finding = makeFinding({ startLine: 5, endLine: 5 });
      const suppression = makeSuppression({ line_start: null, line_end: 10 });
      assert.equal(matchesLineRange(finding, suppression), true);
    });

    it('does not match when only line_end specified and finding is after', () => {
      const finding = makeFinding({ startLine: 15, endLine: 15 });
      const suppression = makeSuppression({ line_start: null, line_end: 10 });
      assert.equal(matchesLineRange(finding, suppression), false);
    });

    it('returns false when finding has no line info but suppression requires it', () => {
      const finding = makeFinding({ startLine: 0, endLine: 0 });
      const suppression = makeSuppression({ line_start: 1, line_end: 10 });
      assert.equal(matchesLineRange(finding, suppression), false);
    });

    it('handles overlap with multi-line finding', () => {
      const finding = makeFinding({ startLine: 8, endLine: 12 });
      const suppression = makeSuppression({ line_start: 10, line_end: 20 });
      assert.equal(matchesLineRange(finding, suppression), true);
    });

    it('matches when line_end < line_start (invalid range treated as match-all)', () => {
      const finding = makeFinding({ startLine: 100, endLine: 100 });
      const suppression = makeSuppression({ line_start: 50, line_end: 10 });
      assert.equal(matchesLineRange(finding, suppression), true);
    });
  });

  describe('findMatchingSuppression', () => {
    it('returns null when no suppressions match', () => {
      const finding = makeFinding({ ruleId: 'CKV_AWS_1', filePath: 'infra/main.tf' });
      const suppressions = [makeSuppression({ path: 'src/**/*.py', rule_id: 'B*' })];
      assert.equal(findMatchingSuppression(finding, suppressions), null);
    });

    it('returns the first matching suppression', () => {
      const finding = makeFinding({ ruleId: 'B605', filePath: 'src/app/main.py' });
      const supp1 = makeSuppression({ path: 'src/**/*.py', rule_id: 'B*', reason: 'first' });
      const supp2 = makeSuppression({ path: 'src/**/*.py', rule_id: 'B605', reason: 'second' });
      const result = findMatchingSuppression(finding, [supp1, supp2]);
      assert.notEqual(result, null);
      assert.equal(result!.reason, 'first');
    });

    it('skips expired suppressions', () => {
      const finding = makeFinding({ ruleId: 'B605', filePath: 'src/main.py' });
      const expired = makeSuppression({ path: 'src/**', expiration: '2020-01-01', reason: 'expired' });
      const active = makeSuppression({ path: 'src/**', reason: 'active' });
      const result = findMatchingSuppression(finding, [expired, active]);
      assert.notEqual(result, null);
      assert.equal(result!.reason, 'active');
    });

    it('returns null when all suppressions are expired', () => {
      const finding = makeFinding({ ruleId: 'B605', filePath: 'src/main.py' });
      const expired = makeSuppression({ path: 'src/**', expiration: '2020-01-01' });
      assert.equal(findMatchingSuppression(finding, [expired]), null);
    });

    it('returns null for empty suppressions array', () => {
      const finding = makeFinding();
      assert.equal(findMatchingSuppression(finding, []), null);
    });

    it('matches with null rule_id (wildcard)', () => {
      const finding = makeFinding({ ruleId: 'ANY_RULE', filePath: 'src/main.py' });
      const suppression = makeSuppression({ path: 'src/**', rule_id: null });
      const result = findMatchingSuppression(finding, [suppression]);
      assert.notEqual(result, null);
    });

    it('respects line range constraints', () => {
      const finding = makeFinding({ filePath: 'src/main.py', startLine: 100, endLine: 100 });
      const suppression = makeSuppression({ path: 'src/**', line_start: 1, line_end: 50 });
      assert.equal(findMatchingSuppression(finding, [suppression]), null);
    });
  });

  // ===== Batch Matching =====

  describe('batchMatchSuppressions', () => {
    it('returns empty map for empty findings', () => {
      const suppressions = [makeSuppression()];
      const result = batchMatchSuppressions([], suppressions);
      assert.equal(result.size, 0);
    });

    it('returns empty map for empty suppressions', () => {
      const findings = [makeFinding()];
      const result = batchMatchSuppressions(findings, []);
      assert.equal(result.size, 0);
    });

    it('matches multiple findings correctly', () => {
      const findings = [
        makeFinding({ id: 'f1', ruleId: 'B605', filePath: 'src/main.py' }),
        makeFinding({ id: 'f2', ruleId: 'CKV_AWS_1', filePath: 'infra/main.tf' }),
        makeFinding({ id: 'f3', ruleId: 'B601', filePath: 'src/util.py' }),
      ];
      const suppressions = [
        makeSuppression({ path: 'src/**/*.py', rule_id: 'B*', reason: 'bandit suppressions' }),
      ];

      const result = batchMatchSuppressions(findings, suppressions);
      assert.equal(result.size, 2); // f1 and f3 match
      assert.ok(result.has('f1'));
      assert.ok(result.has('f3'));
      assert.ok(!result.has('f2')); // CKV rule doesn't match B*
    });

    it('skips expired suppressions in batch', () => {
      const findings = [makeFinding({ id: 'f1', filePath: 'src/main.py' })];
      const suppressions = [
        makeSuppression({ path: 'src/**', expiration: '2020-01-01' }),
      ];

      const result = batchMatchSuppressions(findings, suppressions);
      assert.equal(result.size, 0);
    });

    it('first match wins in batch processing', () => {
      const findings = [makeFinding({ id: 'f1', filePath: 'src/main.py' })];
      const suppressions = [
        makeSuppression({ path: 'src/**', reason: 'first' }),
        makeSuppression({ path: 'src/**/*.py', reason: 'second' }),
      ];

      const result = batchMatchSuppressions(findings, suppressions);
      assert.equal(result.get('f1')?.reason, 'first');
    });
  });
});
