import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Play, FolderOpen, Home, FolderPlus } from 'lucide-react';
import type { ScanTarget } from '../types/types';

interface ScanTargetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceRoot: string;
  scanTargets: ScanTarget[];
  onStartScan: (targetPath: string) => void;
}

export function ScanTargetPicker({
  open, onOpenChange, workspaceRoot, scanTargets, onStartScan,
}: ScanTargetPickerProps) {
  const [customPath, setCustomPath] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleSelect = (path: string) => {
    onStartScan(path);
    onOpenChange(false);
    setCustomPath('');
    setShowCustom(false);
  };

  const handleCustomSubmit = () => {
    const path = customPath.trim();
    if (path) {
      handleSelect(path);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Security Scan</DialogTitle>
          <DialogDescription>
            Select a directory to scan. Findings are scoped per target directory — dispositions carry forward only within the same target.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {/* Workspace root — always first */}
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left"
            onClick={() => handleSelect(workspaceRoot)}
          >
            <Home className="h-4 w-4 shrink-0 opacity-60" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Workspace Root</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">default</Badge>
              </div>
              <p className="text-xs opacity-50 font-mono truncate">{workspaceRoot}</p>
            </div>
            <Play className="h-3.5 w-3.5 shrink-0 opacity-40" />
          </button>

          {/* Existing scan targets (excluding root if it matches) */}
          {scanTargets
            .filter(t => t.path !== workspaceRoot)
            .map(target => (
              <button
                key={target.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left"
                onClick={() => handleSelect(target.path)}
              >
                <FolderOpen className="h-4 w-4 shrink-0 opacity-60" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{target.displayName}</span>
                  <p className="text-xs opacity-50 font-mono truncate">{target.path}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs opacity-40">{target.findingCount} findings</span>
                  <Play className="h-3.5 w-3.5 opacity-40" />
                </div>
              </button>
            ))}
        </div>

        <Separator />

        {/* Custom path */}
        {!showCustom ? (
          <button
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
            onClick={() => setShowCustom(true)}
          >
            <FolderPlus className="h-4 w-4 shrink-0 opacity-60" />
            <span className="text-sm opacity-70">Scan a different folder...</span>
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs opacity-70">Enter the absolute path to scan:</p>
            <div className="flex gap-2">
              <Input
                value={customPath}
                onChange={e => setCustomPath(e.target.value)}
                placeholder="/path/to/directory"
                className="text-xs font-mono h-8"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit(); }}
              />
              <Button
                size="sm"
                className="shrink-0 h-8"
                disabled={!customPath.trim()}
                onClick={handleCustomSubmit}
              >
                <Play className="h-3 w-3 mr-1" />
                Scan
              </Button>
            </div>
            <p className="text-xs opacity-40">
              In VS Code, this would open a folder picker dialog.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
