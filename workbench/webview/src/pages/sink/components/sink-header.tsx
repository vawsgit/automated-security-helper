import { AppBreadcrumb } from '@/components/AppBreadcrumb';
import { Separator } from '@/components/ui/separator';

interface SinkHeaderProps {
  searchFilter: string;
  onSearchChange: (value: string) => void;
}

export function SinkHeader({ searchFilter, onSearchChange }: SinkHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-[var(--background)] px-4">
      <AppBreadcrumb segments={[{ label: 'Kitchen Sink' }]} />
      <Separator orientation="vertical" className="mx-3 !h-4" />
      <input
        type="text"
        placeholder="Filter components..."
        value={searchFilter}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 rounded border bg-transparent px-2 py-1 text-xs outline-none placeholder:opacity-50 focus:border-[var(--focusBorder)]"
      />
      {searchFilter && (
        <button
          onClick={() => onSearchChange('')}
          className="ml-2 text-xs opacity-60 hover:opacity-100"
        >
          Clear
        </button>
      )}
    </header>
  );
}
