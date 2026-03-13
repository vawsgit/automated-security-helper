import { DispositionBadge } from '@/components/DispositionBadge';
import type { Disposition } from '@/types/types';

const dispositions: Disposition[] = ['PENDING', 'FIX', 'SUPPRESS', 'DEFER'];

export function DispositionBadgeDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      {dispositions.map((disposition) => (
        <DispositionBadge key={disposition} disposition={disposition} />
      ))}
    </div>
  );
}
