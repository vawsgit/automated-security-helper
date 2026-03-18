import { Badge } from '@/components/ui/badge';
import { dispositionColor } from '@/lib/theme-colors';
import type { Disposition } from '../types/types';

export function DispositionBadge({ disposition }: { disposition: Disposition }) {
  const { tinted, hover } = dispositionColor[disposition];
  return (
    <Badge variant="outline" className={`${tinted} ${hover}`}>
      {disposition}
    </Badge>
  );
}
