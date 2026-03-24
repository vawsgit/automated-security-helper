import { Button } from '@/components/ui/button';
import { repairabilityColor } from '@/lib/theme-colors';
import { Shield, Wrench, Copy, Check, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import type { FindingRow, TriageCategory } from '../types/types';

interface TriageFindingPanelProps {
  finding: FindingRow;
  category: TriageCategory;
  actionError: string | null;
  actionSuccess: string | null;
  onApplyFix: (findingId: string) => void;
  onApplySuppression: (findingId: string) => void;
  onCopyGuidance: (finding: FindingRow) => void;
}

export function TriageFindingPanel({
  finding, category, actionError, actionSuccess,
  onApplyFix, onApplySuppression, onCopyGuidance,
}: TriageFindingPanelProps) {
  const [copied, setCopied] = useState(false);
  const triage = finding.triageAnalysis;
  if (!triage) return null;

  const isAddressed = finding.disposition !== 'PENDING';

  const handleCopy = () => {
    onCopyGuidance(finding);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border p-4 space-y-4 text-sm">
      {/* Title */}
      <div>
        <h3 className="font-medium">{finding.title}</h3>
        <div className="text-xs text-muted-foreground mt-0.5">
          {finding.filePath}:{finding.startLine} &middot; {finding.ruleId} &middot; {finding.scanner}
        </div>
      </div>

      {/* Explanation & Risk */}
      <div className="space-y-2">
        <div>
          <div className="text-xs font-medium opacity-70 mb-0.5">Explanation</div>
          <p className="text-xs">{triage.explanation}</p>
        </div>
        <div>
          <div className="text-xs font-medium opacity-70 mb-0.5">Risk</div>
          <p className="text-xs">{triage.risk}</p>
        </div>
      </div>

      {/* Category-specific content */}
      {category === 'suppress' && triage.category === 'suppress' && (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium opacity-70 mb-0.5">Suppression Rationale</div>
            <p className="text-xs">{triage.suppressionRationale}</p>
          </div>
          <div>
            <div className="text-xs font-medium opacity-70 mb-0.5">Suggested Scope</div>
            <span className={`text-xs px-2 py-0.5 rounded ${repairabilityColor.suppress.base}`}>
              {triage.suggestedScope.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <div className="text-xs font-medium opacity-70 mb-0.5">Justification</div>
            <p className="text-xs italic">{triage.suggestedJustification}</p>
          </div>

          {/* Action */}
          {!isAddressed && !actionSuccess && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApplySuppression(finding.id)}
              className="w-full"
            >
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              Suppress Finding
            </Button>
          )}
        </div>
      )}

      {category === 'easy_fix' && triage.category === 'easy_fix' && (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium opacity-70 mb-0.5">Fix Description</div>
            <p className="text-xs">{triage.fixDescription}</p>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium opacity-70">Code Change</div>
            <div className="rounded bg-red-500/10 dark:bg-red-900/20 p-2 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
              <span className="opacity-50">- </span>{triage.codeBefore}
            </div>
            <div className="rounded bg-green-500/10 dark:bg-green-900/20 p-2 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
              <span className="opacity-50">+ </span>{triage.codeAfter}
            </div>
            <div className="text-xs text-muted-foreground">
              {triage.filePath}:{triage.startLine}–{triage.endLine}
            </div>
          </div>

          {/* Action */}
          {!isAddressed && !actionSuccess && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApplyFix(finding.id)}
              className="w-full"
            >
              <Wrench className="w-3.5 h-3.5 mr-1.5" />
              Apply Fix
            </Button>
          )}
        </div>
      )}

      {category === 'systemic' && triage.category === 'systemic' && (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium opacity-70 mb-0.5">Why It's Hard to Fix</div>
            <p className="text-xs">{triage.complexityRationale}</p>
          </div>
          <div>
            <div className="text-xs font-medium opacity-70 mb-1">Affected Areas</div>
            <ul className="text-xs space-y-0.5">
              {triage.repairGuidance.affectedAreas.map((area, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="opacity-50 mt-0.5">&bull;</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-medium opacity-70 mb-0.5">Remediation Approach</div>
            <p className="text-xs">{triage.repairGuidance.remediationApproach}</p>
          </div>
          {triage.repairGuidance.sideEffects.length > 0 && (
            <div>
              <div className="text-xs font-medium opacity-70 mb-1">Potential Side Effects</div>
              <ul className="text-xs space-y-0.5">
                {triage.repairGuidance.sideEffects.map((effect, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <span>{effect}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="text-xs font-medium opacity-70 mb-0.5">Testing Recommendations</div>
            <p className="text-xs">{triage.repairGuidance.testingRecommendations}</p>
          </div>

          {/* Copy to clipboard action */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="w-full"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Copied to Clipboard
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy Repair Guidance
              </>
            )}
          </Button>
        </div>
      )}

      {/* Status feedback */}
      {actionSuccess && (
        <div className="rounded bg-green-500/10 border border-green-500/20 p-2 text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="rounded bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          {actionError}
        </div>
      )}
    </div>
  );
}
