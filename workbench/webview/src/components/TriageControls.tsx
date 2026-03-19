import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { dispositionColor } from '@/lib/theme-colors';
import type { Disposition } from '../types/types';

interface TriageControlsProps {
  disposition: Disposition;
  onDispositionChange: (d: Disposition) => void;
}

const dispositions: Disposition[] = ['PENDING', 'FIX', 'SUPPRESS', 'DEFER'];

export function TriageControls({ disposition, onDispositionChange }: TriageControlsProps) {
  return (
    <TooltipProvider>
      <div className="flex gap-2">
        {dispositions.map(d => {
          const isSuppressDisabled = d === 'SUPPRESS';
          const button = (
            <Button
              key={d}
              size="sm"
              disabled={isSuppressDisabled}
              className={
                isSuppressDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : disposition === d
                    ? `${dispositionColor[d].fill} text-white ring-2 ring-offset-1`
                    : `${dispositionColor[d].tinted} ${dispositionColor[d].hover}`
              }
              onClick={() => !isSuppressDisabled && onDispositionChange(d)}
            >
              {d}
            </Button>
          );

          if (isSuppressDisabled) {
            return (
              <Tooltip key={d}>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>{button}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Suppression is managed via .ash.yaml</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </div>
    </TooltipProvider>
  );
}
