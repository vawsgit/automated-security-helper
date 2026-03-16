import { Badge } from '@/components/ui/badge';
import { severityColor } from '@/lib/theme-colors';
import type { Severity } from '../types/types';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { base, hover } = severityColor[severity];
  return (
    <Badge className={`${base} ${hover}`}>
      {severity}
    </Badge>
  );
}
