import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { AshSuppression } from '../types/types';

interface SuppressionRuleFormProps {
  initialValues?: AshSuppression;
  onSave: (suppression: AshSuppression) => void;
  onCancel: () => void;
  isPending?: boolean;
  knownPaths?: string[];
  knownRuleIds?: string[];
}

export function SuppressionRuleForm({
  initialValues,
  onSave,
  onCancel,
  isPending,
  knownPaths,
  knownRuleIds,
}: SuppressionRuleFormProps) {
  const [pathValue, setPathValue] = useState(initialValues?.path ?? '');
  const [ruleIdValue, setRuleIdValue] = useState(initialValues?.rule_id ?? '');
  const [reasonValue, setReasonValue] = useState(initialValues?.reason ?? '');
  const [lineStartValue, setLineStartValue] = useState(
    initialValues?.line_start != null ? String(initialValues.line_start) : '',
  );
  const [lineEndValue, setLineEndValue] = useState(
    initialValues?.line_end != null ? String(initialValues.line_end) : '',
  );
  const [expirationValue, setExpirationValue] = useState(initialValues?.expiration ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openPath, setOpenPath] = useState(false);
  const [openRuleId, setOpenRuleId] = useState(false);

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!pathValue.trim()) {
      next.path = 'Path is required';
    }
    if (!reasonValue.trim()) {
      next.reason = 'Reason is required';
    }
    if (expirationValue) {
      const expDate = new Date(expirationValue);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expDate <= today) {
        next.expiration = 'Expiration must be a future date';
      }
    }
    if (lineStartValue && lineEndValue) {
      if (Number(lineEndValue) < Number(lineStartValue)) {
        next.lineEnd = 'End line must be >= start line';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const suppression: AshSuppression = {
      path: pathValue.trim(),
      reason: reasonValue.trim(),
      rule_id: ruleIdValue.trim() || null,
      line_start: lineStartValue ? Number(lineStartValue) : null,
      line_end: lineEndValue ? Number(lineEndValue) : null,
      expiration: expirationValue || null,
    };
    onSave(suppression);
  };

  const filteredPaths = knownPaths?.filter((p) =>
    p.toLowerCase().includes(pathValue.toLowerCase()),
  );

  const filteredRuleIds = knownRuleIds?.filter((r) =>
    r.toLowerCase().includes(ruleIdValue.toLowerCase()),
  );

  const showPathAutocomplete = knownPaths && knownPaths.length > 0;
  const showRuleIdAutocomplete = knownRuleIds && knownRuleIds.length > 0;

  return (
    <div className="space-y-4">
      {/* Path */}
      <div className="space-y-2">
        <Label htmlFor="suppression-path" className="text-xs font-medium">
          Path <span className="text-red-500">*</span>
        </Label>
        {showPathAutocomplete ? (
          <Popover open={openPath} onOpenChange={setOpenPath}>
            <PopoverTrigger asChild>
              <Input
                id="suppression-path"
                value={pathValue}
                onChange={(e) => {
                  setPathValue(e.target.value);
                  if (!openPath) setOpenPath(true);
                }}
                onFocus={() => setOpenPath(true)}
                placeholder="e.g. src/main.ts or **/*.py"
                className="text-sm"
                disabled={isPending}
                autoComplete="off"
              />
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Filter paths..."
                  value={pathValue}
                  onValueChange={(v) => setPathValue(v)}
                />
                <CommandList>
                  <CommandEmpty>No matching paths.</CommandEmpty>
                  <CommandGroup>
                    {filteredPaths?.map((p) => (
                      <CommandItem
                        key={p}
                        value={p}
                        onSelect={(v) => {
                          setPathValue(v);
                          setOpenPath(false);
                        }}
                      >
                        {p}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Input
            id="suppression-path"
            value={pathValue}
            onChange={(e) => setPathValue(e.target.value)}
            placeholder="e.g. src/main.ts or **/*.py"
            className="text-sm"
            disabled={isPending}
          />
        )}
        {errors.path && <p className="text-xs text-red-500">{errors.path}</p>}
      </div>

      {/* Rule ID */}
      <div className="space-y-2">
        <Label htmlFor="suppression-rule-id" className="text-xs font-medium">
          Rule ID <span className="text-xs opacity-50">(optional)</span>
        </Label>
        {showRuleIdAutocomplete ? (
          <Popover open={openRuleId} onOpenChange={setOpenRuleId}>
            <PopoverTrigger asChild>
              <Input
                id="suppression-rule-id"
                value={ruleIdValue}
                onChange={(e) => {
                  setRuleIdValue(e.target.value);
                  if (!openRuleId) setOpenRuleId(true);
                }}
                onFocus={() => setOpenRuleId(true)}
                placeholder="e.g. B101 or CKV_AWS_18"
                className="text-sm"
                disabled={isPending}
                autoComplete="off"
              />
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Filter rule IDs..."
                  value={ruleIdValue}
                  onValueChange={(v) => setRuleIdValue(v)}
                />
                <CommandList>
                  <CommandEmpty>No matching rule IDs.</CommandEmpty>
                  <CommandGroup>
                    {filteredRuleIds?.map((r) => (
                      <CommandItem
                        key={r}
                        value={r}
                        onSelect={(v) => {
                          setRuleIdValue(v);
                          setOpenRuleId(false);
                        }}
                      >
                        {r}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Input
            id="suppression-rule-id"
            value={ruleIdValue}
            onChange={(e) => setRuleIdValue(e.target.value)}
            placeholder="e.g. B101 or CKV_AWS_18"
            className="text-sm"
            disabled={isPending}
          />
        )}
        {errors.ruleId && <p className="text-xs text-red-500">{errors.ruleId}</p>}
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="suppression-reason" className="text-xs font-medium">
          Reason <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="suppression-reason"
          value={reasonValue}
          onChange={(e) => setReasonValue(e.target.value)}
          placeholder="Why should this finding be suppressed?"
          className="text-sm min-h-[60px]"
          disabled={isPending}
        />
        {errors.reason && <p className="text-xs text-red-500">{errors.reason}</p>}
      </div>

      {/* Line Start / Line End */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="suppression-line-start" className="text-xs font-medium">
            Line Start <span className="text-xs opacity-50">(optional)</span>
          </Label>
          <Input
            id="suppression-line-start"
            type="number"
            value={lineStartValue}
            onChange={(e) => setLineStartValue(e.target.value)}
            placeholder="e.g. 10"
            className="text-sm"
            disabled={isPending}
            min={1}
          />
          {errors.lineStart && <p className="text-xs text-red-500">{errors.lineStart}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="suppression-line-end" className="text-xs font-medium">
            Line End <span className="text-xs opacity-50">(optional)</span>
          </Label>
          <Input
            id="suppression-line-end"
            type="number"
            value={lineEndValue}
            onChange={(e) => setLineEndValue(e.target.value)}
            placeholder="e.g. 20"
            className="text-sm"
            disabled={isPending}
            min={1}
          />
          {errors.lineEnd && <p className="text-xs text-red-500">{errors.lineEnd}</p>}
        </div>
      </div>

      {/* Expiration */}
      <div className="space-y-2">
        <Label htmlFor="suppression-expiration" className="text-xs font-medium">
          Expiration <span className="text-xs opacity-50">(optional)</span>
        </Label>
        <Input
          id="suppression-expiration"
          type="date"
          value={expirationValue}
          onChange={(e) => setExpirationValue(e.target.value)}
          className="text-sm w-48"
          disabled={isPending}
        />
        {errors.expiration && <p className="text-xs text-red-500">{errors.expiration}</p>}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
