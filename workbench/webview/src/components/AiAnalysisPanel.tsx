import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from './CodeBlock';
import type { AiAnalysis, RiskLevel } from '../types/types';

interface AiAnalysisPanelProps {
  analysis: AiAnalysis | null;
}

const riskColors: Record<RiskLevel, string> = {
  CRITICAL: 'bg-red-700 text-white',
  HIGH: 'bg-orange-700 text-white',
  MEDIUM: 'bg-yellow-600 text-white',
  LOW: 'bg-blue-600 text-white',
  NONE: 'bg-gray-400 text-white',
};

function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge className={`${riskColors[level]} text-xs`}>{level}</Badge>;
}

export function AiAnalysisPanel({ analysis }: AiAnalysisPanelProps) {
  if (!analysis) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">AI Analysis</h3>
      <Accordion type="multiple" className="w-full">
        {/* Explanation */}
        <AccordionItem value="explanation">
          <AccordionTrigger className="text-sm">Explanation</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm leading-relaxed">{analysis.explanation}</p>
          </AccordionContent>
        </AccordionItem>

        {/* Risk Assessment */}
        <AccordionItem value="risk">
          <AccordionTrigger className="text-sm">Risk Assessment</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <RiskBadge level={analysis.riskAssessment.exploitability} />
                <div>
                  <p className="text-xs font-semibold">Exploitability</p>
                  <p className="text-xs opacity-70">{analysis.riskAssessment.exploitabilityRationale}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RiskBadge level={analysis.riskAssessment.impact} />
                <div>
                  <p className="text-xs font-semibold">Impact</p>
                  <p className="text-xs opacity-70">{analysis.riskAssessment.impactRationale}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RiskBadge level={analysis.riskAssessment.likelihood} />
                <div>
                  <p className="text-xs font-semibold">Likelihood</p>
                  <p className="text-xs opacity-70">{analysis.riskAssessment.likelihoodRationale}</p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Suggested Fix */}
        {analysis.suggestedFix && (
          <AccordionItem value="fix">
            <AccordionTrigger className="text-sm">Suggested Fix</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm mb-2">{analysis.suggestedFix.description}</p>
              <CodeBlock code={analysis.suggestedFix.diffText} startLine={1} />
            </AccordionContent>
          </AccordionItem>
        )}

        {/* References */}
        {analysis.references.length > 0 && (
          <AccordionItem value="refs">
            <AccordionTrigger className="text-sm">References</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {analysis.references.map((ref, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={ref.url}
                      className="underline"
                      style={{ color: 'var(--vscode-textLink-foreground)' }}
                    >
                      {ref.title}
                    </a>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
