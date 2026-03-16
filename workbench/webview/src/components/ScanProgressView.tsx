import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AppBreadcrumb } from './AppBreadcrumb';
import { ScannerProgress } from './ScannerProgress';
import { X } from 'lucide-react';
import { useState } from 'react';

interface ScanProgressViewProps {
  targetPath?: string;
  onNavigateDashboard: () => void;
  onNavigateScans: () => void;
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

const mockLogLines = (path: string) => [
  '[14:30:01] Starting ASH security scan...',
  '[14:30:01] Mode: local',
  `[14:30:01] Source: ${path}`,
  '[14:30:02] Running bandit...',
  '[14:30:14] bandit completed (3 findings)',
  '[14:30:14] Running semgrep...',
  '[14:30:59] semgrep completed (8 findings)',
  '[14:30:59] Running checkov...',
];

export function ScanProgressView({ targetPath, onNavigateDashboard, onNavigateScans }: ScanProgressViewProps) {
  const [logOpen, setLogOpen] = useState(false);
  const completed = mockScanners.filter(s => s.status === 'completed').length;
  const total = mockScanners.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      {/* Breadcrumb */}
      <AppBreadcrumb segments={[
        { label: 'Dashboard', onClick: onNavigateDashboard },
        { label: 'Scans', onClick: onNavigateScans },
        { label: 'Scan in Progress' },
      ]} />

      <div className="flex flex-col items-center space-y-6">
        {/* Scan icon */}
        <div className="text-4xl animate-pulse opacity-60">
          &#x1F6E1;
        </div>

        <h1 className="text-lg font-semibold">Security Scan in Progress</h1>
        <p className="text-xs opacity-70 font-mono truncate max-w-md" title={targetPath}>
          {targetPath ?? '/src'} &middot; local mode
        </p>

        {/* Elapsed time (static per KISS 6.2) */}
        <p className="text-2xl font-mono">2:15</p>

        {/* Progress bar */}
        <div className="w-full space-y-1">
          <Progress value={pct} className="h-2" />
          <p className="text-xs opacity-70 text-center">{completed} of {total} scanners complete</p>
        </div>

        {/* Scanner checklist */}
        <div className="w-full">
          <ScannerProgress scanners={mockScanners} />
        </div>

        <Button variant="outline" size="sm">
          <X className="h-3.5 w-3.5 mr-1.5" />
          Cancel Scan
        </Button>

        {/* Log output */}
        <Collapsible open={logOpen} onOpenChange={setLogOpen} className="w-full">
          <CollapsibleTrigger className="text-xs opacity-70 hover:opacity-100 underline">
            {logOpen ? 'Hide' : 'Show'} scan log
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre
              className="text-xs p-3 rounded overflow-auto max-h-48 font-mono"
              style={{
                background: 'var(--vscode-textCodeBlock-background)',
                border: '1px solid var(--border)',
              }}
            >
              {mockLogLines(targetPath ?? '/src').join('\n')}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
