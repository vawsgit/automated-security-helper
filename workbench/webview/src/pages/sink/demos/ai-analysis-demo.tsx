import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AiAnalysisPanel } from '../../../components/AiAnalysisPanel';
import { AnalysisProgress } from '../../../components/AnalysisProgress';
import { Sparkles } from 'lucide-react';
import type { AiAnalysis, AnalysisMetadata } from '../../../types/types';

const sampleAnalysis: AiAnalysis = {
  explanation: 'This SQL query concatenates user input directly into the query string without parameterization, creating a SQL injection vulnerability. An attacker could manipulate the `username` parameter to execute arbitrary SQL commands.',
  riskAssessment: {
    exploitability: 'HIGH',
    exploitabilityRationale: 'The user input flows directly from a request parameter to the SQL query with no sanitization.',
    impact: 'CRITICAL',
    impactRationale: 'Successful exploitation could lead to full database access, data exfiltration, or data destruction.',
    likelihood: 'HIGH',
    likelihoodRationale: 'SQL injection is well-understood and automated tools can detect and exploit this pattern.',
  },
  suggestedFix: {
    description: 'Use parameterized queries instead of string concatenation.',
    diffText: '- query = f"SELECT * FROM users WHERE name = \'{username}\'"\n+ query = "SELECT * FROM users WHERE name = %s"\n+ cursor.execute(query, (username,))',
    language: 'python',
  },
  references: [
    { title: 'CWE-89: SQL Injection', url: 'https://cwe.mitre.org/data/definitions/89.html' },
    { title: 'OWASP SQL Injection Prevention', url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html' },
  ],
};

const sampleMetadata: AnalysisMetadata = {
  analyzedAt: new Date().toISOString(),
  modelId: 'claude-sonnet-4-6-20250514',
  costUsd: 0.0372,
  toolsUsed: ['Read', 'Grep', 'get_finding_context', 'list_related_findings'],
};

const ERROR_GUIDANCE: Record<string, string> = {
  credentials_missing: 'AI provider credentials are not configured. Open Settings and configure ashWorkbench.llm.provider and credentials.',
  auth_failed: 'Authentication failed. Check your API key or AWS credentials in Settings.',
  network_error: 'Network error connecting to the AI provider. Check your connection and retry.',
  budget_exceeded: 'Analysis stopped: cost reached the budget limit. Increase ashWorkbench.llm.maxBudgetUsd in Settings.',
};

type DemoState = 'idle' | 'progress' | 'complete' | 'error-credentials' | 'error-auth' | 'error-network' | 'error-budget';

export function AiAnalysisDemo() {
  const [state, setState] = useState<DemoState>('idle');

  return (
    <div className="space-y-6 max-w-2xl">
      {/* State selector */}
      <div className="flex flex-wrap gap-2">
        <Button variant={state === 'idle' ? 'secondary' : 'outline'} size="sm" onClick={() => setState('idle')}>Analyze Button</Button>
        <Button variant={state === 'progress' ? 'secondary' : 'outline'} size="sm" onClick={() => setState('progress')}>Progress</Button>
        <Button variant={state === 'complete' ? 'secondary' : 'outline'} size="sm" onClick={() => setState('complete')}>Complete</Button>
        <Button variant={state === 'error-credentials' ? 'secondary' : 'outline'} size="sm" onClick={() => setState('error-credentials')}>Error: Credentials</Button>
        <Button variant={state === 'error-auth' ? 'secondary' : 'outline'} size="sm" onClick={() => setState('error-auth')}>Error: Auth</Button>
        <Button variant={state === 'error-network' ? 'secondary' : 'outline'} size="sm" onClick={() => setState('error-network')}>Error: Network</Button>
        <Button variant={state === 'error-budget' ? 'secondary' : 'outline'} size="sm" onClick={() => setState('error-budget')}>Error: Budget</Button>
      </div>

      {/* Analyze button state */}
      {state === 'idle' && (
        <Button variant="outline" size="sm" onClick={() => setState('progress')}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Analyze with AI
        </Button>
      )}

      {/* Progress state */}
      {state === 'progress' && (
        <AnalysisProgress
          message="Reading auth.py and searching for injection patterns..."
          toolName="Grep"
          onCancel={() => setState('idle')}
        />
      )}

      {/* Complete state */}
      {state === 'complete' && (
        <div className="space-y-3">
          <AiAnalysisPanel analysis={sampleAnalysis} metadata={sampleMetadata} />
          <Button variant="outline" size="sm" onClick={() => setState('progress')}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Re-analyze
          </Button>
        </div>
      )}

      {/* Error states */}
      {state.startsWith('error-') && (() => {
        const errorType = state.replace('error-', '').replace('-', '_');
        const guidance = ERROR_GUIDANCE[errorType] ?? 'An unexpected error occurred.';
        return (
          <Alert variant="destructive">
            <AlertTitle>Analysis failed: {errorType.replace('_', ' ')}</AlertTitle>
            <AlertDescription>
              <p className="mb-2">{guidance}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setState('progress')}>Retry</Button>
                <Button variant="outline" size="sm" onClick={() => setState('idle')}>Dismiss</Button>
              </div>
            </AlertDescription>
          </Alert>
        );
      })()}

      {/* Metadata standalone preview */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Metadata Section (standalone)</p>
        <div className="space-y-2 text-sm border rounded-md p-3">
          <div className="flex justify-between">
            <span className="opacity-70">Model</span>
            <span>{sampleMetadata.modelId}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Cost</span>
            <span>${sampleMetadata.costUsd.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Analyzed at</span>
            <span>{new Date(sampleMetadata.analyzedAt).toLocaleString()}</span>
          </div>
          <div className="space-y-1">
            <span className="opacity-70">Tools used</span>
            <div className="flex flex-wrap gap-1">
              {sampleMetadata.toolsUsed.map((tool) => (
                <Badge key={tool} variant="outline" className="text-xs">{tool}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
