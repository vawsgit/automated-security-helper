import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronsUp,
  Circle,
  Clock,
  EyeOff,
  Minus,
  PlusCircle,
  Wrench,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppBreadcrumb } from './AppBreadcrumb';
import { severityOrder } from '@/lib/theme-colors';
import type { FindingRow, ScanTarget, Disposition } from '../types/types';

interface FindingsViewProps {
  findings: FindingRow[];
  selectedTarget?: ScanTarget;
  onSelectFinding: (findingId: string) => void;
  onSetDisposition: (findingId: string, disposition: Disposition) => void;
  onNavigateDashboard: () => void;
  onClearTarget?: () => void;
}

const severityOptions = [
  { value: 'CRITICAL', label: 'Critical', icon: ChevronsUp, color: 'text-red-500' },
  { value: 'HIGH', label: 'High', icon: ArrowUp, color: 'text-orange-500' },
  { value: 'MEDIUM', label: 'Medium', icon: ArrowRight, color: 'text-yellow-500' },
  { value: 'LOW', label: 'Low', icon: ArrowDown, color: 'text-blue-500' },
  { value: 'INFO', label: 'Info', icon: Minus, color: 'text-gray-500 dark:text-gray-300' },
];

const dispositionOptions = [
  { value: 'PENDING', label: 'Pending', icon: Circle, color: 'text-muted-foreground' },
  { value: 'FIX', label: 'Fix', icon: Wrench, color: 'text-teal-500' },
  { value: 'SUPPRESS', label: 'Suppress', icon: EyeOff, color: 'text-indigo-500' },
  { value: 'DEFER', label: 'Defer', icon: Clock, color: 'text-slate-500' },
];

// --- Faceted Filter Component ---

interface FacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

function FacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: FacetedFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues();
  const selectedValues = new Set(column?.getFilterValue() as string[]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="size-4" />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        selectedValues.delete(option.value);
                      } else {
                        selectedValues.add(option.value);
                      }
                      const filterValues = Array.from(selectedValues);
                      column?.setFilterValue(
                        filterValues.length ? filterValues : undefined,
                      );
                    }}
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-[4px] border',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input [&_svg]:invisible',
                      )}
                    >
                      <Check className="text-primary-foreground size-3.5" />
                    </div>
                    {option.icon && (
                      <option.icon className="text-muted-foreground size-4" />
                    )}
                    <span>{option.label}</span>
                    {facets?.get(option.value) && (
                      <span className="text-muted-foreground ml-auto flex size-4 items-center justify-center font-mono text-xs">
                        {facets.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column?.setFilterValue(undefined)}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// --- Main Component ---

export function FindingsView({ findings, selectedTarget, onSelectFinding, onSetDisposition, onNavigateDashboard, onClearTarget }: FindingsViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});

  const scannerOptions = useMemo(() =>
    [...new Set(findings.map(f => f.scanner))].sort().map(s => ({ value: s, label: s })),
    [findings]
  );

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
          className="translate-y-[2px] border-muted-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background data-[state=checked]:border-foreground"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
          className="translate-y-[2px] border-muted-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background data-[state=checked]:border-foreground"
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ row }) => {
        const sev = severityOptions.find(s => s.value === row.original.severity);
        if (!sev) return null;
        return (
          <div className="flex items-center gap-2">
            <sev.icon className={cn('size-4', sev.color)} />
            <span>{sev.label}</span>
          </div>
        );
      },
      sortingFn: (a, b) => severityOrder[a.original.severity] - severityOrder[b.original.severity],
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="max-w-[300px] truncate block font-medium">{row.original.title}</span>
      ),
      filterFn: (row, _id, value: string) => {
        const title = row.original.title.toLowerCase();
        const filePath = row.original.filePath.toLowerCase();
        const search = value.toLowerCase();
        return title.includes(search) || filePath.includes(search);
      },
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
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'disposition',
      header: 'Status',
      cell: ({ row }) => {
        const disp = dispositionOptions.find(d => d.value === row.original.disposition);
        if (!disp) return null;
        return (
          <div className="flex items-center gap-2">
            <disp.icon className={cn('size-4', disp.color)} />
            <span>{disp.label}</span>
          </div>
        );
      },
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <span className="sr-only">Open menu</span>
              ⋯
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
    data: findings,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, rowSelection },
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const isFiltered = columnFilters.length > 0;

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
            ...(selectedTarget ? [{ label: selectedTarget.displayName }] : []),
            { label: 'Findings' },
          ]} />
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs opacity-70">
              {findings.length} total &middot; {table.getFilteredRowModel().rows.length} shown
            </p>
            {selectedTarget && onClearTarget && (
              <button
                className="text-xs px-2 py-0.5 rounded-full border opacity-60 hover:opacity-100 transition-opacity"
                onClick={onClearTarget}
              >
                {selectedTarget.displayName} &times;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder="Filter findings..."
            value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
            onChange={(event) => table.getColumn('title')?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
          {table.getColumn('severity') && (
            <FacetedFilter
              column={table.getColumn('severity')}
              title="Severity"
              options={severityOptions}
            />
          )}
          {table.getColumn('disposition') && (
            <FacetedFilter
              column={table.getColumn('disposition')}
              title="Status"
              options={dispositionOptions}
            />
          )}
          {table.getColumn('scanner') && (
            <FacetedFilter
              column={table.getColumn('scanner')}
              title="Scanner"
              options={scannerOptions}
            />
          )}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.resetColumnFilters()}
            >
              Reset
              <X className="ml-1 size-4" />
            </Button>
          )}
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
                    className={cn('h-8 px-2', header.column.getCanSort() && 'cursor-pointer select-none')}
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
                    <TableCell key={cell.id} className="px-2 py-1.5">
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
