import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SeverityBadge } from './SeverityBadge';
import { postMessage } from '../hooks/useVSCodeAPI';
import type { FindingRow, Disposition } from '../types/types';

interface FindingDetailProps {
  finding: FindingRow;
  onBack: () => void;
}

const ALL_DISPOSITIONS: Disposition[] = ['PENDING', 'FIX', 'SUPPRESS', 'DEFER'];

const dispositionButtonStyles: Record<Disposition, string> = {
  PENDING: 'bg-gray-500 hover:bg-gray-600',
  FIX: 'bg-green-600 hover:bg-green-700',
  SUPPRESS: 'bg-purple-600 hover:bg-purple-700',
  DEFER: 'bg-amber-600 hover:bg-amber-700',
};

export function FindingDetail({ finding, onBack }: FindingDetailProps) {
  return (
    <div className="p-4 flex flex-col gap-4 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <button
          className="opacity-70 hover:opacity-100 underline"
          onClick={onBack}
        >
          Findings
        </button>
        <span className="opacity-50">&gt;</span>
        <span className="truncate">{finding.title}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          <h1 className="text-lg font-semibold">{finding.title}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs opacity-70">
          <span>Rule: <code className="px-1 py-0.5 rounded" style={{ background: 'var(--vscode-textCodeBlock-background)' }}>{finding.ruleId}</code></span>
          <span>Scanner: {finding.scanner}</span>
        </div>
      </div>

      <Separator />

      {/* Disposition controls */}
      <div>
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Disposition</h3>
        <div className="flex gap-2">
          {ALL_DISPOSITIONS.map(d => (
            <Button
              key={d}
              size="sm"
              className={`text-xs text-white ${
                finding.disposition === d
                  ? dispositionButtonStyles[d] + ' ring-2 ring-offset-1'
                  : 'opacity-50 ' + dispositionButtonStyles[d]
              }`}
              style={finding.disposition === d ? { outlineColor: 'var(--vscode-focusBorder)' } : undefined}
              onClick={() => {
                postMessage({
                  type: 'setDisposition',
                  payload: { findingId: finding.id, disposition: d },
                });
              }}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Description */}
      <div>
        <h3 className="text-xs font-semibold mb-1 uppercase tracking-wide opacity-70">Description</h3>
        <p className="text-sm">{finding.description}</p>
      </div>

      <Separator />

      {/* Code location */}
      <div>
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Location</h3>
        <div className="flex items-center gap-2 mb-2">
          <button
            className="text-sm underline"
            style={{ color: 'var(--vscode-textLink-foreground)' }}
            onClick={() => {
              postMessage({
                type: 'navigateToCode',
                payload: { filePath: finding.filePath, startLine: finding.startLine },
              });
            }}
          >
            {finding.filePath}
          </button>
          <span className="text-xs opacity-70">
            Line {finding.startLine}{finding.endLine !== finding.startLine ? `-${finding.endLine}` : ''}
          </span>
        </div>
        <pre
          className="text-xs p-3 rounded overflow-x-auto"
          style={{
            background: 'var(--vscode-textCodeBlock-background)',
            border: '1px solid var(--border)',
          }}
        >
          <code>{finding.codeSnippet}</code>
        </pre>
      </div>
    </div>
  );
}
