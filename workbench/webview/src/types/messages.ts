import type { ScanSummary, FindingRow, DispositionSummary, Disposition } from './types';

// Extension Host -> WebView
export type ExtToWebviewMessage =
  | { type: 'init'; payload: { context: 'sidebar' } }
  | { type: 'init'; payload: { context: 'editorPanel'; scanId: string } }
  | { type: 'stateUpdate'; payload: { scans: ScanSummary[]; summary: DispositionSummary } }
  | { type: 'findingsUpdate'; payload: { scanId: string; findings: FindingRow[] } }
  | { type: 'findingDetail'; payload: FindingRow }
  | { type: 'dispositionUpdated'; payload: { findingId: string; disposition: Disposition } };

// WebView -> Extension Host
export type WebviewToExtMessage =
  | { type: 'requestState' }
  | { type: 'selectScan'; payload: { scanId: string } }
  | { type: 'selectFinding'; payload: { findingId: string } }
  | { type: 'setDisposition'; payload: { findingId: string; disposition: Disposition } }
  | { type: 'navigateToCode'; payload: { filePath: string; startLine: number } }
  | { type: 'startScan' }
  | { type: 'openFindings'; payload: { scanId: string } };
