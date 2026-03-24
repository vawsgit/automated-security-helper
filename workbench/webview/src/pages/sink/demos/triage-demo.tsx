import { useState } from 'react';
import { TriageChart } from '@/components/TriageChart';
import { TriageFindingPanel } from '@/components/TriageFindingPanel';
import type { Severity, TriageSeverityBreakdown, FindingRow } from '../../../types/types';

const mockBreakdown: Record<Severity, TriageSeverityBreakdown> = {
  CRITICAL: { total: 3, suppress: 0, easyFix: 1, systemic: 2, unanalyzed: 0, addressed: 1 },
  HIGH: { total: 8, suppress: 3, easyFix: 3, systemic: 1, unanalyzed: 1, addressed: 4 },
  MEDIUM: { total: 12, suppress: 5, easyFix: 4, systemic: 2, unanalyzed: 1, addressed: 6 },
  LOW: { total: 5, suppress: 2, easyFix: 2, systemic: 0, unanalyzed: 1, addressed: 3 },
  INFO: { total: 2, suppress: 1, easyFix: 1, systemic: 0, unanalyzed: 0, addressed: 2 },
};

const suppressFinding: FindingRow = {
  id: 'demo-suppress', scanId: 's1', scanTargetId: 'st1',
  title: 'Hardcoded port number in config', description: 'Port number is hardcoded.',
  severity: 'MEDIUM', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'hardcoded-config',
  filePath: 'src/config.ts', startLine: 3, endLine: 3,
  codeSnippet: 'const PORT = 3000;', notes: '', firstDetectedAt: '2026-01-01T00:00:00Z',
  aiAnalysis: null, analysisMetadata: null, suppression: null,
  isCurrentlySuppressed: false, suppressionSource: null,
  triageAnalysis: {
    category: 'suppress', explanation: 'This is a development config default.', risk: 'Minimal risk — overridden by environment variable in production.',
    suppressionRationale: 'The port is only used as a fallback in local development.', suggestedScope: 'file_rule',
    suggestedJustification: 'Development default only; production uses PORT env var.',
  },
  triageMetadata: { classifiedAt: '2026-01-01T12:00:00Z', modelId: 'claude-sonnet-4-6', costUsd: 0.003 },
  triageFingerprint: 'abc123', isTriageStale: false,
};

const easyFixFinding: FindingRow = {
  id: 'demo-easyfix', scanId: 's1', scanTargetId: 'st1',
  title: 'Insecure random number generator', description: 'Math.random() is not cryptographically secure.',
  severity: 'HIGH', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'insecure-random',
  filePath: 'src/auth/token.ts', startLine: 19, endLine: 19,
  codeSnippet: 'const token = Math.random().toString(36).substring(2);', notes: '',
  firstDetectedAt: '2026-01-01T00:00:00Z',
  aiAnalysis: null, analysisMetadata: null, suppression: null,
  isCurrentlySuppressed: false, suppressionSource: null,
  triageAnalysis: {
    category: 'easy_fix', explanation: 'Math.random() is predictable and unsuitable for security tokens.',
    risk: 'An attacker could predict generated tokens and hijack sessions.',
    fixDescription: 'Replace Math.random() with crypto.randomUUID() or crypto.getRandomValues().',
    codeBefore: 'const token = Math.random().toString(36).substring(2);',
    codeAfter: 'const token = crypto.randomUUID();',
    filePath: 'src/auth/token.ts', startLine: 19, endLine: 19,
  },
  triageMetadata: { classifiedAt: '2026-01-01T12:00:00Z', modelId: 'claude-sonnet-4-6', costUsd: 0.004 },
  triageFingerprint: 'def456', isTriageStale: false,
};

const systemicFinding: FindingRow = {
  id: 'demo-systemic', scanId: 's1', scanTargetId: 'st1',
  title: 'SQL injection vulnerability', description: 'User input concatenated directly into SQL query.',
  severity: 'CRITICAL', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'sql-injection',
  filePath: 'src/api/users.ts', startLine: 42, endLine: 44,
  codeSnippet: 'const query = `SELECT * FROM users WHERE id = ${req.params.id}`;', notes: '',
  firstDetectedAt: '2026-01-01T00:00:00Z',
  aiAnalysis: null, analysisMetadata: null, suppression: null,
  isCurrentlySuppressed: false, suppressionSource: null,
  triageAnalysis: {
    category: 'systemic', explanation: 'Raw SQL concatenation with user input enables injection attacks.',
    risk: 'Full database compromise — attackers can read, modify, or delete all data.',
    complexityRationale: 'The pattern is used across 12+ query functions; requires parameterized query migration.',
    repairGuidance: {
      affectedAreas: ['src/api/users.ts', 'src/api/orders.ts', 'src/db/queries.ts'],
      vulnerabilityNature: 'String concatenation of untrusted input into SQL statements.',
      remediationApproach: '1. Migrate all queries to parameterized statements. 2. Add an ORM layer. 3. Add input validation.',
      sideEffects: ['Query performance may change', 'Dynamic query patterns need refactoring'],
      testingRecommendations: 'Run full integration test suite after migration. Add SQL injection fuzzing tests.',
    },
  },
  triageMetadata: { classifiedAt: '2026-01-01T12:00:00Z', modelId: 'claude-sonnet-4-6', costUsd: 0.005 },
  triageFingerprint: 'ghi789', isTriageStale: false,
};

export function TriageDemo() {
  const [lastDrillDown, setLastDrillDown] = useState<string | null>(null);

  return (
    <div className="space-y-6 w-full">
      {/* Chart Demo */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Triage Chart</h4>
        <TriageChart
          bySeverity={mockBreakdown}
          onDrillDown={(s, c) => setLastDrillDown(`${s} / ${c}`)}
        />
        {lastDrillDown && (
          <p className="text-xs mt-2 opacity-60">Drill-down clicked: {lastDrillDown}</p>
        )}
      </div>

      {/* Suppress Panel */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Suppress Finding Panel</h4>
        <TriageFindingPanel
          finding={suppressFinding}
          category="suppress"
          actionError={null}
          actionSuccess={null}
          onApplyFix={() => {}}
          onApplySuppression={() => alert('Suppress clicked')}
          onCopyGuidance={() => {}}
        />
      </div>

      {/* Easy Fix Panel */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Easy Fix Finding Panel</h4>
        <TriageFindingPanel
          finding={easyFixFinding}
          category="easy_fix"
          actionError={null}
          actionSuccess={null}
          onApplyFix={() => alert('Fix clicked')}
          onApplySuppression={() => {}}
          onCopyGuidance={() => {}}
        />
      </div>

      {/* Systemic Panel */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Systemic Finding Panel</h4>
        <TriageFindingPanel
          finding={systemicFinding}
          category="systemic"
          actionError={null}
          actionSuccess={null}
          onApplyFix={() => {}}
          onApplySuppression={() => {}}
          onCopyGuidance={(f) => alert('Guidance copied for: ' + f.title)}
        />
      </div>

      {/* With success/error states */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Success State</h4>
        <TriageFindingPanel
          finding={suppressFinding}
          category="suppress"
          actionError={null}
          actionSuccess="Suppressed"
          onApplyFix={() => {}}
          onApplySuppression={() => {}}
          onCopyGuidance={() => {}}
        />
      </div>

      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Error State</h4>
        <TriageFindingPanel
          finding={easyFixFinding}
          category="easy_fix"
          actionError="Fix failed: codeBefore does not match file contents"
          actionSuccess={null}
          onApplyFix={() => {}}
          onApplySuppression={() => {}}
          onCopyGuidance={() => {}}
        />
      </div>
    </div>
  );
}
