import type { ScanSummary, ScanTarget, FindingRow, DispositionSummary, Disposition, FilterState, ApplicationInfo, SuppressionSummary, AshYamlConfigSummary, SuppressionInput, SuppressionResult, SuppressionEntry, AshIgnorePath, AshSuppression, SuppressionWriteResult } from './types';

// Extension Host -> WebView
export type ExtToWebviewMessage =
  | { type: 'init'; payload: { context: 'sidebar' } }
  | { type: 'init'; payload: { context: 'editorPanel'; scanId: string } }
  | { type: 'init'; payload: { context: 'sink' } }
  | { type: 'stateUpdate'; payload: { scans: ScanSummary[]; summary: DispositionSummary; scanTargets: ScanTarget[]; scanRoot: string } }
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
  | { type: 'suppressionWriteResult'; payload: SuppressionWriteResult };

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
  | { type: 'addSuppression'; payload: { suppression: AshSuppression } };
