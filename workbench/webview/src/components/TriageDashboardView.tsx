import { Button } from '@/components/ui/button';
import { AppBreadcrumb } from './AppBreadcrumb';
import { TriageChart } from './TriageChart';
import { repairabilityColor, severityColor } from '@/lib/theme-colors';
import { postMessage } from '../hooks/useVSCodeAPI';
import { Play, Loader2, XCircle } from 'lucide-react';
import type { TriageSummary, TriageCategory, Severity } from '../types/types';
import type { TriageBatchUIState } from '../App';

interface TriageDashboardViewProps {
  summary: TriageSummary | null;
  classificationState: TriageBatchUIState | null;
  onNavigateDashboard: () => void;
  onDrillDown: (severity: Severity, category: TriageCategory) => void;
}

const categories: { key: TriageCategory; label: string; description: string }[] = [
  { key: 'suppress', label: 'Suppress', description: 'False positives or accepted risks' },
  { key: 'easy_fix', label: 'Easy Fix', description: 'Simple, low-risk code changes' },
  { key: 'systemic', label: 'Systemic', description: 'Complex or multi-file fixes' },
];

export function TriageDashboardView({
  summary, classificationState, onNavigateDashboard, onDrillDown,
}: TriageDashboardViewProps) {
  const isRunning = classificationState?.status === 'running';

  const handleStartClassification = () => {
    postMessage({ type: 'startTriageClassification' });
  };

  const handleCancelClassification = () => {
    postMessage({ type: 'cancelTriageClassification' });
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <AppBreadcrumb segments={[
            { label: 'Dashboard', onClick: onNavigateDashboard },
            { label: 'Repairability Triage' },
          ]} />
          <p className="text-xs text-muted-foreground">
            AI-driven classification of HIGH severity findings into actionable categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button variant="outline" size="sm" onClick={handleCancelClassification}>
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Cancel
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleStartClassification}>
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Classify Findings
            </Button>
          )}
        </div>
      </div>

      {/* Classification Progress */}
      {classificationState && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span className="font-medium">
                {isRunning ? 'Classifying findings...' : `Classification ${classificationState.status}`}
              </span>
            </div>
            <span className="opacity-70">
              {classificationState.currentIndex} / {classificationState.totalFindings}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${classificationState.totalFindings > 0 ? (classificationState.currentIndex / classificationState.totalFindings) * 100 : 0}%` }}
            />
          </div>
          {classificationState.status !== 'running' && (
            <div className="flex items-center gap-4 text-xs opacity-70">
              <span>Analyzed: {classificationState.analyzedCount}</span>
              <span>Failed: {classificationState.failedCount}</span>
              <span>Skipped: {classificationState.skippedCount}</span>
            </div>
          )}
        </div>
      )}

      {/* Summary KPIs */}
      {summary && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-2xl font-semibold">{summary.totalFindings}</div>
              <div className="text-xs text-muted-foreground">Total Findings</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-2xl font-semibold">{summary.totalAnalyzed}</div>
              <div className="text-xs text-muted-foreground">Analyzed</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-2xl font-semibold">{summary.totalUnanalyzed}</div>
              <div className="text-xs text-muted-foreground">Unanalyzed</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-2xl font-semibold">
                {summary.totalFindings > 0
                  ? Math.round((summary.totalAnalyzed / summary.totalFindings) * 100)
                  : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Coverage</div>
            </div>
          </div>

          {/* Repairability Chart */}
          <div className="rounded-md border p-4 space-y-3">
            <h3 className="text-sm font-medium">Findings by Severity & Repairability</h3>
            <TriageChart bySeverity={summary.bySeverity} onDrillDown={onDrillDown} />
          </div>

          {/* Category Breakdown Cards */}
          <div className="grid grid-cols-3 gap-3">
            {categories.map(c => {
              const total = Object.values(summary.bySeverity).reduce((acc, b) => {
                switch (c.key) {
                  case 'suppress': return acc + b.suppress;
                  case 'easy_fix': return acc + b.easyFix;
                  case 'systemic': return acc + b.systemic;
                }
              }, 0);
              return (
                <div key={c.key} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-sm ${repairabilityColor[c.key].fill}`} />
                    <span className="text-sm font-medium">{c.label}</span>
                  </div>
                  <div className="text-2xl font-semibold">{total}</div>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </div>
              );
            })}
          </div>

          {/* Severity × Category Matrix */}
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Severity</th>
                  <th className="text-center p-2 font-medium">Total</th>
                  {categories.map(c => (
                    <th key={c.key} className="text-center p-2 font-medium">{c.label}</th>
                  ))}
                  <th className="text-center p-2 font-medium">Unanalyzed</th>
                </tr>
              </thead>
              <tbody>
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map(s => {
                  const b = summary.bySeverity[s];
                  if (b.total === 0) return null;
                  return (
                    <tr key={s} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className={`p-2 font-medium ${severityColor[s].base}`}>{s}</td>
                      <td className="text-center p-2">{b.total}</td>
                      {categories.map(c => {
                        const count = c.key === 'suppress' ? b.suppress : c.key === 'easy_fix' ? b.easyFix : b.systemic;
                        return (
                          <td key={c.key} className="text-center p-2">
                            {count > 0 ? (
                              <button
                                className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded ${repairabilityColor[c.key].base} ${repairabilityColor[c.key].hover} cursor-pointer transition-colors`}
                                onClick={() => onDrillDown(s, c.key)}
                              >
                                {count}
                              </button>
                            ) : (
                              <span className="opacity-30">0</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center p-2">
                        {b.unanalyzed > 0 ? (
                          <span className="opacity-70">{b.unanalyzed}</span>
                        ) : (
                          <span className="opacity-30">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty State */}
      {!summary && !classificationState && (
        <div className="flex flex-col items-center justify-center py-12 opacity-60">
          <p className="text-sm">No triage data available.</p>
          <p className="text-xs mt-1">Click "Classify Findings" to start AI-driven repairability analysis.</p>
        </div>
      )}
    </div>
  );
}
