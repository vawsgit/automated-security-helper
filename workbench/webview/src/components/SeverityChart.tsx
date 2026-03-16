import { severityColor } from '@/lib/theme-colors';
import type { Severity } from '../types/types';

interface SeverityChartProps {
  counts: Record<Severity, number>;
}

const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function SeverityChart({ counts }: SeverityChartProps) {
  const max = Math.max(...Object.values(counts), 1);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2">
      {severities.map(s => {
        const count = counts[s];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const barWidth = (count / max) * 100;
        return (
          <div key={s} className="flex items-center gap-3 text-xs">
            <span className="w-16 text-right font-medium opacity-70">{s}</span>
            <div className="flex-1 h-4 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded ${severityColor[s].base} transition-all`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="w-16 opacity-70">{count} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}
