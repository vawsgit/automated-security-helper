import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SeverityBadge } from './SeverityBadge';
import { TriageProgressBar } from './TriageProgressBar';
import { Play, FolderOpen } from 'lucide-react';
import type { ScanTarget, Severity } from '../types/types';

interface ScanTargetCardProps {
  target: ScanTarget;
  isWorkspaceRoot?: boolean;
  onClick: () => void;
  onScan: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function triagePercent(target: ScanTarget): number {
  if (target.triageSummary.total === 0) return 0;
  const triaged = target.triageSummary.total - target.triageSummary.counts.PENDING;
  return Math.round((triaged / target.triageSummary.total) * 100);
}

export function ScanTargetCard({ target, isWorkspaceRoot, onClick, onScan }: ScanTargetCardProps) {
  const pct = triagePercent(target);
  const hasCritical = target.severityCounts.CRITICAL > 0;
  const hasHigh = target.severityCounts.HIGH > 0;

  return (
    <Card
      className={`cursor-pointer hover:bg-accent/50 transition-colors ${
        hasCritical ? 'border-red-500/30' : hasHigh ? 'border-orange-500/20' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="py-3 space-y-2.5">
        {/* Header row: name + scan button */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="h-4 w-4 shrink-0 opacity-60" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">{target.displayName}</span>
                {isWorkspaceRoot && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">root</Badge>
                )}
              </div>
              <p className="text-xs opacity-50 font-mono truncate">{target.path}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs shrink-0 h-7"
            onClick={(e) => { e.stopPropagation(); onScan(); }}
          >
            <Play className="h-3 w-3 mr-1" />
            Scan
          </Button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs">
          <span className="font-medium">{target.findingCount} findings</span>
          <span className="opacity-50">{target.scanCount} scan{target.scanCount !== 1 ? 's' : ''}</span>
          {target.lastScannedAt && (
            <span className="opacity-50">Last: {formatDate(target.lastScannedAt)}</span>
          )}
        </div>

        {/* Severity badges */}
        {target.findingCount > 0 && (
          <div className="flex gap-1.5">
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as Severity[]).map(s =>
              target.severityCounts[s] > 0 && (
                <span key={s} className="flex items-center gap-0.5">
                  <SeverityBadge severity={s} />
                  <span className="text-xs">{target.severityCounts[s]}</span>
                </span>
              )
            )}
          </div>
        )}

        {/* Triage progress */}
        {target.findingCount > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="opacity-50">Triage progress</span>
              <span className="opacity-70">{pct}%</span>
            </div>
            <TriageProgressBar counts={target.triageSummary.counts} total={target.triageSummary.total} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
