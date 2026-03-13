/**
 * Factory functions for generating SARIF 2.1.0 test data.
 * Used by unit tests to create realistic SARIF structures
 * without depending on real ASH CLI output.
 */

export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: {
        startLine: number;
        endLine?: number;
        snippet?: { text: string };
      };
    };
  }>;
  properties?: Record<string, unknown>;
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      rules: Array<{ id: string; shortDescription?: { text: string } }>;
    };
  };
  results: SarifResult[];
}

export interface SarifLog {
  version: '2.1.0';
  $schema?: string;
  runs: SarifRun[];
}

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
