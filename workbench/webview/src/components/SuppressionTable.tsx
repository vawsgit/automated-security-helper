import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type {
  SuppressionEntry,
  AshSuppression,
  MatchedFindingRef,
  SuppressionStatus,
} from '../types/types';

interface SuppressionTableProps {
  suppressions: SuppressionEntry[];
  editingSuppressionIndex: number | null;
  onEdit: (index: number) => void;
  onCloseEdit: () => void;
  onSaveEdit: (old: AshSuppression, updated: AshSuppression) => void;
  onRemove: (suppression: AshSuppression) => void;
  onFindingClick: (findingId: string) => void;
  editForm?: React.ReactNode;
}

const statusColor: Record<SuppressionStatus, string> = {
  active: 'bg-green-500/15 text-green-700 dark:text-green-400',
  unused: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  expired: 'bg-gray-500/15 text-gray-700 dark:text-gray-300',
};

const statusOrder: Record<SuppressionStatus, number> = {
  active: 0,
  unused: 1,
  expired: 2,
};

const severityBgColor: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-700 dark:text-red-400',
  HIGH: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  MEDIUM: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  LOW: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  INFO: 'bg-gray-500/15 text-gray-700 dark:text-gray-300',
};

type SortColumn = 'rule_id' | 'path' | 'matchCount' | 'expiration' | 'status';

const COLUMN_COUNT = 8;

