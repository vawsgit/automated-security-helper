import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppBreadcrumb } from './AppBreadcrumb';
import { SeverityBadge } from './SeverityBadge';
import { DispositionBadge } from './DispositionBadge';
import { TriageControls } from './TriageControls';
import { TriageNotes } from './TriageNotes';
import { CodeBlock } from './CodeBlock';
import { AiAnalysisPanel } from './AiAnalysisPanel';
import { SuppressionPanel } from './SuppressionPanel';
import { FindingNavigation } from './FindingNavigation';
import { ExternalLink } from 'lucide-react';
import { postMessage } from '../hooks/useVSCodeAPI';
import type { FindingRow, Disposition } from '../types/types';

interface FindingDetailViewProps {
  finding: FindingRow;
  findings: FindingRow[];
  onBack: () => void;
  onNavigateDashboard: () => void;
  onNavigateFindings: () => void;
  onNavigate: (findingId: string) => void;
  onSetDisposition: (findingId: string, disposition: Disposition) => void;
  onSetNotes: (findingId: string, notes: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function FindingDetailView({
  finding,
  findings,
  onNavigateDashboard,
  onNavigateFindings,
  onNavigate,
  onSetDisposition,
  onSetNotes,
}: FindingDetailViewProps) {
  const highlightLines = [];
  for (let i = finding.startLine; i <= finding.endLine; i++) {
    highlightLines.push(i);
  }

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
      {finding.aiAnalysis && (
        <>
          <Separator />
          <AiAnalysisPanel analysis={finding.aiAnalysis} />
        </>
      )}

      {/* Section 6: Suppression */}
      {(finding.disposition === 'SUPPRESS' || finding.isCurrentlySuppressed) && (
        <>
          <Separator />
          <SuppressionPanel suppression={finding.suppression} disposition={finding.disposition} />
        </>
      )}
    </div>
  );
}
