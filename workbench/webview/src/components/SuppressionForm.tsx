import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { CodeBlock } from './CodeBlock';
import { Loader2, Sparkles, RefreshCw, Wand2 } from 'lucide-react';
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
  // Suppression Message Generation (Spec 025)
  isGenerating?: boolean;
  generatedMessage?: string | null;
  generationError?: string | null;
  claudeSettingsDetected?: boolean;
  onGenerateMessage?: (scope: SuppressionScope, mode: 'generate' | 'regenerate') => void;
  onRefineMessage?: (scope: SuppressionScope, existingMessage: string) => void;
  onClearGeneratedMessage?: () => void;
}

export function SuppressionForm({
  finding,
  isPending,
  onSubmit,
  onCancel,
  isGenerating,
  generatedMessage,
  generationError,
  claudeSettingsDetected,
  onGenerateMessage,
  onRefineMessage,
  onClearGeneratedMessage,
}: SuppressionFormProps) {
  const [scope, setScope] = useState<SuppressionScope>('file_rule');
  const [justification, setJustification] = useState(finding.notes || '');
  const [includeLineRange, setIncludeLineRange] = useState(false);
  const [expiration, setExpiration] = useState('');

  // Track whether the user has received a generated message (for showing Regenerate)
  const [hasGenerated, setHasGenerated] = useState(false);
  // Track the last generated message to detect user edits (for showing Refine)
  const lastGeneratedRef = useRef<string | null>(null);

  const hasLineRange = finding.startLine > 0 || finding.endLine > 0;
  const aiAvailable = claudeSettingsDetected !== false;

  // Auto-populate justification when a generated message arrives
  useEffect(() => {
    if (generatedMessage) {
      setJustification(generatedMessage);
      setHasGenerated(true);
      lastGeneratedRef.current = generatedMessage;
    }
  }, [generatedMessage]);

  // Detect whether the user has edited the generated text
  const isEdited = hasGenerated && lastGeneratedRef.current !== null && justification !== lastGeneratedRef.current;

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
          disabled={isPending || isGenerating}
        />

        {/* Generation buttons */}
        {onGenerateMessage && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Generate / Regenerate button */}
            {!hasGenerated ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGenerateMessage(scope, 'generate')}
                disabled={isGenerating || !aiAvailable}
                title={!aiAvailable ? 'AI service not configured. Configure ashWorkbench.llm settings to enable.' : undefined}
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                {isGenerating ? 'Generating...' : 'Generate Message'}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGenerateMessage(scope, 'regenerate')}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {isGenerating ? 'Generating...' : 'Regenerate'}
              </Button>
            )}

            {/* Refine button (only when user edited a generated message) */}
            {isEdited && onRefineMessage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRefineMessage(scope, justification)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Refine
              </Button>
            )}
          </div>
        )}

        {/* Generation error */}
        {generationError && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              <span className="text-xs">{generationError}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs ml-2"
                onClick={() => onClearGeneratedMessage?.()}
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}
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
