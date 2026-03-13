import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TooltipDemo() {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-start gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover</Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add to library</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex gap-2">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <Tooltip key={side}>
              <TooltipTrigger asChild>
                <Button variant="outline" className="capitalize">
                  {side}
                </Button>
              </TooltipTrigger>
              <TooltipContent side={side}>
                <p>Add to library</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Info">
              ?
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            To learn more about how this works, check out the docs.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
