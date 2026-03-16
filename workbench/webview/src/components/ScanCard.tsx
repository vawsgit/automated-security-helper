import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from './SeverityBadge';
import { List } from 'lucide-react';
import type { ScanSummary, Severity } from '../types/types';

interface ScanCardProps {
  scan: ScanSummary;
  onClick?: () => void;
  onViewFindings?: () => void;
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

const statusIcon: Record<string, string> = {
  COMPLETED: 'v',
  FAILED: 'x',
  CANCELLED: 'o',
  RUNNING: '*',
};

const statusColor: Record<string, string> = {
  COMPLETED: 'text-green-500',
  FAILED: 'text-red-500',
  CANCELLED: 'text-gray-500',
  RUNNING: 'text-yellow-500 animate-pulse',
};

export function ScanCard({ scan, onClick, onViewFindings }: ScanCardProps) {
  return (
    <Card
      className={`${scan.status === 'RUNNING' ? 'border-yellow-500/50' : ''} ${onClick ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-3 py-3">
        <span className={`text-lg ${statusColor[scan.status]}`}>
          {statusIcon[scan.status]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{formatDate(scan.startedAt)}</span>
            <span className="text-xs opacity-50">{scan.status}</span>
          </div>
          <div className="flex items-center gap-3 text-xs opacity-70 mt-0.5">
            <span>{formatDuration(scan.startedAt, scan.completedAt)}</span>
            <span>{scan.sourceDirectory}</span>
            {scan.findingCount > 0 && <span>{scan.findingCount} findings</span>}
          </div>
          {scan.status === 'COMPLETED' && scan.findingCount > 0 && (
            <div className="flex gap-1 mt-1.5">
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
        </div>
        {scan.status === 'COMPLETED' && scan.findingCount > 0 && onViewFindings && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs shrink-0"
            onClick={(e) => { e.stopPropagation(); onViewFindings(); }}
          >
            <List className="h-3 w-3 mr-1" />
            Findings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
