import { useState, useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppBreadcrumb } from './AppBreadcrumb';
import { SeverityBadge } from './SeverityBadge';
import { DispositionBadge } from './DispositionBadge';
import { severityOrder } from '@/lib/theme-colors';
import type { FindingRow, Severity, Disposition } from '../types/types';

interface FindingsViewProps {
  findings: FindingRow[];
  onSelectFinding: (findingId: string) => void;
  onSetDisposition: (findingId: string, disposition: Disposition) => void;
  onNavigateDashboard: () => void;
}

const ALL_SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const ALL_DISPOSITIONS: Disposition[] = ['PENDING', 'FIX', 'SUPPRESS', 'DEFER'];

export function FindingsView({ findings, onSelectFinding, onSetDisposition, onNavigateDashboard }: FindingsViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(new Set(ALL_SEVERITIES));
  const [activeDispositions, setActiveDispositions] = useState<Set<Disposition>>(new Set(ALL_DISPOSITIONS));
  const [scannerFilter, setScannerFilter] = useState<string>('all');
  const [fileSearch, setFileSearch] = useState('');

  const scanners = useMemo(() => [...new Set(findings.map(f => f.scanner))].sort(), [findings]);

  const filtered = useMemo(() =>
    findings.filter(f =>
      activeSeverities.has(f.severity) &&
      activeDispositions.has(f.disposition) &&
      (scannerFilter === 'all' || f.scanner === scannerFilter) &&
      (fileSearch === '' || f.filePath.toLowerCase().includes(fileSearch.toLowerCase()) || f.title.toLowerCase().includes(fileSearch.toLowerCase()))
    ),
    [findings, activeSeverities, activeDispositions, scannerFilter, fileSearch]
  );

  const toggleSeverity = (s: Severity) => {
    setActiveSeverities(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const toggleDisposition = (d: Disposition) => {
    setActiveDispositions(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const columns: ColumnDef<FindingRow>[] = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      sortingFn: (a, b) => severityOrder[a.original.severity] - severityOrder[b.original.severity],
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="max-w-[300px] truncate block font-medium">{row.original.title}</span>
      ),
    },
    {
      accessorKey: 'filePath',
      header: 'File',
      cell: ({ row }) => (
        <span className="font-mono text-xs opacity-70 max-w-[200px] truncate block">
          {row.original.filePath}:{row.original.startLine}
        </span>
      ),
    },
    {
      accessorKey: 'scanner',
      header: 'Scanner',
      cell: ({ row }) => <span className="text-xs">{row.original.scanner}</span>,
    },
    {
      accessorKey: 'disposition',
      header: 'Status',
      cell: ({ row }) => <DispositionBadge disposition={row.original.disposition} />,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <span className="sr-only">Open menu</span>
              ...
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSetDisposition(row.original.id, 'FIX')}>
              Set Fix
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetDisposition(row.original.id, 'SUPPRESS')}>
              Set Suppress
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetDisposition(row.original.id, 'DEFER')}>
              Set Defer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSetDisposition(row.original.id, 'PENDING')}>
              Reset to Pending
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
    },
  ], [onSetDisposition]);

  const table = useReactTable({
    data: filtered,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, rowSelection },
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getSelectedRowModel().rows;

  const handleBatchDisposition = (disposition: Disposition) => {
    for (const row of selectedRows) {
      onSetDisposition(row.original.id, disposition);
    }
    setRowSelection({});
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div>
          <AppBreadcrumb segments={[
            { label: 'Dashboard', onClick: onNavigateDashboard },
            { label: 'Findings' },
          ]} />
          <p className="text-xs opacity-70 mt-1">
            {findings.length} total &middot; {filtered.length} shown
          </p>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs opacity-70 mr-1">Severity:</span>
          {ALL_SEVERITIES.map(s => (
            <Button
              key={s}
              variant={activeSeverities.has(s) ? 'default' : 'outline'}
              size="sm"
              className={`text-xs h-6 px-2 ${activeSeverities.has(s) ? '' : 'opacity-40'}`}
              onClick={() => toggleSeverity(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs opacity-70 mr-1">Status:</span>
          {ALL_DISPOSITIONS.map(d => (
            <Button
              key={d}
              variant={activeDispositions.has(d) ? 'default' : 'outline'}
              size="sm"
              className={`text-xs h-6 px-2 ${activeDispositions.has(d) ? '' : 'opacity-40'}`}
              onClick={() => toggleDisposition(d)}
            >
              {d}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Scanner:</span>
            <select
              className="text-xs rounded px-2 py-1"
              style={{
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
              }}
              value={scannerFilter}
              onChange={e => setScannerFilter(e.target.value)}
            >
              <option value="all">All</option>
              {scanners.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Input
            placeholder="Search files or titles..."
            value={fileSearch}
            onChange={e => setFileSearch(e.target.value)}
            className="max-w-xs h-7 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: ' ^',
                      desc: ' v',
                    }[header.column.getIsSorted() as string] ?? ''}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="cursor-pointer"
                  onClick={() => onSelectFinding(row.original.id)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center opacity-50">
                  No findings match the current filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Stats footer */}
      <div className="text-xs text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected
      </div>

      {/* Batch action bar */}
      {selectedRows.length > 0 && (
        <div className="sticky bottom-0 bg-background border-t p-3 flex items-center gap-3 -mx-4 px-4">
          <span className="text-sm font-medium">{selectedRows.length} finding{selectedRows.length > 1 ? 's' : ''} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Set Disposition</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBatchDisposition('FIX')}>Fix</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBatchDisposition('SUPPRESS')}>Suppress</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBatchDisposition('DEFER')}>Defer</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleBatchDisposition('PENDING')}>Reset to Pending</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>
            Deselect All
          </Button>
        </div>
      )}
    </div>
  );
}
