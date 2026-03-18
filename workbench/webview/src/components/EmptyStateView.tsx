import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppBreadcrumb } from './AppBreadcrumb';
import { postMessage } from '../hooks/useVSCodeAPI';
import { Play, LayoutDashboard, Settings } from 'lucide-react';

interface EmptyStateViewProps {
  variant: 'welcome' | 'noFindings' | 'scanFailed';
  errorMessage?: string;
  onRunScan?: () => void;
  onNavigateDashboard?: () => void;
}

export function EmptyStateView({ variant, errorMessage, onNavigateDashboard }: EmptyStateViewProps) {
  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <AppBreadcrumb segments={[
        ...(onNavigateDashboard ? [{ label: 'Dashboard', onClick: onNavigateDashboard }] : []),
        { label: variant === 'welcome' ? 'Welcome' : variant === 'noFindings' ? 'No Findings' : 'Scan Failed' },
      ]} />

      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center text-center py-8 space-y-4">
            {variant === 'welcome' && (
              <>
                <span className="text-4xl">&#x1F6E1;</span>
                <h1 className="text-lg font-semibold">Welcome to ASH Workbench</h1>
                <p className="text-sm opacity-70">
                  Run your first security scan to identify vulnerabilities in your codebase.
                </p>
                <ol className="text-sm text-left space-y-2 opacity-70">
                  <li>1. Ensure ASH CLI is installed (<code className="px-1 py-0.5 rounded" style={{ background: 'var(--vscode-textCodeBlock-background)' }}>pip install ash</code>)</li>
                  <li>2. Open a project folder in VS Code</li>
                  <li>3. Click "Run First Scan" below</li>
                </ol>
                <Button variant="outline">
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Run First Scan
                </Button>
              </>
            )}
            {variant === 'noFindings' && (
              <>
                <span className="text-4xl">&#x2705;</span>
                <h1 className="text-lg font-semibold">No Findings</h1>
                <p className="text-sm opacity-70">
                  Your latest scan completed with no security findings. Great job!
                </p>
                <Button variant="outline" onClick={onNavigateDashboard}>
                  <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                  Return to Dashboard
                </Button>
              </>
            )}
            {variant === 'scanFailed' && (
              <>
                <span className="text-4xl">&#x26A0;</span>
                <h1 className="text-lg font-semibold">Scan Failed</h1>
                <p className="text-sm opacity-70">
                  {errorMessage ?? 'An unexpected error occurred during the scan.'}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={() => postMessage({ type: 'openSettings' })}>
                    <Settings className="h-3.5 w-3.5 mr-1.5" />
                    Check Settings
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
