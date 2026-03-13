import { SeverityBadge } from '@/components/SeverityBadge';
import type { Severity } from '@/types/types';

const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function SeverityBadgeDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      {severities.map((severity) => (
        <SeverityBadge key={severity} severity={severity} />
      ))}
    </div>
  );
}
