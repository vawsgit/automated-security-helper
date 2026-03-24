import { repairabilityColor, severityColor } from '@/lib/theme-colors';
import type { Severity, TriageSeverityBreakdown, TriageCategory } from '../types/types';

interface TriageChartProps {
  bySeverity: Record<Severity, TriageSeverityBreakdown>;
  onDrillDown: (severity: Severity, category: TriageCategory) => void;
}

const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const categories: { key: TriageCategory; label: string }[] = [
  { key: 'suppress', label: 'Suppress' },
  { key: 'easy_fix', label: 'Easy Fix' },
  { key: 'systemic', label: 'Systemic' },
];

function categoryCount(b: TriageSeverityBreakdown, cat: TriageCategory): number {
  switch (cat) {
    case 'suppress': return b.suppress;
    case 'easy_fix': return b.easyFix;
    case 'systemic': return b.systemic;
  }
}

export function TriageChart({ bySeverity, onDrillDown }: TriageChartProps) {
  const max = Math.max(
    ...severities.map(s => bySeverity[s].total),
    1,
  );

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        {categories.map(c => (
          <div key={c.key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${repairabilityColor[c.key].fill}`} />
            <span className="opacity-70">{c.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-300 dark:bg-gray-600" />
          <span className="opacity-70">Unanalyzed</span>
        </div>
      </div>

      {/* Bars */}
      {severities.map(s => {
        const breakdown = bySeverity[s];
        if (breakdown.total === 0) return null;
        const barWidth = (breakdown.total / max) * 100;

        return (
          <div key={s} className="flex items-center gap-3 text-xs">
            <span className={`w-16 text-right font-medium ${severityColor[s].base}`}>{s}</span>
            <div
              className="flex-1 h-5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden"
              style={{ width: `${barWidth}%`, minWidth: '60px' }}
            >
              <div className="h-full flex">
                {categories.map(c => {
                  const count = categoryCount(breakdown, c.key);
                  if (count === 0) return null;
                  const segWidth = (count / breakdown.total) * 100;
                  return (
                    <button
                      key={c.key}
                      className={`h-full ${repairabilityColor[c.key].fill} ${repairabilityColor[c.key].hover} transition-all cursor-pointer`}
                      style={{ width: `${segWidth}%` }}
                      onClick={() => onDrillDown(s, c.key)}
                      title={`${s} / ${c.label}: ${count}`}
                    />
                  );
                })}
                {breakdown.unanalyzed > 0 && (
                  <div
                    className="h-full bg-gray-300 dark:bg-gray-600"
                    style={{ width: `${(breakdown.unanalyzed / breakdown.total) * 100}%` }}
                    title={`${s} / Unanalyzed: ${breakdown.unanalyzed}`}
                  />
                )}
              </div>
            </div>
            <span className="w-10 opacity-70">{breakdown.total}</span>
          </div>
        );
      })}
    </div>
  );
}
