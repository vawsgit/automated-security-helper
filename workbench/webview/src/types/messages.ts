import type { ScanSummary, ScanTarget, FindingRow, DispositionSummary, Disposition, FilterState, ApplicationInfo, SuppressionSummary, AshYamlConfigSummary, SuppressionInput, SuppressionResult, SuppressionEntry, AshIgnorePath, AshSuppression, SuppressionWriteResult, AiAnalysis, AnalysisMetadata, SuppressionScope, SuppressionMessageResult, TriageClassification, TriageMetadata, TriageSummary } from './types';

// Extension Host -> WebView
export type ExtToWebviewMessage =
  | { type: 'init'; payload: { context: 'sidebar' } }
  | { type: 'init'; payload: { context: 'editorPanel'; scanId: string } }
  | { type: 'init'; payload: { context: 'sink' } }
  | { type: 'stateUpdate'; payload: { scans: ScanSummary[]; summary: DispositionSummary; scanTargets: ScanTarget[]; scanRoot: string; claudeSettingsDetected: boolean; detectedProvider: 'bedrock' | 'anthropic-api' | 'none' } }
  | { type: 'findingsUpdate'; payload: { scanId: string; findings: FindingRow[] } }
  | { type: 'findingDetail'; payload: FindingRow }
  | { type: 'dispositionUpdated'; payload: { findingId: string; disposition: Disposition } }
  | { type: 'notesUpdated'; payload: { findingId: string; notes: string } }
  | { type: 'scanStarted'; payload: { scanId: string; targetPath: string } }
  | { type: 'scanProgress'; payload: { scanId: string; elapsed: number; status: string } }
  | { type: 'applicationInfo'; payload: ApplicationInfo }
  | { type: 'applicationReset' }
  | { type: 'currentFindingsUpdate'; payload: { findings: FindingRow[]; suppressionSummary: SuppressionSummary; scanId: string; lastScannedAt: string } }
  | { type: 'ashYamlChanged'; payload: { config: AshYamlConfigSummary } }
  | { type: 'suppressionResult'; payload: SuppressionResult }
  | { type: 'suppressionsUpdate'; payload: { suppressions: SuppressionEntry[]; ignorePaths: AshIgnorePath[]; configInfo: AshYamlConfigSummary } }
  | { type: 'suppressionWriteResult'; payload: SuppressionWriteResult }
  // AI Analysis (Spec 018)
  | { type: 'aiAnalysisStarted'; payload: { findingId: string; model: string } }
  | { type: 'aiAnalysisProgress'; payload: { findingId: string; message: string; toolName?: string } }
  | { type: 'aiAnalysisResult'; payload: { findingId: string; analysis: AiAnalysis; metadata: AnalysisMetadata } }
  | { type: 'aiAnalysisError'; payload: { findingId: string; errorType: string; message: string } }
  | { type: 'aiTestResult'; payload: { success: boolean; model?: string; latencyMs: number; error?: { type: string; message: string } } }
  // Batch Analysis (Spec 023)
  | { type: 'batchAnalysisStarted'; payload: { scanId: string; totalFindings: number; findingIds: string[] } }
  | { type: 'batchAnalysisProgress'; payload: { scanId: string; currentIndex: number; totalFindings: number; currentFindingId: string } }
  | { type: 'batchAnalysisComplete'; payload: { scanId: string; analyzedCount: number; failedCount: number; skippedCount: number; status: 'completed' | 'cancelled' | 'consecutive-failures' | 'error' } }
  // Suppression Message Generation (Spec 025)
  | { type: 'suppressionMessageResult'; payload: SuppressionMessageResult }
  | { type: 'suppressionMessageError'; payload: { findingId: string; errorType: string; message: string } }
  // Repairability Triage (Spec 026)
  | { type: 'triageSummaryUpdate'; payload: { summary: TriageSummary } }
  | { type: 'triageClassificationStarted'; payload: { totalFindings: number; findingIds: string[] } }
  | { type: 'triageClassificationProgress'; payload: { currentIndex: number; totalFindings: number; currentFindingId: string; status: 'classifying' | 'skipped' | 'failed'; message?: string } }
  | { type: 'triageClassificationResult'; payload: { findingId: string; analysis: TriageClassification; metadata: TriageMetadata } }
  | { type: 'triageClassificationError'; payload: { findingId: string; errorType: string; message: string } }
  | { type: 'triageClassificationComplete'; payload: { analyzedCount: number; failedCount: number; skippedCount: number; status: 'completed' | 'cancelled' | 'consecutive-failures' | 'error' } }
  | { type: 'triageFixApplied'; payload: { findingId: string; filePath: string; disposition: 'FIX' } }
  | { type: 'triageFixError'; payload: { findingId: string; errorType: 'stale_code' | 'file_not_found' | 'write_error' | 'path_validation'; message: string } }
  | { type: 'triageSuppressed'; payload: { findingId: string; disposition: 'SUPPRESS' } }
  | { type: 'triageSuppressionError'; payload: { findingId: string; errorType: string; message: string } };

