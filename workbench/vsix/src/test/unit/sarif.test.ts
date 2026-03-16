import assert from 'node:assert/strict';
import {
  parseSarif,
  extractSeverity,
  normalizeFilePath,
  deduplicateFindings,
} from '../../services/sarif';
import type { ParsedFinding } from '../../services/sarif';
import {
  createSarifResult,
  createSarifRun,
  createSarifLog,
  createSingleRunSarif,
  createAshSeverityResult,
  createMultiRunSarif,
  createMinimalResult,
} from '../fixtures/sarif-factory';

describe('SARIF Parser', () => {

  // ─── US1: Parse Multi-Scanner Scan Results ───

  describe('US1: Multi-Scanner Extraction', () => {
    it('extracts findings from multi-run SARIF with all 8 ASH scanners', () => {
      const scanners = [
        'bandit', 'checkov', 'semgrep', 'cdk-nag',
        'cfn-nag', 'detect-secrets', 'grype', 'npm-audit',
      ];

      const configs = scanners.map((name, i) => ({
        toolName: name,
        results: [
          createSarifResult({
            ruleId: `${name}-rule-1`,
            locations: [{
              physicalLocation: {
                artifactLocation: { uri: `file:///project/src/file-${name}-1.py` },
                region: { startLine: i + 1 },
              },
            }],
          }),
          createSarifResult({
            ruleId: `${name}-rule-2`,
            locations: [{
              physicalLocation: {
                artifactLocation: { uri: `file:///project/src/file-${name}-2.py` },
                region: { startLine: i + 10 },
              },
            }],
          }),
        ],
      }));

      const sarif = createMultiRunSarif(configs);
      const findings = parseSarif(sarif, '/project');

      // 8 scanners × 2 results each = 16 findings (all unique ruleId+file)
      assert.equal(findings.length, 16);

      // Verify each scanner is represented
      for (const name of scanners) {
        const scannerFindings = findings.filter((f) => f.scanner === name);
        assert.equal(scannerFindings.length, 2, `Expected 2 findings from ${name}`);
      }
    });

    it('handles empty results array (clean scan)', () => {
      const sarif = createSarifLog([
        createSarifRun([], 'bandit'),
        createSarifRun([], 'semgrep'),
      ]);

      const findings = parseSarif(sarif, '/project');
      assert.equal(findings.length, 0);
    });

    it('extracts scanner name from run.tool.driver.name', () => {
      const sarif = createSingleRunSarif(
        [createSarifResult({ ruleId: 'S001' })],
        'semgrep',
      );

      const findings = parseSarif(sarif, '/project');
      assert.equal(findings.length, 1);
      assert.equal(findings[0].scanner, 'semgrep');
    });
  });

  // ─── US2: Map Severity Accurately ───

  describe('US2: Severity Mapping', () => {
    const dummyRun = createSarifRun([], 'test');

    it('maps ASH properties.severity when present', () => {
      const result = createAshSeverityResult('CRITICAL', 'warning', 'severity');
      const severity = extractSeverity(result, dummyRun);
      assert.equal(severity, 'CRITICAL');
    });

    it('maps ASH properties[ash/severity] when present', () => {
      const result = createAshSeverityResult('HIGH', 'note', 'ash/severity');
      const severity = extractSeverity(result, dummyRun);
      assert.equal(severity, 'HIGH');
    });

    it('falls back to SARIF level mapping for all levels', () => {
      const cases: Array<[SarifLevelInput, string]> = [
        ['error', 'HIGH'],
        ['warning', 'MEDIUM'],
        ['note', 'LOW'],
        ['none', 'INFO'],
      ];

      for (const [level, expected] of cases) {
        const result = createSarifResult({ level, properties: undefined });
        const severity = extractSeverity(result, dummyRun);
        assert.equal(severity, expected, `SARIF level "${level}" should map to ${expected}`);
      }
    });

    it('defaults to MEDIUM when level is missing', () => {
      const result = createSarifResult({ properties: undefined });
      // Force level to be undefined to simulate missing field
      delete (result as unknown as Record<string, unknown>).level;
      const severity = extractSeverity(result, dummyRun);
      assert.equal(severity, 'MEDIUM');
    });
  });

  // ─── US3: Normalize File Paths ───

  describe('US3: Path Normalization', () => {
    it('strips file:// prefix and makes path relative', () => {
      const result = normalizeFilePath(
        'file:///home/user/project/src/app.py',
        '/home/user/project',
      );
      assert.equal(result, 'src/app.py');
    });

    it('handles already-relative paths', () => {
      const result = normalizeFilePath('src/app.py', '/home/user/project');
      assert.equal(result, 'src/app.py');
    });

    it('handles trailing slash on sourceDir', () => {
      const result = normalizeFilePath(
        'file:///home/user/project/src/app.py',
        '/home/user/project/',
      );
      assert.equal(result, 'src/app.py');
    });

    it('returns unknown for empty or missing URI', () => {
      assert.equal(normalizeFilePath('', '/source'), 'unknown');
      assert.equal(normalizeFilePath(undefined as unknown as string, '/source'), 'unknown');
    });
  });

  // ─── US4: Deduplicate Findings ───

  describe('US4: Deduplication', () => {
    it('deduplicates by (ruleId, file) and merges line ranges', () => {
      const findings: ParsedFinding[] = [
        {
          ruleId: 'B101', scanner: 'bandit', severity: 'HIGH',
          file: 'app.py', startLine: 10, endLine: 15,
          title: 'Hardcoded password', description: 'Short desc',
        },
        {
          ruleId: 'B101', scanner: 'semgrep', severity: 'MEDIUM',
          file: 'app.py', startLine: 12, endLine: 20,
          title: 'Password issue', description: 'A longer description here',
        },
      ];

      const deduped = deduplicateFindings(findings);
      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].startLine, 10);
      assert.equal(deduped[0].endLine, 20);
      assert.ok(deduped[0].scanner.includes('bandit'));
      assert.ok(deduped[0].scanner.includes('semgrep'));
    });

    it('keeps findings with different ruleIds or files separate', () => {
      const findings: ParsedFinding[] = [
        {
          ruleId: 'ruleA', scanner: 'bandit', severity: 'HIGH',
          file: 'fileX.py', startLine: 1, title: 'A', description: 'A',
        },
        {
          ruleId: 'ruleB', scanner: 'bandit', severity: 'HIGH',
          file: 'fileX.py', startLine: 1, title: 'B', description: 'B',
        },
        {
          ruleId: 'ruleA', scanner: 'bandit', severity: 'HIGH',
          file: 'fileY.py', startLine: 1, title: 'C', description: 'C',
        },
      ];

      const deduped = deduplicateFindings(findings);
      assert.equal(deduped.length, 3);
    });

    it('keeps highest severity during dedup merge', () => {
      const findings: ParsedFinding[] = [
        {
          ruleId: 'R1', scanner: 'a', severity: 'LOW',
          file: 'x.py', startLine: 1, title: 'T', description: 'D',
        },
        {
          ruleId: 'R1', scanner: 'b', severity: 'HIGH',
          file: 'x.py', startLine: 2, title: 'T', description: 'D',
        },
      ];

      const deduped = deduplicateFindings(findings);
      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].severity, 'HIGH');
    });

    it('concatenates scanner names with comma separator (unique only)', () => {
      const findings: ParsedFinding[] = [
        {
          ruleId: 'R1', scanner: 'bandit', severity: 'MEDIUM',
          file: 'x.py', startLine: 1, title: 'T', description: 'D',
        },
        {
          ruleId: 'R1', scanner: 'semgrep', severity: 'MEDIUM',
          file: 'x.py', startLine: 2, title: 'T', description: 'D',
        },
        {
          ruleId: 'R1', scanner: 'bandit', severity: 'MEDIUM',
          file: 'x.py', startLine: 3, title: 'T', description: 'D',
        },
      ];

      const deduped = deduplicateFindings(findings);
      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].scanner, 'bandit, semgrep');
    });
  });

  // ─── US5: Handle Incomplete SARIF Gracefully ───

  describe('US5: Missing Fields', () => {
    it('handles missing region (no line numbers)', () => {
      const result = createSarifResult({
        ruleId: 'no-region',
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: 'file:///project/src/app.py' },
          },
        }],
      });
      const sarif = createSingleRunSarif([result]);
      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 1);
      assert.equal(findings[0].startLine, 1);
      assert.equal(findings[0].endLine, undefined);
    });

    it('handles missing snippet', () => {
      const result = createSarifResult({
        ruleId: 'no-snippet',
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: 'file:///project/src/app.py' },
            region: { startLine: 5, endLine: 10 },
          },
        }],
      });
      const sarif = createSingleRunSarif([result]);
      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 1);
      assert.equal(findings[0].snippet, undefined);
    });

    it('handles missing endLine', () => {
      const result = createSarifResult({
        ruleId: 'no-endline',
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: 'file:///project/src/app.py' },
            region: { startLine: 42 },
          },
        }],
      });
      const sarif = createSingleRunSarif([result]);
      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 1);
      assert.equal(findings[0].startLine, 42);
      assert.equal(findings[0].endLine, undefined);
    });

    it('handles missing properties bag', () => {
      const result = createSarifResult({
        ruleId: 'no-props',
        level: 'error',
        properties: undefined,
      });
      const sarif = createSingleRunSarif([result]);
      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'HIGH'); // error → HIGH fallback
    });

    it('handles empty locations array', () => {
      const result = createMinimalResult({ ruleId: 'no-locations' });
      const sarif = createSingleRunSarif([result]);
      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 1);
      assert.equal(findings[0].file, 'unknown');
      assert.equal(findings[0].startLine, 1);
    });
  });

  // ─── Edge Cases ───

  describe('Edge Cases', () => {
    it('returns empty array for zero runs', () => {
      const sarif = createSarifLog([]);
      const findings = parseSarif(sarif, '/project');
      assert.equal(findings.length, 0);
    });

    it('uses unknown for missing ruleId', () => {
      const result = createSarifResult({});
      // Force ruleId to be empty
      result.ruleId = '';
      const sarif = createSingleRunSarif([result]);
      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'unknown');
    });

    it('extracts title from rules[].shortDescription', () => {
      const result = createSarifResult({
        ruleId: 'B101',
        message: { text: 'Full description of the issue' },
      });
      const run = createSarifRun([result], 'bandit');
      // The factory auto-populates rules from results, but let's set explicitly
      run.tool.driver.rules = [
        { id: 'B101', shortDescription: { text: 'Hardcoded password' } },
      ];
      const sarif = createSarifLog([run]);
      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, 'Hardcoded password');
      assert.equal(findings[0].description, 'Full description of the issue');
    });

    it('falls back to message.text for title when no rules match', () => {
      const result = createSarifResult({
        ruleId: 'R999',
        message: { text: 'Use of eval detected' },
      });
      const run = createSarifRun([result], 'semgrep');
      run.tool.driver.rules = []; // Empty rules
      const sarif = createSarifLog([run]);
      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, 'Use of eval detected');
    });
  });
});

// Type helper to avoid TS errors in test table
type SarifLevelInput = 'error' | 'warning' | 'note' | 'none';
