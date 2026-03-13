import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Task = {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done' | 'backlog' | 'canceled';
  priority: 'high' | 'medium' | 'low';
  type: 'bug' | 'feature' | 'documentation';
};

const statusStyles: Record<string, string> = {
  'todo': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'done': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'backlog': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  'canceled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const priorityStyles: Record<string, string> = {
  'high': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'low': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const data: Task[] = [
  { id: 'TASK-8782', title: 'Update API documentation for v2 endpoints', status: 'in-progress', priority: 'medium', type: 'documentation' },
  { id: 'TASK-7839', title: 'Fix memory leak in WebSocket handler', status: 'todo', priority: 'high', type: 'bug' },
  { id: 'TASK-1280', title: 'Resolve race condition in auth middleware', status: 'done', priority: 'high', type: 'bug' },
  { id: 'TASK-7540', title: 'Add dark mode support to dashboard', status: 'in-progress', priority: 'medium', type: 'feature' },
  { id: 'TASK-8686', title: 'Write migration guide for v1 to v2', status: 'backlog', priority: 'low', type: 'documentation' },
  { id: 'TASK-1138', title: 'Implement rate limiting for public API', status: 'todo', priority: 'high', type: 'feature' },
  { id: 'TASK-7195', title: 'Fix incorrect date parsing in reports', status: 'canceled', priority: 'medium', type: 'bug' },
  { id: 'TASK-2318', title: 'Add export to CSV feature', status: 'backlog', priority: 'low', type: 'feature' },
  { id: 'TASK-4495', title: 'Update onboarding flow documentation', status: 'in-progress', priority: 'medium', type: 'documentation' },
  { id: 'TASK-5695', title: 'Fix pagination bug on findings page', status: 'todo', priority: 'high', type: 'bug' },
  { id: 'TASK-9910', title: 'Add SSO support via SAML', status: 'backlog', priority: 'medium', type: 'feature' },
  { id: 'TASK-6630', title: 'Fix timezone display in scan timestamps', status: 'done', priority: 'low', type: 'bug' },
];

const columns: ColumnDef<Task>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'id',
    header: 'Task',
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue('id')}</span>,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => <span className="capitalize">{row.getValue('type')}</span>,
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => (
      <span className="max-w-[300px] truncate block">{row.getValue('title')}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return (
        <Badge variant="outline" className={statusStyles[status]}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'priority',
    header: 'Priority',
    cell: ({ row }) => {
      const priority = row.getValue('priority') as string;
      return (
        <Badge variant="outline" className={priorityStyles[priority]}>
          {priority}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const task = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              ⋯
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(task.id)}>
              Copy task ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuItem>Edit task</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function TasksDemo() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, rowSelection },
  });

  return (
    <div className="w-full space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Welcome back!</h2>
        <p className="text-sm text-muted-foreground">Here's a list of your tasks for this month.</p>
      </div>
      <div className="flex items-center">
        <Input
          placeholder="Filter tasks..."
          value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
          onChange={(event) => table.getColumn('title')?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
