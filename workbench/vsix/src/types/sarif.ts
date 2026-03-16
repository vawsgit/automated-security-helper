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
