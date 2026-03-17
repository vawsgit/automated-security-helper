import type { ScanSummary, ScanTarget, FindingRow, DispositionSummary, Disposition, FilterState } from './types';

// Extension Host -> WebView
export type ExtToWebviewMessage =
  | { type: 'init'; payload: { context: 'sidebar' } }
  | { type: 'init'; payload: { context: 'editorPanel'; scanId: string } }
  | { type: 'init'; payload: { context: 'sink' } }
  | { type: 'stateUpdate'; payload: { scans: ScanSummary[]; summary: DispositionSummary; scanTargets: ScanTarget[] } }
  | { type: 'findingsUpdate'; payload: { scanId: string; findings: FindingRow[] } }
  | { type: 'findingDetail'; payload: FindingRow }
  | { type: 'dispositionUpdated'; payload: { findingId: string; disposition: Disposition } }
  | { type: 'notesUpdated'; payload: { findingId: string; notes: string } }
  | { type: 'scanStarted'; payload: { scanId: string; targetPath: string } }
  | { type: 'scanProgress'; payload: { scanId: string; elapsed: number; status: string } };

// WebView -> Extension Host
export type WebviewToExtMessage =
  | { type: 'requestState' }
  | { type: 'selectScan'; payload: { scanId: string } }
  | { type: 'selectFinding'; payload: { findingId: string } }
  | { type: 'setDisposition'; payload: { findingId: string; disposition: Disposition } }
  | { type: 'setNotes'; payload: { findingId: string; notes: string } }
  | { type: 'navigateToCode'; payload: { filePath: string; startLine: number } }
  | { type: 'startScan'; payload: { targetPath: string } }
  | { type: 'cancelScan'; payload: { scanId: string } }
  | { type: 'openFindings'; payload: { scanId: string } }
  | { type: 'openSink' }
  | { type: 'applyFilters'; payload: { scanId: string; filters: FilterState } }
  | { type: 'deleteScan'; payload: { scanId: string } };
