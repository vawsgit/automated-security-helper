import { Button } from '@/components/ui/button';
import { dispositionColor } from '@/lib/theme-colors';
import type { Disposition } from '../types/types';

interface TriageControlsProps {
  disposition: Disposition;
  onDispositionChange: (d: Disposition) => void;
}

const dispositions: Disposition[] = ['PENDING', 'FIX', 'SUPPRESS', 'DEFER'];

export function TriageControls({ disposition, onDispositionChange }: TriageControlsProps) {
  return (
    <div className="flex gap-2">
      {dispositions.map(d => (
        <Button
          key={d}
          size="sm"
          className={
            disposition === d
              ? `${dispositionColor[d].fill} text-white ring-2 ring-offset-1`
              : `${dispositionColor[d].tinted} ${dispositionColor[d].hover}`
          }
          onClick={() => onDispositionChange(d)}
        >
          {d}
        </Button>
      ))}
    </div>
  );
}
