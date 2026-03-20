import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CodeBlock } from './CodeBlock';
import type { SuppressionData, Disposition } from '../types/types';

interface SuppressionPanelProps {
  suppression: SuppressionData | null;
  disposition: Disposition;
  findingId?: string;
  isCurrentlySuppressed?: boolean;
  suppressionSource?: 'ash_yaml' | null;
  onUnsuppress?: (findingId: string) => void;
}

export function SuppressionPanel({
  suppression,
  disposition,
  findingId,
  isCurrentlySuppressed,
  suppressionSource,
  onUnsuppress,
}: SuppressionPanelProps) {
  const [confirmingUnsuppress, setConfirmingUnsuppress] = useState(false);

  if (disposition !== 'SUPPRESS' && !isCurrentlySuppressed) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">Suppression</h3>
      <Alert>
        <AlertTitle className="text-sm">Suppression Details</AlertTitle>
        <AlertDescription className="text-xs">
          {isCurrentlySuppressed
            ? 'This finding is suppressed via .ash.yaml configuration.'
            : 'This finding has been marked for suppression. Provide a justification and review the generated .ash.yaml entry below.'}
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <label className="text-xs font-medium">Justification</label>
        <Textarea
          value={suppression?.justification ?? ''}
          readOnly
          className="text-sm min-h-[60px]"
          placeholder="Provide a justification for suppressing this finding..."
        />
      </div>

      {suppression?.yamlEntry && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">.ash.yaml entry</label>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={() => navigator.clipboard.writeText(suppression.yamlEntry)}
            >
              Copy
            </Button>
          </div>
          <CodeBlock code={suppression.yamlEntry} startLine={1} />
        </div>
      )}

      {suppression?.expiresAt && (
        <p className="text-xs opacity-70">
          Expires: {new Date(suppression.expiresAt).toLocaleDateString()}
        </p>
      )}

      {/* Unsuppress action */}
      {isCurrentlySuppressed && suppressionSource === 'ash_yaml' && onUnsuppress && findingId && (
        <div className="space-y-2">
          {confirmingUnsuppress ? (
            <div className="rounded-md border p-3 space-y-2" style={{ borderColor: 'var(--vscode-panel-border)' }}>
              <p className="text-xs">
                This will remove the matching suppression entry from <code className="px-1 py-0.5 rounded" style={{ background: 'var(--vscode-textCodeBlock-background)' }}>.ash.yaml</code>.
                Other findings matched by the same rule may also become unsuppressed.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onUnsuppress(findingId);
                    setConfirmingUnsuppress(false);
                  }}
                >
                  Confirm Remove
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmingUnsuppress(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingUnsuppress(true)}
            >
              Unsuppress
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
