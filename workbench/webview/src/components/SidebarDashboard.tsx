import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { severityColor, dispositionColor } from '@/lib/theme-colors';
import { postMessage } from '../hooks/useVSCodeAPI';
import { Play, List, FolderOpen, LayoutDashboard, Settings } from 'lucide-react';
import type { ScanSummary, ScanTarget, DispositionSummary, FindingRow, Severity, Disposition, SuppressionSummary } from '../types/types';

interface SidebarDashboardProps {
  scans: ScanSummary[];
  summary: DispositionSummary;
  scanTargets: ScanTarget[];
  currentFindings?: FindingRow[];
  suppressionSummary?: SuppressionSummary;
  lastScannedAt?: string;
}

export function SidebarDashboard({ scans, summary, scanTargets, currentFindings, suppressionSummary, lastScannedAt }: SidebarDashboardProps) {
  const activeScan = scans.find(s => s.status === 'RUNNING');
  const latestScan = scans.find(s => s.status === 'COMPLETED');
  const activeTotal = suppressionSummary?.active ?? summary.total;
  const triaged = summary.total - summary.counts.PENDING;
  const pct = activeTotal > 0 ? Math.round((triaged / activeTotal) * 100) : 0;

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">ASH Workbench</h2>
        <button
          className="opacity-50 hover:opacity-100 transition-opacity"
          onClick={() => postMessage({ type: 'openSettings' })}
          title="ASH Workbench Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      <Button
        variant="outline"
        className="w-full"
        size="sm"
        onClick={() => postMessage({ type: 'openDashboard' })}
      >
        <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
        View Dashboard
      </Button>

      <Button
        variant="outline"
        className="w-full"
        size="sm"
        onClick={() => postMessage({ type: 'startScan' })}
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
        {suppressionSummary && suppressionSummary.suppressed > 0 && (
          <p className="text-xs mb-1 opacity-60">{suppressionSummary.suppressed} suppressed via .ash.yaml</p>
        )}
        <p className="text-xs mb-2">{triaged} of {activeTotal} triaged ({pct}%)</p>
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

      {/* View Findings button - above severity breakdown */}
      {latestScan && (
        <>
          <Button
            variant="secondary"
            className="w-full"
            size="sm"
            onClick={() => postMessage({ type: 'openFindings', payload: { scanId: latestScan.id } })}
          >
            <List className="h-3.5 w-3.5 mr-1.5" />
            View Findings ({activeTotal})
          </Button>
          {lastScannedAt && (
            <p className="text-xs opacity-50 text-center">
              Last scanned {new Date(lastScannedAt).toLocaleString()}
            </p>
          )}
        </>
      )}

      {/* Severity breakdown — active findings only */}
      {latestScan && (() => {
        const activeSevCounts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
        const source = currentFindings?.filter(f => !f.isCurrentlySuppressed);
        if (source) {
          for (const f of source) { activeSevCounts[f.severity]++; }
        } else {
          for (const s of Object.keys(latestScan.severityCounts) as Severity[]) {
            activeSevCounts[s] = latestScan.severityCounts[s];
          }
        }
        return (
          <>
            <Separator />
            <div>
              <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Severity Breakdown</h3>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(activeSevCounts) as Severity[]).map(s => (
                  activeSevCounts[s] > 0 && (
                    <Badge key={s} variant="outline" className={`${severityColor[s].base} text-xs`}>
                      {s}: {activeSevCounts[s]}
                    </Badge>
                  )
                ))}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
