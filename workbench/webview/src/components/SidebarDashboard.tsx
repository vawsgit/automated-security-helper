import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { postMessage } from '../hooks/useVSCodeAPI';
import type { ScanSummary, DispositionSummary, Severity, Disposition } from '../types/types';

interface SidebarDashboardProps {
  scans: ScanSummary[];
  summary: DispositionSummary;
}

const severityColors: Record<Severity, string> = {
  CRITICAL: 'bg-red-700 text-white',
  HIGH: 'bg-orange-600 text-white',
  MEDIUM: 'bg-yellow-600 text-white',
  LOW: 'bg-blue-600 text-white',
  INFO: 'bg-gray-500 text-white',
};

const dispositionColors: Record<Disposition, string> = {
  PENDING: 'bg-gray-500 text-white',
  FIX: 'bg-green-600 text-white',
  SUPPRESS: 'bg-purple-600 text-white',
  DEFER: 'bg-amber-600 text-white',
};

export function SidebarDashboard({ scans, summary }: SidebarDashboardProps) {
  const latestScan = scans.find(s => s.status === 'COMPLETED');

  return (
    <div className="p-3 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold mb-1">ASH Workbench</h2>
        <p className="text-xs opacity-70">my-web-app</p>
      </div>

      <Button
        className="w-full"
        size="sm"
        onClick={() => postMessage({ type: 'startScan' })}
      >
        Run Scan
      </Button>

      <Separator />

      <div>
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Triage Summary</h3>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(summary.counts) as Disposition[]).map(d => (
            <Badge key={d} className={`${dispositionColors[d]} text-xs`}>
              {d}: {summary.counts[d]}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {latestScan && (
        <div>
          <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Severity Breakdown</h3>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(latestScan.severityCounts) as Severity[]).map(s => (
              latestScan.severityCounts[s] > 0 && (
                <Badge key={s} className={`${severityColors[s]} text-xs`}>
                  {s}: {latestScan.severityCounts[s]}
                </Badge>
              )
            ))}
          </div>
        </div>
      )}

      <Separator />

      {latestScan && (
        <Button
          variant="secondary"
          className="w-full"
          size="sm"
          onClick={() => postMessage({ type: 'openFindings', payload: { scanId: latestScan.id } })}
        >
          View Findings ({latestScan.findingCount})
        </Button>
      )}
    </div>
  );
}
