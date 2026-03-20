import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnalysisProgressProps {
  message: string;
  toolName?: string;
  onCancel: () => void;
}

export function AnalysisProgress({ message, toolName, onCancel }: AnalysisProgressProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Loader2 className="h-4 w-4 animate-spin shrink-0 opacity-70" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{message}</p>
        {toolName && (
          <p className="text-xs opacity-50 truncate">Tool: {toolName}</p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive shrink-0"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}
