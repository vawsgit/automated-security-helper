import { useState } from 'react';
import { SuppressionForm } from '@/components/SuppressionForm';
import { Button } from '@/components/ui/button';
import type { FindingRow, SuppressionInput } from '../../../types/types';

const baseFinding: FindingRow = {
  id: 'demo-f1',
  scanId: 's1',
  scanTargetId: 'st1',
  title: 'Hardcoded password in config',
  description: 'A hardcoded password was detected in the configuration file.',
  severity: 'HIGH',
  disposition: 'PENDING',
  scanner: 'detect-secrets',
  ruleId: 'HardcodedPasswordString',
  filePath: 'src/config/database.py',
  startLine: 42,
  endLine: 42,
  codeSnippet: 'DB_PASSWORD = "supersecret123"',
  notes: 'Known test credential',
  firstDetectedAt: '2025-01-15T10:00:00Z',
  aiAnalysis: null,
  suppression: null,
  isCurrentlySuppressed: false,
  suppressionSource: null,
};

const noLineFinding: FindingRow = {
  ...baseFinding,
  id: 'demo-f2',
  title: 'Missing HTTPS',
  ruleId: 'S5332',
  startLine: 0,
  endLine: 0,
  codeSnippet: '',
};

export function SuppressionFormDemo() {
  const [lastSubmit, setLastSubmit] = useState<SuppressionInput | null>(null);
  const [pendingDemo, setPendingDemo] = useState(false);

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl">
      {/* Default state */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Default (with line range)</h4>
        <SuppressionForm
          finding={baseFinding}
          isPending={false}
          onSubmit={(input) => setLastSubmit(input)}
          onCancel={() => setLastSubmit(null)}
        />
      </div>

      {/* No line range */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">No line range data</h4>
        <SuppressionForm
          finding={noLineFinding}
          isPending={false}
          onSubmit={(input) => setLastSubmit(input)}
          onCancel={() => setLastSubmit(null)}
        />
      </div>

      {/* Pending state */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Pending state</h4>
        <div className="flex gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={() => setPendingDemo(!pendingDemo)}>
            Toggle pending: {pendingDemo ? 'ON' : 'OFF'}
          </Button>
        </div>
        <SuppressionForm
          finding={baseFinding}
          isPending={pendingDemo}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      </div>

      {/* Last submission output */}
      {lastSubmit && (
        <div className="rounded border p-3 text-xs" style={{ borderColor: 'var(--vscode-panel-border)' }}>
          <h4 className="font-semibold mb-1">Last Submission:</h4>
          <pre className="whitespace-pre-wrap">{JSON.stringify(lastSubmit, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
