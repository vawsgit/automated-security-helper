import { Button } from '@/components/ui/button';
import { AppBreadcrumb } from './AppBreadcrumb';
import { SeverityBadge } from './SeverityBadge';
import { TriageFindingPanel } from './TriageFindingPanel';
import { repairabilityColor } from '@/lib/theme-colors';
import { postMessage } from '../hooks/useVSCodeAPI';
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import type { FindingRow, TriageCategory, Severity } from '../types/types';

interface TriageDrillDownViewProps {
  severity: Severity;
  category: TriageCategory;
  findings: FindingRow[];
  selectedFindingId: string | null;
  actionErrors: Record<string, string>;
  actionSuccess: Record<string, string>;
  onSelectFinding: (findingId: string) => void;
  onBack: () => void;
  onNavigateDashboard: () => void;
  onNavigateTriageDashboard: () => void;
}

const categoryLabels: Record<TriageCategory, string> = {
  suppress: 'Suppress',
  easy_fix: 'Easy Fix',
  systemic: 'Systemic',
};

export function TriageDrillDownView({
  severity, category, findings, selectedFindingId, actionErrors, actionSuccess,
  onSelectFinding, onBack, onNavigateDashboard, onNavigateTriageDashboard,
}: TriageDrillDownViewProps) {
  const filtered = findings.filter(f => {
    if (f.severity !== severity) return false;
    if (!f.triageAnalysis) return false;
    return f.triageAnalysis.category === category;
  });

  const selectedFinding = selectedFindingId
    ? filtered.find(f => f.id === selectedFindingId) ?? null
    : null;

  const handleApplyFix = (findingId: string) => {
    postMessage({ type: 'applyTriageFix', payload: { findingId } });
  };

  const handleApplySuppression = (findingId: string) => {
    postMessage({ type: 'applyTriageSuppression', payload: { findingId } });
  };

  const handleCopyGuidance = (finding: FindingRow) => {
    if (!finding.triageAnalysis || finding.triageAnalysis.category !== 'systemic') return;
    const guidance = finding.triageAnalysis.repairGuidance;
    const text = [
      `# Repair Guidance: ${finding.title}`,
      `\n## Finding`,
      `- **Rule**: ${finding.ruleId}`,
      `- **File**: ${finding.filePath}:${finding.startLine}`,
      `- **Severity**: ${finding.severity}`,
      `- **Description**: ${finding.description}`,
      `\n## Explanation`,
      finding.triageAnalysis.explanation,
      `\n## Risk`,
      finding.triageAnalysis.risk,
      `\n## Why It's Hard to Fix`,
      finding.triageAnalysis.complexityRationale,
      `\n## Affected Areas`,
      ...guidance.affectedAreas.map(a => `- ${a}`),
      `\n## Vulnerability Nature`,
      guidance.vulnerabilityNature,
      `\n## Remediation Approach`,
      guidance.remediationApproach,
      `\n## Potential Side Effects`,
      ...guidance.sideEffects.map(e => `- ${e}`),
      `\n## Testing Recommendations`,
      guidance.testingRecommendations,
    ].join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <AppBreadcrumb segments={[
          { label: 'Dashboard', onClick: onNavigateDashboard },
          { label: 'Triage', onClick: onNavigateTriageDashboard },
          { label: `${severity} / ${categoryLabels[category]}` },
        ]} />
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <SeverityBadge severity={severity} />
        <span className={`text-xs px-2 py-0.5 rounded ${repairabilityColor[category].base}`}>
          {categoryLabels[category]}
        </span>
        <span className="text-xs text-muted-foreground">{filtered.length} finding{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 opacity-60">
          <p className="text-sm">No findings in this category.</p>
        </div>
      )}

      {/* Finding List + Detail Split */}
      <div className="flex gap-4">
        {/* Left: finding list */}
        <div className="w-1/3 space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto">
          {filtered.map(f => {
            const isSelected = f.id === selectedFindingId;
            const isAddressed = f.disposition !== 'PENDING';
            const hasSuccess = !!actionSuccess[f.id];
            const hasError = !!actionErrors[f.id];
            return (
              <button
                key={f.id}
                className={`w-full text-left p-2 rounded text-xs transition-colors ${
                  isSelected ? 'bg-accent' : 'hover:bg-muted/50'
                } ${isAddressed || hasSuccess ? 'opacity-60' : ''}`}
                onClick={() => onSelectFinding(f.id)}
              >
                <div className="flex items-center gap-1.5">
                  {(isAddressed || hasSuccess) && <Check className="w-3 h-3 text-green-600 shrink-0" />}
                  {hasError && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                  <span className="truncate font-medium">{f.title}</span>
                </div>
                <div className="text-muted-foreground truncate mt-0.5">{f.filePath}:{f.startLine}</div>
                {hasSuccess && <div className="text-green-600 mt-0.5">{actionSuccess[f.id]}</div>}
                {hasError && <div className="text-red-500 mt-0.5">{actionErrors[f.id]}</div>}
              </button>
            );
          })}
        </div>

        {/* Right: selected finding detail */}
        <div className="flex-1 min-h-[200px]">
          {selectedFinding ? (
            <TriageFindingPanel
              finding={selectedFinding}
              category={category}
              actionError={actionErrors[selectedFinding.id] ?? null}
              actionSuccess={actionSuccess[selectedFinding.id] ?? null}
              onApplyFix={handleApplyFix}
              onApplySuppression={handleApplySuppression}
              onCopyGuidance={handleCopyGuidance}
            />
          ) : (
            <div className="flex items-center justify-center h-full opacity-50">
              <p className="text-xs">Select a finding to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
