import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CodeBlock } from './CodeBlock';
import type { SuppressionData, Disposition } from '../types/types';

interface SuppressionPanelProps {
  suppression: SuppressionData | null;
  disposition: Disposition;
}

export function SuppressionPanel({ suppression, disposition }: SuppressionPanelProps) {
  if (disposition !== 'SUPPRESS') return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">Suppression</h3>
      <Alert>
        <AlertTitle className="text-sm">Suppression Details</AlertTitle>
        <AlertDescription className="text-xs">
          This finding has been marked for suppression. Provide a justification and review the generated .ash.yaml entry below.
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
    </div>
  );
}
