import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

interface TriageNotesProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function TriageNotes({ notes, onNotesChange }: TriageNotesProps) {
  const [open, setOpen] = useState(notes.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100">
        <span>{open ? 'v' : '>'}</span>
        Notes
        {notes.length > 0 && <span className="normal-case font-normal">({notes.length} chars)</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <Textarea
          placeholder="Add notes about this triage decision..."
          value={notes}
          onChange={e => onNotesChange(e.target.value.slice(0, 500))}
          className="text-sm min-h-[80px]"
        />
        <p className="text-xs opacity-50 mt-1 text-right">{notes.length} / 500</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
