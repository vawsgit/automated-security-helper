import { useState } from 'react';
import { SuppressionForm } from '@/components/SuppressionForm';
import { Button } from '@/components/ui/button';
import type { FindingRow, SuppressionInput, SuppressionScope } from '../../../types/types';

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
  analysisMetadata: null,
  suppression: null,
  isCurrentlySuppressed: false,
  suppressionSource: null,
};

const findingWithAiAnalysis: FindingRow = {
  ...baseFinding,
  id: 'demo-f3',
  aiAnalysis: {
    explanation: 'This is a hardcoded test credential used only in development configuration.',
    riskAssessment: {
      exploitability: 'LOW',
      exploitabilityRationale: 'Only accessible in local dev environment',
      impact: 'LOW',
      impactRationale: 'Test database with no sensitive data',
      likelihood: 'NONE',
      likelihoodRationale: 'Not deployed to any environment',
    },
    suggestedFix: null,
    references: [],
  },
  analysisMetadata: {
    analyzedAt: '2025-01-15T11:00:00Z',
    modelId: 'claude-sonnet-4-6',
    costUsd: 0.02,
    toolsUsed: ['Read', 'Grep'],
  },
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

const DEMO_GENERATED_MESSAGE = `Finding: Hardcoded password string detected in database configuration file (src/config/database.py, line 42).
Risk Assessment: This is a development-only test credential used for local database access. The value "supersecret123" is not used in any deployed environment and the file is excluded from production builds.
Rationale: This finding is a known test credential documented in the project's development setup guide. Suppressing avoids repeated triage of a deliberate configuration choice.
Scope: Suppression applies to rule HardcodedPasswordString in src/config/database.py only, covering this specific test configuration value.`;

export function SuppressionFormDemo() {
  const [lastSubmit, setLastSubmit] = useState<SuppressionInput | null>(null);
  const [pendingDemo, setPendingDemo] = useState(false);

  // Generation demo states
  const [genGenerating, setGenGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const simulateGenerate = (_scope: SuppressionScope, _mode: 'generate' | 'regenerate') => {
    setGenGenerating(true);
    setGenError(null);
    setTimeout(() => {
      setGenGenerating(false);
      setGenMessage(DEMO_GENERATED_MESSAGE);
    }, 2000);
  };

  const simulateRefine = (_scope: SuppressionScope, _existingMessage: string) => {
    setGenGenerating(true);
    setGenError(null);
    setTimeout(() => {
      setGenGenerating(false);
      setGenMessage(DEMO_GENERATED_MESSAGE + '\n\n(Refined version with improved clarity.)');
    }, 2000);
  };

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

      {/* With AI generation — interactive demo */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">With AI generation (interactive)</h4>
        <SuppressionForm
          finding={findingWithAiAnalysis}
          isPending={false}
          onSubmit={(input) => setLastSubmit(input)}
          onCancel={() => {}}
          isGenerating={genGenerating}
          generatedMessage={genMessage}
          generationError={genError}
          claudeSettingsDetected={true}
          onGenerateMessage={simulateGenerate}
          onRefineMessage={simulateRefine}
          onClearGeneratedMessage={() => { setGenMessage(null); setGenError(null); }}
        />
      </div>

      {/* Generating (loading spinner) */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Generating state (loading)</h4>
        <SuppressionForm
          finding={baseFinding}
          isPending={false}
          onSubmit={() => {}}
          onCancel={() => {}}
          isGenerating={true}
          generatedMessage={null}
          generationError={null}
          claudeSettingsDetected={true}
          onGenerateMessage={() => {}}
          onClearGeneratedMessage={() => {}}
        />
      </div>

      {/* Generated message populated */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Generated message populated</h4>
        <SuppressionForm
          finding={baseFinding}
          isPending={false}
          onSubmit={(input) => setLastSubmit(input)}
          onCancel={() => {}}
          isGenerating={false}
          generatedMessage={DEMO_GENERATED_MESSAGE}
          generationError={null}
          claudeSettingsDetected={true}
          onGenerateMessage={() => {}}
          onRefineMessage={() => {}}
          onClearGeneratedMessage={() => {}}
        />
      </div>

      {/* Error state with guidance */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">Generation error</h4>
        <SuppressionForm
          finding={baseFinding}
          isPending={false}
          onSubmit={() => {}}
          onCancel={() => {}}
          isGenerating={false}
          generatedMessage={null}
          generationError="Generation failed — no structured output returned. The AI service may be temporarily unavailable."
          claudeSettingsDetected={true}
          onGenerateMessage={() => {}}
          onClearGeneratedMessage={() => { setGenError(null); }}
        />
      </div>

      {/* Disabled state (no AI configured) */}
      <div>
        <h4 className="text-xs font-semibold mb-2 opacity-70">AI not configured (disabled)</h4>
        <SuppressionForm
          finding={baseFinding}
          isPending={false}
          onSubmit={() => {}}
          onCancel={() => {}}
          isGenerating={false}
          generatedMessage={null}
          generationError={null}
          claudeSettingsDetected={false}
          onGenerateMessage={() => {}}
          onClearGeneratedMessage={() => {}}
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
