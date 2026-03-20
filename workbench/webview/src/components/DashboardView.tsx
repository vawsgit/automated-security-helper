import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppBreadcrumb } from './AppBreadcrumb';
import { SummaryCard } from './SummaryCard';
import { TriageProgressBar } from './TriageProgressBar';
import { ScanTargetCard } from './ScanTargetCard';
import { SeverityBadge } from './SeverityBadge';
import { getAiErrorMessage } from '@/lib/ai-errors';
import { postMessage } from '../hooks/useVSCodeAPI';
import { List, History, Play, FolderTree, Shield, Cpu, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { Project, ScanTarget, ScanSummary, FindingRow, DispositionSummary, Severity, SuppressionSummary } from '../types/types';

interface DashboardViewProps {
  project: Project;
  scanTargets: ScanTarget[];
  scans: ScanSummary[];
  findings: FindingRow[];
  summary: DispositionSummary;
  currentFindings?: FindingRow[];
  suppressionSummary?: SuppressionSummary;
  lastScannedAt?: string;
  claudeSettingsDetected: boolean;
  detectedProvider: 'bedrock' | 'anthropic-api' | 'none';
  aiTestStatus: 'idle' | 'testing' | 'success' | 'error';
  aiTestResult: { success: boolean; model?: string; latencyMs: number; error?: { type: string; message: string } } | null;
  onTestConnection: () => void;
  onNavigate: (view: 'findingList' | 'scanHistory' | 'suppressionManager') => void;
  onSelectScanTarget: (scanTargetId: string) => void;
}

export function DashboardView({
  project, scanTargets, scans, findings, summary, currentFindings, suppressionSummary, lastScannedAt, claudeSettingsDetected, detectedProvider, aiTestStatus, aiTestResult, onTestConnection, onNavigate, onSelectScanTarget,
}: DashboardViewProps) {

  // Use current findings (active only) for severity breakdown when available
  const activeFindings = currentFindings
    ? currentFindings.filter(f => !f.isCurrentlySuppressed)
    : findings;
  const totalFindings = suppressionSummary?.active ?? findings.length;
  const severityCounts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of activeFindings) {
    severityCounts[f.severity]++;
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <AppBreadcrumb segments={[{ label: 'Dashboard' }]} />
        </div>
        <Button variant="outline" size="sm" onClick={() => postMessage({ type: 'startScan' })}>
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Run Scan
        </Button>
      </div>

      <Separator />

      {/* Overall summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard title="Active Findings">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{totalFindings}</p>
            <div className="flex items-center gap-2 text-xs opacity-70">
              {suppressionSummary && suppressionSummary.suppressed > 0 && (
                <span>{suppressionSummary.suppressed} suppressed</span>
              )}
              {lastScannedAt && (
                <span>Last scanned {new Date(lastScannedAt).toLocaleString()}</span>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map(s =>
                severityCounts[s] > 0 && (
                  <span key={s} className="flex items-center gap-1">
                    <SeverityBadge severity={s} />
                    <span className="text-xs">{severityCounts[s]}</span>
                  </span>
                )
              )}
            </div>
          </div>
        </SummaryCard>

        <SummaryCard title="Scan Targets">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{scanTargets.length}</p>
            <p className="text-xs opacity-70">{scans.filter(s => s.status === 'COMPLETED').length} completed scans</p>
          </div>
        </SummaryCard>

        <SummaryCard title="Triage Progress">
          <TriageProgressBar counts={summary.counts} total={summary.total} activeTotal={suppressionSummary?.active} />
          <p className="text-xs opacity-70 mt-1">
            {summary.total - summary.counts.PENDING} of {summary.total} triaged
          </p>
        </SummaryCard>
      </div>

      <Separator />

      {/* AI Analysis Status */}
      <SummaryCard title="AI Analysis">
        {claudeSettingsDetected ? (
          <div className="space-y-2">
            <p className="text-xs opacity-60">
              Claude Code settings detected — {detectedProvider === 'bedrock' ? 'AWS Bedrock' : 'Anthropic API'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={aiTestStatus === 'testing'}
                onClick={onTestConnection}
              >
                {aiTestStatus === 'testing' ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Testing...</>
                ) : (
                  <><Cpu className="h-3.5 w-3.5 mr-1.5" />Test Connection</>
                )}
              </Button>
              {aiTestStatus === 'success' && aiTestResult && (
                <span className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {aiTestResult.model} — {aiTestResult.latencyMs}ms
                </span>
              )}
              {aiTestStatus === 'error' && aiTestResult?.error && (
                <span className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
                  <XCircle className="h-3.5 w-3.5" />
                  {getAiErrorMessage(aiTestResult.error.type)}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs opacity-60">No AI provider configured.</p>
            <p className="text-xs opacity-50">Configure an AI provider in VS Code Settings to enable AI-assisted finding analysis.</p>
            <Button variant="outline" size="sm" onClick={() => postMessage({ type: 'openSettings' })}>
              Open Settings
            </Button>
          </div>
        )}
      </SummaryCard>

      <Separator />

      {/* Scan targets */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 opacity-60" />
          <h3 className="text-sm font-semibold">Scan Targets</h3>
          <span className="text-xs opacity-50">Click a target to view its findings</span>
        </div>
        <div className="grid gap-3">
          {scanTargets.map(target => (
            <ScanTargetCard
              key={target.id}
              target={target}
              isWorkspaceRoot={target.path === project.rootPath}
              onClick={() => onSelectScanTarget(target.id)}
              onScan={() => postMessage({ type: 'startScan' })}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={() => onNavigate('findingList')}>
          <List className="h-3.5 w-3.5 mr-1.5" />
          View Findings
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('scanHistory')}>
          <History className="h-3.5 w-3.5 mr-1.5" />
          Scan History
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('suppressionManager')}>
          <Shield className="h-3.5 w-3.5 mr-1.5" />
          Manage Suppressions
        </Button>
      </div>
    </div>
  );
}
