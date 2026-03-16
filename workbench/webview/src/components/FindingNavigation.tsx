import { Button } from '@/components/ui/button';
import type { FindingRow } from '../types/types';

interface FindingNavigationProps {
  findings: FindingRow[];
  currentId: string;
  onNavigate: (id: string) => void;
}

export function FindingNavigation({ findings, currentId, onNavigate }: FindingNavigationProps) {
  const currentIndex = findings.findIndex(f => f.id === currentId);
  if (currentIndex === -1) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < findings.length - 1;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2"
        disabled={!hasPrev}
        onClick={() => hasPrev && onNavigate(findings[currentIndex - 1].id)}
      >
        Prev
      </Button>
      <span className="opacity-70">
        {currentIndex + 1} of {findings.length}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2"
        disabled={!hasNext}
        onClick={() => hasNext && onNavigate(findings[currentIndex + 1].id)}
      >
        Next
      </Button>
    </div>
  );
}
