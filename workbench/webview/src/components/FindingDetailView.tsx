import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { AppBreadcrumb } from './AppBreadcrumb';
import { SeverityBadge } from './SeverityBadge';
import { DispositionBadge } from './DispositionBadge';
import { TriageControls } from './TriageControls';
import { TriageNotes } from './TriageNotes';
import { CodeBlock } from './CodeBlock';
import { AiAnalysisPanel } from './AiAnalysisPanel';
import { AnalysisProgress } from './AnalysisProgress';
import { SuppressionPanel } from './SuppressionPanel';
import { FindingNavigation } from './FindingNavigation';
import { ExternalLink, Sparkles } from 'lucide-react';
import { SuppressionForm } from './SuppressionForm';
import { postMessage } from '../hooks/useVSCodeAPI';
import type { FindingRow, Disposition, SuppressionInput } from '../types/types';
import type { AnalysisUIState } from '../App';

const ERROR_GUIDANCE: Record<string, string> = {
  credentials_missing: 'AI provider credentials are not configured. Open Settings and configure ashWorkbench.llm.provider and credentials.',
  auth_failed: 'Authentication failed. Check your API key or AWS credentials in Settings.',
  model_unavailable: 'The configured model is not available. Check ashWorkbench.llm.modelId in Settings.',
  budget_exceeded: 'Analysis stopped: cost reached the budget limit. Increase ashWorkbench.llm.maxBudgetUsd in Settings to allow more.',
  max_turns_exceeded: 'Analysis stopped after maximum reasoning iterations without completing. Increase ashWorkbench.llm.maxTurns in Settings and retry.',
  network_error: 'Network error connecting to the AI provider. Check your connection and retry.',
  cancelled: 'Analysis cancelled.',
  format_error: 'The AI agent did not return a valid analysis format. Try again.',
  unknown: 'An unexpected error occurred during analysis. Check the ASH Workbench output channel for details.',
};

