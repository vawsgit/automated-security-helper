import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { AppBreadcrumb } from './AppBreadcrumb';
import { SeverityChart } from './SeverityChart';
import { SeverityBadge } from './SeverityBadge';
import { ScannerProgress } from './ScannerProgress';
import { List } from 'lucide-react';
import type { ScanSummary, FindingRow, Severity } from '../types/types';

interface ScanDetailViewProps {
  scan: ScanSummary;
  findings: FindingRow[];
  onNavigateDashboard: () => void;
  onNavigateScans: () => void;
  onViewFindings: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
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

const statusLabel: Record<string, string> = {
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  RUNNING: 'Running',
};

const statusColor: Record<string, string> = {
  COMPLETED: 'text-green-500',
  FAILED: 'text-red-500',
  CANCELLED: 'text-gray-500',
  RUNNING: 'text-yellow-500',
};

const mockScanners = [
  { name: 'bandit', status: 'completed' as const, duration: '12s' },
  { name: 'semgrep', status: 'completed' as const, duration: '45s' },
  { name: 'checkov', status: 'completed' as const, duration: '32s' },
  { name: 'detect-secrets', status: 'completed' as const, duration: '5s' },
  { name: 'grype', status: 'completed' as const, duration: '18s' },
  { name: 'cfn-nag', status: 'completed' as const, duration: '8s' },
  { name: 'cdk-nag', status: 'completed' as const, duration: '15s' },
  { name: 'npm-audit', status: 'completed' as const, duration: '3s' },
];

export function ScanDetailView({
  scan,
  findings,
  onNavigateDashboard,
  onNavigateScans,
  onViewFindings,
}: ScanDetailViewProps) {
  const scanFindings = findings.filter(f => f.scanId === scan.id);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <AppBreadcrumb segments={[
          { label: 'Dashboard', onClick: onNavigateDashboard },
          { label: 'Scans', onClick: onNavigateScans },
          { label: formatDate(scan.startedAt) },
        ]} />
      </div>

      {/* Scan header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${statusColor[scan.status]}`}>
            {statusLabel[scan.status]}
          </span>
          <h1 className="text-lg font-semibold">Scan {scan.id}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs opacity-70">
          <span>Started: {formatDate(scan.startedAt)}</span>
          {scan.completedAt && <span>Completed: {formatDate(scan.completedAt)}</span>}
          <span>Duration: {formatDuration(scan.startedAt, scan.completedAt)}</span>
          <span>Source: {scan.sourceDirectory}</span>
        </div>
      </div>

      <Separator />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium opacity-70 mb-1">Findings</p>
            <p className="text-2xl font-bold">{scan.findingCount}</p>
            {scan.findingCount > 0 && (
              <div className="flex gap-1 mt-2">
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as Severity[]).map(s =>
                  scan.severityCounts[s] > 0 && (
                    <span key={s} className="flex items-center gap-0.5">
                      <SeverityBadge severity={s} />
                      <span className="text-xs">{scan.severityCounts[s]}</span>
                    </span>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium opacity-70 mb-1">Scanners</p>
            <p className="text-2xl font-bold">{mockScanners.length}</p>
            <p className="text-xs opacity-70 mt-1">
              {mockScanners.filter(s => s.status === 'completed').length} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Severity chart */}
      {scan.findingCount > 0 && (
        <>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium opacity-70 mb-3">Severity Distribution</p>
              <SeverityChart counts={scan.severityCounts} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Scanner breakdown */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-medium opacity-70 mb-3">Scanner Results</p>
          <ScannerProgress scanners={mockScanners} />
        </CardContent>
      </Card>

      {/* Actions */}
      {scan.findingCount > 0 && (
        <Button variant="outline" size="sm" onClick={onViewFindings}>
          <List className="h-4 w-4 mr-1.5" />
          View {scanFindings.length} Findings
        </Button>
      )}

      {scan.status === 'FAILED' && (
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium text-red-500 mb-1">Error</p>
            <p className="text-sm opacity-70">
              Scan failed: checkov exited with code 2. Check that all scanners are installed and the source directory is accessible.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