// WebView -> Extension Host
export type WebviewToExtMessage =
  | { type: 'requestState' }
  | { type: 'selectScan'; payload: { scanId: string } }
  | { type: 'selectScanTarget'; payload: { scanTargetId: string } }
  | { type: 'selectFinding'; payload: { findingId: string } }
  | { type: 'setDisposition'; payload: { findingId: string; disposition: Disposition } }
  | { type: 'setNotes'; payload: { findingId: string; notes: string } }
  | { type: 'navigateToCode'; payload: { filePath: string; startLine: number } }
  | { type: 'startScan' }
  | { type: 'cancelScan'; payload: { scanId: string } }
  | { type: 'openFindings'; payload: { scanId: string } }
  | { type: 'openSink' }
  | { type: 'applyFilters'; payload: { scanId: string; filters: FilterState } }
  | { type: 'deleteScan'; payload: { scanId: string } }
  | { type: 'openDashboard' }
  | { type: 'openSettings' }
  | { type: 'requestApplicationInfo' }
  | { type: 'resetApplication' }
  | { type: 'requestCurrentFindings' }
  | { type: 'suppressFinding'; payload: SuppressionInput }
  | { type: 'unsuppressFinding'; payload: { findingId: string } }
  | { type: 'requestSuppressions' }
  | { type: 'editSuppression'; payload: { old: AshSuppression; updated: AshSuppression } }
  | { type: 'removeSuppression'; payload: { suppression: AshSuppression } }
  | { type: 'addSuppression'; payload: { suppression: AshSuppression } }
  // AI Analysis (Spec 018)
  | { type: 'testAiConnection' }
  | { type: 'analyzeFinding'; payload: { findingId: string } }
  | { type: 'cancelAiAnalysis'; payload: { findingId: string } }
  // Batch Analysis (Spec 023)
  | { type: 'analyzeAllFindings'; payload: { scanId: string } }
  | { type: 'cancelBatchAnalysis'; payload: { scanId: string } }
  // Suppression Message Generation (Spec 025)
  | { type: 'generateSuppressionMessage'; payload: { findingId: string; scope: SuppressionScope; mode: 'generate' | 'regenerate' } }
  | { type: 'refineSuppressionMessage'; payload: { findingId: string; scope: SuppressionScope; existingMessage: string } }
  // Repairability Triage (Spec 026)
  | { type: 'requestTriageSummary' }
  | { type: 'startTriageClassification' }
  | { type: 'retryTriageClassification'; payload: { findingId: string } }
  | { type: 'cancelTriageClassification' }
  | { type: 'applyTriageFix'; payload: { findingId: string } }
  | { type: 'applyTriageSuppression'; payload: { findingId: string } }
  | { type: 'requestRepairGuidance'; payload: { findingId: string } }
  | { type: 'openTriageDashboard' };
