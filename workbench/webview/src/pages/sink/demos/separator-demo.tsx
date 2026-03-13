import { Separator } from '@/components/ui/separator';

export function SeparatorDemo() {
  return (
    <div>
      <div className="flex flex-col gap-1">
        <div className="text-sm leading-none font-medium">ASH Workbench</div>
        <div className="text-sm text-muted-foreground">
          Automated Security Helper for VS Code.
        </div>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center gap-4 text-sm">
        <div>Scan</div>
        <Separator orientation="vertical" />
        <div>Triage</div>
        <Separator orientation="vertical" />
        <div>Report</div>
      </div>
    </div>
  );
}
