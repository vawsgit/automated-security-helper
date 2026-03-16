import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppBreadcrumb } from './AppBreadcrumb';
import { SummaryCard } from './SummaryCard';
import { TriageProgressBar } from './TriageProgressBar';
import { SeverityChart } from './SeverityChart';
import { SeverityBadge } from './SeverityBadge';
import { List, History, Play } from 'lucide-react';
import type { Project, ScanSummary, FindingRow, DispositionSummary, Severity } from '../types/types';

interface DashboardViewProps {
  project: Project;
  scans: ScanSummary[];
  findings: FindingRow[];
  summary: DispositionSummary;
  onNavigate: (view: 'findingList' | 'scanHistory') => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(start: string, end?: string): string {
  if (!end) return 'In progress';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

export function DashboardView({ project, scans, findings, summary, onNavigate }: DashboardViewProps) {
  const latestScan = scans.find(s => s.status === 'COMPLETED');
  const severityCounts = latestScan?.severityCounts ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } as Record<Severity, number>;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <AppBreadcrumb segments={[{ label: 'Dashboard' }]} />
          <p className="text-xs opacity-70">{project.name} &middot; {project.rootPath}</p>
        </div>
        <Button size="sm">
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Run Scan
        </Button>
      </div>

      <Separator />

      {/* Row 1: Project Info + Latest Scan */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard title="Project">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{findings.length}</p>
            <p className="text-xs opacity-70">Total findings</p>
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

        <SummaryCard title="Latest Scan">
          {latestScan ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">{formatDate(latestScan.startedAt)}</p>
              <p className="text-xs opacity-70">
                Duration: {formatDuration(latestScan.startedAt, latestScan.completedAt)}
              </p>
              <p className="text-xs opacity-70">
                {latestScan.findingCount} findings &middot; {latestScan.sourceDirectory}
              </p>
            </div>
          ) : (
            <p className="text-sm opacity-50">No completed scans</p>
          )}
        </SummaryCard>
      </div>

      {/* Row 2: Triage Progress */}
      <SummaryCard title="Triage Progress">
        <TriageProgressBar counts={summary.counts} total={summary.total} />
      </SummaryCard>

      {/* Row 3: Severity Distribution */}
      <SummaryCard title="Severity Distribution">
        <SeverityChart counts={severityCounts} />
      </SummaryCard>

      {/* Row 4: Quick Actions */}
      <div className="flex gap-3">
        <Button size="sm" onClick={() => onNavigate('findingList')}>
          <List className="h-3.5 w-3.5 mr-1.5" />
          View Findings
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('scanHistory')}>
          <History className="h-3.5 w-3.5 mr-1.5" />
          Scan History
        </Button>
      </div>
    </div>
  );
}
