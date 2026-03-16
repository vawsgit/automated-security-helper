/**
 * Factory functions for generating SARIF 2.1.0 test data.
 * Used by unit tests to create realistic SARIF structures
 * without depending on real ASH CLI output.
 */

export type { SarifResult, SarifRun, SarifLog } from '../../types/sarif';
import type { SarifResult, SarifRun, SarifLog } from '../../types/sarif';

export function createSarifResult(overrides?: Partial<SarifResult>): SarifResult {
  return {
    ruleId: 'test-rule-001',
    level: 'warning',
    message: { text: 'Test finding description' },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: 'file:///project/src/app.ts' },
          region: { startLine: 10, endLine: 15 },
        },
      },
    ],
    ...overrides,
  };
}

export function createSarifRun(results: SarifResult[], toolName = 'test-scanner'): SarifRun {
  return {
    tool: {
      driver: {
        name: toolName,
        rules: results.map((r) => ({
          id: r.ruleId,
          shortDescription: { text: r.message.text },
        })),
      },
    },
    results,
  };
}

export function createSarifLog(runs: SarifRun[]): SarifLog {
  return {
    version: '2.1.0',
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    runs,
  };
}

/** Create a complete SARIF log with one run containing the given results. */
export function createSingleRunSarif(results: SarifResult[], toolName = 'test-scanner'): SarifLog {
  return createSarifLog([createSarifRun(results, toolName)]);
}

/** Create a SarifResult with ASH-specific severity in properties. */
export function createAshSeverityResult(
  severity: string,
  level: SarifResult['level'] = 'warning',
  propertyKey: 'severity' | 'ash/severity' = 'severity',
): SarifResult {
  return createSarifResult({
    level,
    properties: { [propertyKey]: severity },
  });
}

/** Create a multi-run SARIF log from scanner configurations. */
export function createMultiRunSarif(
  configs: Array<{ toolName: string; results: SarifResult[] }>,
): SarifLog {
  return createSarifLog(configs.map((c) => createSarifRun(c.results, c.toolName)));
}

/** Create a SarifResult with only required fields (no locations, no properties). */
export function createMinimalResult(overrides?: Partial<SarifResult>): SarifResult {
  return {
    ruleId: 'minimal-rule',
    level: 'warning',
    message: { text: 'Minimal finding' },
    locations: [],
    ...overrides,
  };
}
