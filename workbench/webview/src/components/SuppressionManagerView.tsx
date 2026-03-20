import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AppBreadcrumb } from './AppBreadcrumb';
import { SuppressionTable } from './SuppressionTable';
import { SuppressionRuleForm } from './SuppressionRuleForm';
import { postMessage } from '../hooks/useVSCodeAPI';
import type {
  SuppressionEntry,
  AshSuppression,
  AshIgnorePath,
  AshYamlConfigSummary,
  FindingRow,
} from '../types/types';
import { Plus, FileText, ChevronDown, Shield, Settings2 } from 'lucide-react';

interface SuppressionManagerViewProps {
  suppressions: SuppressionEntry[];
  ignorePaths: AshIgnorePath[];
  configInfo: AshYamlConfigSummary | null;
  currentFindings: FindingRow[];
  editingSuppressionIndex: number | null;
  addingNewSuppression: boolean;
  knownPaths: string[];
  knownRuleIds: string[];
  onEdit: (index: number) => void;
  onCloseEdit: () => void;
  onSaveEdit: (old: AshSuppression, updated: AshSuppression) => void;
  onRemove: (suppression: AshSuppression) => void;
  onAdd: (suppression: AshSuppression) => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onFindingClick: (findingId: string) => void;
  onNavigateDashboard: () => void;
}

function getIgnorePathStatus(ignorePath: AshIgnorePath): 'active' | 'expired' {
  if (ignorePath.expiration) {
    const expirationDate = new Date(ignorePath.expiration);
    if (expirationDate < new Date()) {
      return 'expired';
    }
  }
  return 'active';
}

function statusColor(status: 'active' | 'expired'): string {
  switch (status) {
    case 'active':
      return 'bg-green-500/15 text-green-700 dark:text-green-400';
    case 'expired':
      return 'bg-gray-500/15 text-gray-700 dark:text-gray-400';
  }
}

export function SuppressionManagerView({
  suppressions,
  ignorePaths,
  configInfo,
  // currentFindings is available via props but not directly used — finding data comes through suppression entries
  editingSuppressionIndex,
  addingNewSuppression,
  knownPaths,
  knownRuleIds,
  onEdit,
  onCloseEdit,
  onSaveEdit,
  onRemove,
  onAdd,
  onStartAdd,
  onCancelAdd,
  onFindingClick,
  onNavigateDashboard,
}: SuppressionManagerViewProps) {
  const [configOpen, setConfigOpen] = useState(false);

  const activeCount = suppressions.filter(s => s.status === 'active').length;
  const unusedCount = suppressions.filter(s => s.status === 'unused').length;
  const expiredCount = suppressions.filter(s => s.status === 'expired').length;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <AppBreadcrumb
          segments={[
            { label: 'Dashboard', onClick: onNavigateDashboard },
            { label: 'Suppressions' },
          ]}
        />
        <Button variant="outline" size="sm" onClick={onStartAdd}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Suppression
        </Button>
      </div>

      {/* Summary Header */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-70">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{suppressions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-70">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-70">Unused</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{unusedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-70">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">{expiredCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Source file link */}
      {configInfo && (
        <div className="flex items-center gap-2 text-xs opacity-70">
          <FileText className="h-3.5 w-3.5" />
          <button
            className="underline cursor-pointer hover:opacity-100"
            onClick={() =>
              postMessage({
                type: 'navigateToCode',
                payload: { filePath: '.ash.yaml', startLine: 1 },
              })
            }
          >
            .ash.yaml
          </button>
        </div>
      )}

      {/* Add form */}
      {addingNewSuppression && (
        <SuppressionRuleForm
          knownPaths={knownPaths}
          knownRuleIds={knownRuleIds}
          onSave={onAdd}
          onCancel={onCancelAdd}
        />
      )}

      {/* Suppression Table or Empty State */}
      {suppressions.length > 0 ? (
        <SuppressionTable
          suppressions={suppressions}
          editingSuppressionIndex={editingSuppressionIndex}
          onEdit={onEdit}
          onCloseEdit={onCloseEdit}
          onSaveEdit={onSaveEdit}
          onRemove={onRemove}
          onFindingClick={onFindingClick}
          editForm={
            editingSuppressionIndex !== null ? (
              <SuppressionRuleForm
                initialValues={suppressions[editingSuppressionIndex]}
                knownPaths={knownPaths}
                knownRuleIds={knownRuleIds}
                onSave={(updated) =>
                  onSaveEdit(suppressions[editingSuppressionIndex!], updated)
                }
                onCancel={onCloseEdit}
              />
            ) : undefined
          }
        />
      ) : (
        !addingNewSuppression && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <p className="text-sm opacity-70">
                No suppression rules defined in .ash.yaml
              </p>
              <Button variant="outline" size="sm" onClick={onStartAdd}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Suppression
              </Button>
            </CardContent>
          </Card>
        )
      )}

      {/* Ignore Paths Section (US8) */}
      {ignorePaths.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 opacity-60" />
              <h3 className="text-sm font-semibold">Scan Exclusions</h3>
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 px-2">Path</TableHead>
                    <TableHead className="h-8 px-2">Reason</TableHead>
                    <TableHead className="h-8 px-2">Expiration</TableHead>
                    <TableHead className="h-8 px-2">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ignorePaths.map((ip, i) => {
                    const status = getIgnorePathStatus(ip);
                    return (
                      <TableRow key={i}>
                        <TableCell className="px-2 py-1.5 font-mono text-xs">
                          {ip.path}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-xs">
                          {ip.reason}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-xs">
                          {ip.expiration
                            ? new Date(ip.expiration).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="px-2 py-1.5">
                          <Badge
                            variant="outline"
                            className={statusColor(status)}
                          >
                            {status === 'active' ? 'Active' : 'Expired'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* Configuration Info Section (US9) */}
      {configInfo && (
        <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5" />
                Configuration
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${configOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-4">
              <span className="opacity-70">Project name</span>
              <span>{configInfo.projectName ?? 'Not set'}</span>

              <span className="opacity-70">Severity threshold</span>
              <span>{configInfo.severityThreshold}</span>

              <span className="opacity-70">Enabled scanners</span>
              <span>
                {configInfo.enabledScanners.length > 0
                  ? configInfo.enabledScanners.join(', ')
                  : 'None'}
              </span>

              <span className="opacity-70">Fail on findings</span>
              <span>No</span>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
