import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { severityColor, dispositionColor } from '@/lib/theme-colors';
import { postMessage } from '../hooks/useVSCodeAPI';
import { Play, List, FolderOpen } from 'lucide-react';
import type { ScanSummary, ScanTarget, DispositionSummary, Severity, Disposition } from '../types/types';

interface SidebarDashboardProps {
  scans: ScanSummary[];
  summary: DispositionSummary;
  scanTargets: ScanTarget[];
}

export function SidebarDashboard({ scans, summary, scanTargets }: SidebarDashboardProps) {
  const activeScan = scans.find(s => s.status === 'RUNNING');
  const latestScan = scans.find(s => s.status === 'COMPLETED');
  const triaged = summary.total - summary.counts.PENDING;
  const pct = summary.total > 0 ? Math.round((triaged / summary.total) * 100) : 0;

  return (
    <div className="p-3 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold mb-1">ASH Workbench</h2>
        <p className="text-xs opacity-70">my-web-app</p>
      </div>

      <Button
        className="w-full"
        size="sm"
        onClick={() => postMessage({ type: 'startScan', payload: { targetPath: '/home/user/projects/my-web-app' } })}
      >
        <Play className="h-3.5 w-3.5 mr-1.5" />
        Scan Workspace
      </Button>

      {/* Active scan indicator */}
      {activeScan && (
        <>
          <Separator />
          <div>
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Active Scan</h3>
            <div className="flex items-center gap-2">
              <span className="text-yellow-500 animate-pulse">*</span>
              <span className="text-xs">Scanning...</span>
            </div>
            <p className="text-xs opacity-50 mt-1">
              Started {new Date(activeScan.startedAt).toLocaleTimeString()}
            </p>
            <Button variant="outline" size="sm" className="w-full mt-2 text-xs">
              Cancel
            </Button>
          </div>
        </>
      )}

      <Separator />

      {/* Scan targets summary */}
      <div>
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Scan Targets</h3>
        <div className="space-y-2">
          {scanTargets.map(target => (
            <div key={target.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <FolderOpen className="h-3 w-3 shrink-0 opacity-50" />
                <span className="truncate">{target.displayName}</span>
              </div>
              <span className="opacity-50 shrink-0 ml-2">{target.findingCount}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Triage progress */}
      <div>
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Triage Progress</h3>
        <p className="text-xs mb-2">{triaged} of {summary.total} triaged ({pct}%)</p>
        <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 mb-2">
          {(['FIX', 'SUPPRESS', 'DEFER', 'PENDING'] as Disposition[]).map(d => {
            const width = summary.total > 0 ? (summary.counts[d] / summary.total) * 100 : 0;
            if (width === 0) return null;
            return (
              <div
                key={d}
                className={`${dispositionColor[d].fill} transition-all`}
                style={{ width: `${width}%` }}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(summary.counts) as Disposition[]).map(d => (
            <Badge key={d} variant="outline" className={`${dispositionColor[d].tinted} text-xs`}>
              {d}: {summary.counts[d]}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Severity breakdown */}
      {latestScan && (
        <>
          <div>
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Severity Breakdown</h3>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(latestScan.severityCounts) as Severity[]).map(s => (
                latestScan.severityCounts[s] > 0 && (
                  <Badge key={s} variant="outline" className={`${severityColor[s].base} text-xs`}>
                    {s}: {latestScan.severityCounts[s]}
                  </Badge>
                )
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {latestScan && (
        <Button
          variant="secondary"
          className="w-full"
          size="sm"
          onClick={() => postMessage({ type: 'openFindings', payload: { scanId: latestScan.id } })}
        >
          <List className="h-3.5 w-3.5 mr-1.5" />
          View Findings ({summary.total})
        </Button>
      )}
    </div>
  );
}
