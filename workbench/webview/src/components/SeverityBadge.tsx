import { Badge } from '@/components/ui/badge';
import type { Severity } from '../types/types';

const severityStyles: Record<Severity, string> = {
  CRITICAL: 'bg-red-700 text-white hover:bg-red-800',
  HIGH: 'bg-orange-600 text-white hover:bg-orange-700',
  MEDIUM: 'bg-yellow-600 text-white hover:bg-yellow-700',
  LOW: 'bg-blue-600 text-white hover:bg-blue-700',
  INFO: 'bg-gray-500 text-white hover:bg-gray-600',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge className={severityStyles[severity]}>
      {severity}
    </Badge>
  );
}
