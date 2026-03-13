import { Badge } from '@/components/ui/badge';
import type { Disposition } from '../types/types';

const dispositionStyles: Record<Disposition, string> = {
  PENDING: 'bg-gray-500 text-white hover:bg-gray-600',
  FIX: 'bg-green-600 text-white hover:bg-green-700',
  SUPPRESS: 'bg-purple-600 text-white hover:bg-purple-700',
  DEFER: 'bg-amber-600 text-white hover:bg-amber-700',
};

export function DispositionBadge({ disposition }: { disposition: Disposition }) {
  return (
    <Badge className={dispositionStyles[disposition]}>
      {disposition}
    </Badge>
  );
}
