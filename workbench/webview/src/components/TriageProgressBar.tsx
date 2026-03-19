import { dispositionColor } from '@/lib/theme-colors';
import type { Disposition } from '../types/types';

interface TriageProgressBarProps {
  counts: Record<Disposition, number>;
  total: number;
  activeTotal?: number;
}

const segments: { disposition: Disposition; label: string }[] = [
  { disposition: 'FIX', label: 'Fix' },
  { disposition: 'SUPPRESS', label: 'Suppress' },
  { disposition: 'DEFER', label: 'Defer' },
  { disposition: 'PENDING', label: 'Pending' },
];

export function TriageProgressBar({ counts, total, activeTotal }: TriageProgressBarProps) {
  const denominator = activeTotal ?? total;
  const triaged = total - counts.PENDING;
  const pct = denominator > 0 ? Math.round((triaged / denominator) * 100) : 0;

  if (denominator === 0 && total > 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs opacity-70">All findings suppressed</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800">
        {segments.map(({ disposition }) => {
          const width = total > 0 ? (counts[disposition] / total) * 100 : 0;
          if (width === 0) return null;
          return (
            <div
              key={disposition}
              className={`${dispositionColor[disposition].fill} transition-all`}
              style={{ width: `${width}%` }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs opacity-70">
        <span>{triaged} of {denominator} triaged ({pct}%)</span>
        <div className="flex gap-3">
          {segments.map(({ disposition, label }) => (
            counts[disposition] > 0 && (
              <span key={disposition} className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${dispositionColor[disposition].fill}`} />
                {label}: {counts[disposition]}
              </span>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
