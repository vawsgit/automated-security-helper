import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppBreadcrumb } from './AppBreadcrumb';
import { ScanCard } from './ScanCard';
import { ScannerProgress } from './ScannerProgress';
import { Play, Eye, X } from 'lucide-react';
import type { ScanSummary } from '../types/types';

interface ScanHistoryViewProps {
  scans: ScanSummary[];
  onSelectScan: (scanId: string) => void;
  onNavigateDashboard: () => void;
  onNavigate: (view: 'scanProgress' | 'findingList') => void;
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

export function ScanHistoryView({ scans, onSelectScan, onNavigateDashboard, onNavigate }: ScanHistoryViewProps) {
  const activeScan = scans.find(s => s.status === 'RUNNING');
  const completedScans = scans.filter(s => s.status !== 'RUNNING');

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div>
          <AppBreadcrumb segments={[
            { label: 'Dashboard', onClick: onNavigateDashboard },
            { label: 'Scans' },
          ]} />
          <p className="text-xs opacity-70 mt-1">{scans.length} scans</p>
        </div>
        <Button size="sm">
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Run New Scan
        </Button>
      </div>

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