export function SuppressionTable({
  suppressions,
  editingSuppressionIndex,
  onEdit,
  // onCloseEdit and onSaveEdit are wired into editForm by the parent
  onRemove,
  onFindingClick,
  editForm,
}: SuppressionTableProps) {
  const [activeFilters, setActiveFilters] = useState<Set<SuppressionStatus>>(
    new Set(['active', 'unused', 'expired'])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [removeConfirmIndex, setRemoveConfirmIndex] = useState<number | null>(null);

  const toggleFilter = (status: SuppressionStatus) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const toggleSort = (column: SortColumn) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumn(null);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const filtered = useMemo(() => {
    let result = suppressions.filter((s) => activeFilters.has(s.status));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          (s.rule_id && s.rule_id.toLowerCase().includes(q)) ||
          s.path.toLowerCase().includes(q) ||
          s.reason.toLowerCase().includes(q)
      );
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortColumn) {
          case 'rule_id': {
            const aVal = a.rule_id ?? '';
            const bVal = b.rule_id ?? '';
            cmp = aVal.localeCompare(bVal);
            break;
          }
          case 'path':
            cmp = a.path.localeCompare(b.path);
            break;
          case 'matchCount':
            cmp = a.matchCount - b.matchCount;
            break;
          case 'expiration': {
            const aDate = a.expiration ?? '';
            const bDate = b.expiration ?? '';
            if (!aDate && !bDate) { cmp = 0; }
            else if (!aDate) { cmp = 1; }
            else if (!bDate) { cmp = -1; }
            else { cmp = aDate.localeCompare(bDate); }
            break;
          }
          case 'status':
            cmp = statusOrder[a.status] - statusOrder[b.status];
            break;
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [suppressions, activeFilters, searchQuery, sortColumn, sortDirection]);

  const removeTarget =
    removeConfirmIndex !== null ? suppressions[removeConfirmIndex] : null;

  const formatLines = (s: SuppressionEntry) => {
    if (s.line_start == null && s.line_end == null) { return 'Any'; }
    return `L${s.line_start ?? '?'}-L${s.line_end ?? '?'}`;
  };

  const formatExpiration = (exp: string | null) => {
    if (!exp) { return 'None'; }
    return new Date(exp).toLocaleDateString();
  };

  const truncate = (text: string, max: number) => {
    if (text.length <= max) { return text; }
    return text.slice(0, max) + '...';
  };

  return (
    <div className="space-y-3">
      {/* Filters and search */}
      <div className="flex flex-wrap items-center gap-2">
        {(['active', 'unused', 'expired'] as SuppressionStatus[]).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={activeFilters.has(status) ? 'secondary' : 'outline'}
            onClick={() => toggleFilter(status)}
            className="capitalize"
          >
            {status}
          </Button>
        ))}
        <div className="relative ml-auto w-72">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
          <Input
            placeholder="Search by rule ID, path, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-sm"
          />
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {suppressions.length} rules
      </p>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort('rule_id')}
            >
              Rule ID {renderSortIcon('rule_id')}
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort('path')}
            >
              Path {renderSortIcon('path')}
            </TableHead>
            <TableHead>Lines</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort('expiration')}
            >
              Expiration {renderSortIcon('expiration')}
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort('status')}
            >
              Status {renderSortIcon('status')}
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort('matchCount')}
            >
              Matches {renderSortIcon('matchCount')}
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT + 1} className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No suppression rules match the current filters.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((entry) => {
              const originalIndex = suppressions.indexOf(entry);
              const isExpanded = expandedIndex === originalIndex;
              const isEditing = editingSuppressionIndex === originalIndex;

              return (
                <Collapsible key={originalIndex} asChild open={isExpanded || isEditing}>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow
                        className="cursor-pointer"
                        onClick={(e) => {
                          // Avoid toggling when clicking action buttons
                          if ((e.target as HTMLElement).closest('[data-action]')) {
                            return;
                          }
                          if (isEditing) { return; }
                          setExpandedIndex(isExpanded ? null : originalIndex);
                        }}
                      >
                        <TableCell className="w-8 px-2">
                          {isExpanded || isEditing ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {entry.rule_id ?? 'Any'}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate">
                          {entry.path}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatLines(entry)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px]" title={entry.reason}>
                          {truncate(entry.reason, 60)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatExpiration(entry.expiration)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColor[entry.status]}>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {entry.matchCount}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" data-action="true">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(originalIndex);
                              }}
                              title="Edit suppression"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRemoveConfirmIndex(originalIndex);
                              }}
                              title="Remove suppression"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      {isEditing ? (
                        <tr>
                          <td colSpan={COLUMN_COUNT + 1} className="p-4">
                            {editForm}
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={COLUMN_COUNT + 1} className="p-4">
                            <MatchedFindingsSection
                              matchedFindings={entry.matchedFindings}
                              matchCount={entry.matchCount}
                              onFindingClick={onFindingClick}
                            />
                          </td>
                        </tr>
                      )}
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Remove confirmation dialog */}
      <Dialog
        open={removeConfirmIndex !== null}
        onOpenChange={(open) => {
          if (!open) { setRemoveConfirmIndex(null); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Suppression Rule?</DialogTitle>
            <DialogDescription>
              {removeTarget && removeTarget.matchCount > 0
                ? `Remove this suppression rule? This will unsuppress ${removeTarget.matchCount} finding(s) in the current scan.`
                : 'No findings are currently matched by this rule.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveConfirmIndex(null)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (removeTarget) {
                  onRemove(removeTarget);
                }
                setRemoveConfirmIndex(null);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatchedFindingsSection({
  matchedFindings,
  matchCount,
  onFindingClick,
}: {
  matchedFindings: MatchedFindingRef[];
  matchCount: number;
  onFindingClick: (findingId: string) => void;
}) {
  if (matchCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No findings matched by this rule in the latest scan.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium mb-2">
        Matched Findings ({matchCount})
      </p>
      {matchedFindings.map((finding) => (
        <button
          key={finding.id}
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted/50 transition-colors"
          onClick={() => onFindingClick(finding.id)}
        >
          <Badge
            variant="outline"
            className={severityBgColor[finding.severity] ?? severityBgColor['INFO']}
          >
            {finding.severity}
          </Badge>
          <span className="truncate font-medium">{finding.title}</span>
          <span className="ml-auto shrink-0 font-mono opacity-70">
            {finding.file}
            {finding.line != null ? `:${finding.line}` : ''}
          </span>
        </button>
      ))}
    </div>
  );
}
