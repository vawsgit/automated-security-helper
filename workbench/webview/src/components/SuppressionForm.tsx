import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CodeBlock } from './CodeBlock';
import type { FindingRow, SuppressionScope, SuppressionInput, AshSuppression } from '../types/types';

function generateYamlPreview(s: AshSuppression): string {
  const lines: string[] = [`- path: "${s.path}"`];
  if (s.rule_id) { lines.push(`  rule_id: "${s.rule_id}"`); }
  lines.push(`  reason: "${s.reason}"`);
  if (s.line_start != null) { lines.push(`  line_start: ${s.line_start}`); }
  if (s.line_end != null) { lines.push(`  line_end: ${s.line_end}`); }
  if (s.expiration) { lines.push(`  expiration: "${s.expiration}"`); }
  return lines.join('\n');
}

interface SuppressionFormProps {
  finding: FindingRow;
  isPending: boolean;
  onSubmit: (input: SuppressionInput) => void;
  onCancel: () => void;
}

export function SuppressionForm({ finding, isPending, onSubmit, onCancel }: SuppressionFormProps) {
  const [scope, setScope] = useState<SuppressionScope>('file_rule');
  const [justification, setJustification] = useState(finding.notes || '');
  const [includeLineRange, setIncludeLineRange] = useState(false);
  const [expiration, setExpiration] = useState('');

  const hasLineRange = finding.startLine > 0 || finding.endLine > 0;

  const previewSuppression = useMemo((): AshSuppression => {
    let filePath: string;
    let ruleId: string | null;

    switch (scope) {
      case 'file_rule':
        filePath = finding.filePath;
        ruleId = finding.ruleId;
        break;
      case 'rule_everywhere':
        filePath = '**';
        ruleId = finding.ruleId;
        break;
      case 'file_all_rules':
        filePath = finding.filePath;
        ruleId = null;
        break;
    }

    return {
      path: filePath,
      rule_id: ruleId,
      reason: justification || '(justification required)',
      line_start: includeLineRange && hasLineRange ? finding.startLine : null,
      line_end: includeLineRange && hasLineRange ? finding.endLine : null,
      expiration: expiration || null,
    };
  }, [scope, justification, includeLineRange, expiration, finding, hasLineRange]);

  const yamlPreview = useMemo(() => generateYamlPreview(previewSuppression), [previewSuppression]);

  const canSubmit = justification.trim().length > 0 && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      findingId: finding.id,
      filePath: finding.filePath,
      ruleId: finding.ruleId,
      scope,
      justification: justification.trim(),
      includeLineRange: includeLineRange && hasLineRange,
      startLine: includeLineRange && hasLineRange ? finding.startLine : null,
      endLine: includeLineRange && hasLineRange ? finding.endLine : null,
      expiration: expiration || null,
    });
  };

  return (
    <div className="space-y-4 rounded-md border p-4" style={{ borderColor: 'var(--vscode-panel-border)' }}>
      <h4 className="text-sm font-semibold">Suppress Finding</h4>

      {/* Scope selector */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Scope</Label>
        <RadioGroup value={scope} onValueChange={(v) => setScope(v as SuppressionScope)}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="file_rule" id="scope-file-rule" />
            <Label htmlFor="scope-file-rule" className="text-xs font-normal">
              This rule in this file
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="rule_everywhere" id="scope-rule-everywhere" />
            <Label htmlFor="scope-rule-everywhere" className="text-xs font-normal">
              This rule everywhere
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="file_all_rules" id="scope-file-all" />
            <Label htmlFor="scope-file-all" className="text-xs font-normal">
              All rules in this file
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Justification */}
      <div className="space-y-2">
        <Label htmlFor="suppress-justification" className="text-xs font-medium">
          Justification <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="suppress-justification"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Why is this finding being suppressed?"
          className="text-sm min-h-[60px]"
          disabled={isPending}
        />
      </div>

      {/* Line range toggle (only shown when finding has line data) */}
      {hasLineRange && (
        <div className="flex items-center gap-2">
          <Switch
            id="suppress-line-range"
            checked={includeLineRange}
            onCheckedChange={setIncludeLineRange}
            disabled={isPending}
          />
          <Label htmlFor="suppress-line-range" className="text-xs font-normal">
            Restrict to lines {finding.startLine}–{finding.endLine}
          </Label>
        </div>
      )}

      {/* Expiration */}
      <div className="space-y-2">
        <Label htmlFor="suppress-expiration" className="text-xs font-medium">
          Expiration <span className="text-xs opacity-50">(optional)</span>
        </Label>
        <Input
          id="suppress-expiration"
          type="date"
          value={expiration}
          onChange={(e) => setExpiration(e.target.value)}
          className="text-sm w-48"
          disabled={isPending}
        />
      </div>

      {/* YAML preview */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">.ash.yaml preview</Label>
        <CodeBlock code={yamlPreview} startLine={1} />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isPending ? 'Adding...' : 'Add Suppression'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
