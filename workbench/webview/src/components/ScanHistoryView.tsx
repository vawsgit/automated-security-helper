import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppBreadcrumb } from './AppBreadcrumb';
import { ScanCard } from './ScanCard';
import { ScannerProgress } from './ScannerProgress';
import { postMessage } from '../hooks/useVSCodeAPI';
import { Play, Eye, X } from 'lucide-react';
import type { ScanSummary, ScanTarget } from '../types/types';

interface ScanHistoryViewProps {
  scans: ScanSummary[];
  selectedTarget?: ScanTarget;
  scanTargets: ScanTarget[];
  onSelectScan: (scanId: string) => void;
  onNavigateDashboard: () => void;
  onNavigate: (view: 'scanProgress' | 'findingList') => void;
  onSelectScanTarget: (scanTargetId: string) => void;
  onClearTarget: () => void;
}

const mockScanners = [
  { name: 'bandit', status: 'completed' as const, duration: '12s' },
  { name: 'semgrep', status: 'completed' as const, duration: '45s' },
  { name: 'checkov', status: 'running' as const },
  { name: 'detect-secrets', status: 'queued' as const },
  { name: 'grype', status: 'queued' as const },
  { name: 'cfn-nag', status: 'queued' as const },
  { name: 'cdk-nag', status: 'queued' as const },
  { name: 'npm-audit', status: 'queued' as const },
];

export function ScanHistoryView({
  scans, selectedTarget, scanTargets, onSelectScan, onNavigateDashboard, onNavigate,
  onSelectScanTarget, onClearTarget,
}: ScanHistoryViewProps) {
  const activeScan = scans.find(s => s.status === 'RUNNING');
  const completedScans = scans.filter(s => s.status !== 'RUNNING');

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div>
          <AppBreadcrumb segments={[
            { label: 'Dashboard', onClick: onNavigateDashboard },
            ...(selectedTarget ? [{ label: selectedTarget.displayName }] : []),
            { label: 'Scans' },
          ]} />
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs opacity-70">{scans.length} scans</p>
            {selectedTarget && (
              <button
                className="text-xs px-2 py-0.5 rounded-full border opacity-60 hover:opacity-100 transition-opacity"
                onClick={onClearTarget}
              >
                {selectedTarget.displayName} &times;
              </button>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => postMessage({ type: 'startScan' })}>
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Run New Scan
        </Button>
      </div>

      {/* Target filter tabs */}
      {!selectedTarget && scanTargets.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs opacity-70 mr-1 self-center">Target:</span>
          <Button
            variant="secondary"
            size="sm"
            className="text-xs h-6 px-2"
          >
            All
          </Button>
          {scanTargets.map(t => (
            <Button
              key={t.id}
              variant="outline"
              size="sm"
              className="text-xs h-6 px-2 opacity-60"
              onClick={() => onSelectScanTarget(t.id)}
            >
              {t.displayName}
            </Button>
          ))}
        </div>
      )}

      {/* Active scan */}
      {activeScan && (
        <>
          <div className="rounded-lg border border-yellow-500/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-yellow-500 animate-pulse">*</span>
                <span className="text-sm font-medium">Scan in Progress</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => onNavigate('scanProgress')}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Details
                </Button>
                <Button size="sm" variant="outline" className="text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
            <p className="text-xs opacity-70">
              Started {new Date(activeScan.startedAt).toLocaleTimeString()} &middot; {activeScan.sourceDirectory}
            </p>
            <ScannerProgress scanners={mockScanners} />
          </div>
          <Separator />
        </>
      )}

      {/* Completed scans */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">Completed Scans</h3>
        {completedScans.map(scan => (
          <ScanCard
            key={scan.id}
            scan={scan}
            onClick={() => onSelectScan(scan.id)}
            onViewFindings={() => onSelectScan(scan.id)}
          />
        ))}
        {completedScans.length === 0 && (
          <p className="text-sm opacity-50 py-4 text-center">No completed scans</p>
        )}
      </div>
    </div>
  );
}