interface FindingDetailViewProps {
  finding: FindingRow;
  findings: FindingRow[];
  analysisState?: AnalysisUIState;
  onBack: () => void;
  onNavigateDashboard: () => void;
  onNavigateFindings: () => void;
  onNavigate: (findingId: string) => void;
  onSetDisposition: (findingId: string, disposition: Disposition) => void;
  onSetNotes: (findingId: string, notes: string) => void;
  onDismissAnalysisError?: (findingId: string) => void;
  suppressionFormFindingId?: string | null;
  suppressionPending?: boolean;
  onOpenSuppressionForm?: (findingId: string) => void;
  onCloseSuppressionForm?: () => void;
  onSetSuppressionPending?: (pending: boolean) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function FindingDetailView({
  finding,
  findings,
  analysisState,
  onNavigateDashboard,
  onNavigateFindings,
  onNavigate,
  onSetDisposition,
  onSetNotes,
  onDismissAnalysisError,
  suppressionFormFindingId,
  suppressionPending,
  onOpenSuppressionForm,
  onCloseSuppressionForm,
  onSetSuppressionPending,
}: FindingDetailViewProps) {
  const highlightLines = [];
  for (let i = finding.startLine; i <= finding.endLine; i++) {
    highlightLines.push(i);
  }

  const triggerAnalysis = () => {
    postMessage({ type: 'analyzeFinding', payload: { findingId: finding.id } });
  };

  const cancelAnalysis = () => {
    postMessage({ type: 'cancelAiAnalysis', payload: { findingId: finding.id } });
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Breadcrumb + navigation */}
      <div className="flex items-center justify-between">
        <AppBreadcrumb segments={[
          { label: 'Dashboard', onClick: onNavigateDashboard },
          { label: 'Findings', onClick: onNavigateFindings },
          { label: finding.title },
        ]} />
        <FindingNavigation
          findings={findings}
          currentId={finding.id}
          onNavigate={onNavigate}
        />
      </div>

      {/* Section 1: Finding header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          <h1 className="text-lg font-semibold">{finding.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs opacity-70">
          <span>Rule: <code className="px-1 py-0.5 rounded" style={{ background: 'var(--vscode-textCodeBlock-background)' }}>{finding.ruleId}</code></span>
          <span>Scanner: {finding.scanner}</span>
          <span>First detected: {formatDate(finding.firstDetectedAt)}</span>
          <DispositionBadge disposition={finding.disposition} />
          {finding.isCurrentlySuppressed && (
            <span className="inline-flex items-center rounded-md bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 text-xs font-medium">
              Suppressed via .ash.yaml
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Section 2: Triage controls + notes */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">Disposition</h3>
        <TriageControls
          disposition={finding.disposition}
          onDispositionChange={d => onSetDisposition(finding.id, d)}
        />
        <TriageNotes
          notes={finding.notes}
          onNotesChange={notes => onSetNotes(finding.id, notes)}
        />
      </div>

      <Separator />

      {/* Section 3: Description */}
      <div>
        <h3 className="text-xs font-semibold mb-1 uppercase tracking-wide opacity-70">Description</h3>
        <p className="text-sm leading-relaxed">{finding.description}</p>
      </div>

      <Separator />

      {/* Section 4: Code location */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">Location</h3>
        <div className="flex items-center gap-2">
          <button
            className="text-sm underline"
            style={{ color: 'var(--vscode-textLink-foreground)' }}
            onClick={() => {
              postMessage({
                type: 'navigateToCode',
                payload: { filePath: finding.filePath, startLine: finding.startLine },
              });
            }}
          >
            {finding.filePath}
          </button>
          <span className="text-xs opacity-70">
            Line {finding.startLine}{finding.endLine !== finding.startLine ? `-${finding.endLine}` : ''}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={() => {
              postMessage({
                type: 'navigateToCode',
                payload: { filePath: finding.filePath, startLine: finding.startLine },
              });
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open in Editor
          </Button>
        </div>
        <CodeBlock
          code={finding.codeSnippet}
          startLine={finding.startLine}
          highlightLines={highlightLines}
        />
      </div>

      {/* Section 5: AI Analysis */}
      <Separator />
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">AI Analysis</h3>

        {/* Error state (US5) */}
        {analysisState?.status === 'error' && (
          <Alert variant="destructive">
            <AlertTitle>{analysisState.message}</AlertTitle>
            <AlertDescription>
              <p className="mb-2">{ERROR_GUIDANCE[analysisState.errorType ?? 'unknown'] ?? ERROR_GUIDANCE.unknown}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={triggerAnalysis}>
                  Retry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDismissAnalysisError?.(finding.id)}
                >
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Analyzing state (US2/US3) */}
        {analysisState?.status === 'analyzing' && (
          <AnalysisProgress
            message={analysisState.message}
            toolName={analysisState.toolName}
            onCancel={cancelAnalysis}
          />
        )}

        {/* Analyze button (US1) — show when no analysis and no active state */}
        {!finding.aiAnalysis && !analysisState && (
          <Button variant="outline" size="sm" onClick={triggerAnalysis}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Analyze with AI
          </Button>
        )}

        {/* Analysis results + Re-analyze button (US1) */}
        {finding.aiAnalysis && !analysisState && (
          <>
            <AiAnalysisPanel
              analysis={finding.aiAnalysis}
              metadata={finding.analysisMetadata}
            />
            <Button variant="outline" size="sm" onClick={triggerAnalysis}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Re-analyze
            </Button>
          </>
        )}
      </div>

      {/* Section 6: Suppression */}
      {(finding.disposition === 'SUPPRESS' || finding.isCurrentlySuppressed) && (
        <>
          <Separator />
          <SuppressionPanel
            suppression={finding.suppression}
            disposition={finding.disposition}
            findingId={finding.id}
            isCurrentlySuppressed={finding.isCurrentlySuppressed}
            suppressionSource={finding.suppressionSource}
            onUnsuppress={onCloseSuppressionForm ? (findingId) => {
              postMessage({ type: 'unsuppressFinding', payload: { findingId } });
            } : undefined}
          />
        </>
      )}

      {/* Section 7: Suppress action (for non-suppressed findings) */}
      {!finding.isCurrentlySuppressed && onOpenSuppressionForm && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">Suppress</h3>
            {suppressionFormFindingId === finding.id ? (
              <SuppressionForm
                finding={finding}
                isPending={suppressionPending ?? false}
                onSubmit={(input: SuppressionInput) => {
                  onSetSuppressionPending?.(true);
                  postMessage({ type: 'suppressFinding', payload: input });
                }}
                onCancel={() => onCloseSuppressionForm?.()}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenSuppressionForm(finding.id)}
              >
                Suppress Finding
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
