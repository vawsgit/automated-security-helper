import assert from 'node:assert/strict';
import { createSarifResult, createSingleRunSarif } from '../fixtures/sarif-factory';

describe('SARIF Factory (smoke test)', () => {
  it('creates a valid SARIF result with defaults', () => {
    const result = createSarifResult();
    assert.equal(result.ruleId, 'test-rule-001');
    assert.equal(result.level, 'warning');
    assert.equal(result.locations.length, 1);
  });

  it('creates a valid SARIF log with one run', () => {
    const sarif = createSingleRunSarif([
      createSarifResult({ ruleId: 'R001' }),
      createSarifResult({ ruleId: 'R002', level: 'error' }),
    ]);
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs.length, 1);
    assert.equal(sarif.runs[0].results.length, 2);
    assert.equal(sarif.runs[0].tool.driver.name, 'test-scanner');
  });

  it('accepts overrides for all fields', () => {
    const result = createSarifResult({
      ruleId: 'custom-rule',
      level: 'error',
      properties: { severity: 'CRITICAL' },
    });
    assert.equal(result.ruleId, 'custom-rule');
    assert.equal(result.level, 'error');
    assert.equal(result.properties?.severity, 'CRITICAL');
  });
});
