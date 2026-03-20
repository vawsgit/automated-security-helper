import { useReducer, useCallback, useEffect, useMemo } from 'react';
import { postMessage, useMessages } from './hooks/useVSCodeAPI';
import { SidebarDashboard } from './components/SidebarDashboard';
import { DashboardView } from './components/DashboardView';
import { FindingsView } from './components/FindingsView';
import { FindingDetailView } from './components/FindingDetailView';
import { ScanHistoryView } from './components/ScanHistoryView';
import { ScanDetailView } from './components/ScanDetailView';
import { ScanProgressView } from './components/ScanProgressView';
import { EmptyStateView } from './components/EmptyStateView';
import { SuppressionManagerView } from './components/SuppressionManagerView';
import SinkPage from './pages/sink/SinkPage';
import type { ExtToWebviewMessage } from './types/messages';
import type { Project, ScanTarget, ScanSummary, FindingRow, DispositionSummary, Disposition, SuppressionSummary, AshYamlConfigSummary, SuppressionEntry, AshIgnorePath } from './types/types';

type ViewState =
  | 'loading' | 'dashboard' | 'findingList' | 'findingDetail'
  | 'scanHistory' | 'scanDetail' | 'scanProgress' | 'empty'
  | 'suppressionManager';

interface AppState {
  context: 'sidebar' | 'editorPanel' | 'sink' | 'unknown';
  view: ViewState;
  viewHistory: ViewState[];
  project: Project;
  scanId: string | undefined;
  scans: ScanSummary[];
  summary: DispositionSummary;
  findings: FindingRow[];
  selectedFinding: FindingRow | undefined;
  targetPath: string | undefined;
  scanElapsed: number;
  scanStatus: string;
  scanTargets: ScanTarget[];
  selectedScanTargetId: string | undefined;
  currentFindings: FindingRow[];
  suppressionSummary: SuppressionSummary;
  showSuppressed: boolean;
  lastScannedAt: string | undefined;
  ashYamlConfig: AshYamlConfigSummary | undefined;
  suppressionFormFindingId: string | null;
  suppressionPending: boolean;
  suppressions: SuppressionEntry[];
  ignorePaths: AshIgnorePath[];
  suppressionManagerConfig: AshYamlConfigSummary | null;
  editingSuppressionIndex: number | null;
  addingNewSuppression: boolean;
}

type AppAction =
  | { type: 'MESSAGE'; payload: ExtToWebviewMessage }
  | { type: 'NAVIGATE'; view: ViewState }
  | { type: 'SELECT_FINDING'; findingId: string }
  | { type: 'SELECT_SCAN'; scanId: string }
  | { type: 'VIEW_SCAN_DETAIL'; scanId: string }
  | { type: 'SET_DISPOSITION'; findingId: string; disposition: Disposition }
  | { type: 'SET_NOTES'; findingId: string; notes: string }
  | { type: 'START_SCAN'; targetPath: string }
  | { type: 'SELECT_SCAN_TARGET'; scanTargetId: string }
  | { type: 'CLEAR_SCAN_TARGET' }
  | { type: 'TOGGLE_SHOW_SUPPRESSED' }
  | { type: 'OPEN_SUPPRESSION_FORM'; findingId: string }
  | { type: 'CLOSE_SUPPRESSION_FORM' }
  | { type: 'SET_SUPPRESSION_PENDING'; pending: boolean }
  | { type: 'OPEN_SUPPRESSION_EDIT'; index: number }
  | { type: 'CLOSE_SUPPRESSION_EDIT' }
  | { type: 'START_ADD_SUPPRESSION' }
  | { type: 'CANCEL_ADD_SUPPRESSION' }
  | { type: 'BACK' }
  | { type: 'BACK_TO_LIST' };

function recomputeSummary(findings: FindingRow[]): DispositionSummary {
  const counts: Record<Disposition, number> = { PENDING: 0, FIX: 0, SUPPRESS: 0, DEFER: 0 };
  for (const f of findings) {
    counts[f.disposition]++;
  }
  return { total: findings.length, counts };
}

const initialState: AppState = {
  context: 'unknown',
  view: 'loading',
  viewHistory: [],
  project: { id: '', name: '', rootPath: '' },
  scanId: undefined,
  scans: [],
  summary: { total: 0, counts: { PENDING: 0, FIX: 0, SUPPRESS: 0, DEFER: 0 } },
  findings: [],
  selectedFinding: undefined,
  targetPath: undefined,
  scanElapsed: 0,
  scanStatus: '',
  scanTargets: [],
  selectedScanTargetId: undefined,
  currentFindings: [],
  suppressionSummary: { total: 0, suppressed: 0, active: 0 },
  showSuppressed: false,
  lastScannedAt: undefined,
  ashYamlConfig: undefined,
  suppressionFormFindingId: null,
  suppressionPending: false,
  suppressions: [],
  ignorePaths: [],
  suppressionManagerConfig: null,
  editingSuppressionIndex: null,
  addingNewSuppression: false,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'MESSAGE': {
      const msg = action.payload;
      switch (msg.type) {
        case 'init':
          if (msg.payload.context === 'sidebar') {
            return { ...state, context: 'sidebar' };
          }
          if (msg.payload.context === 'sink') {
            return { ...state, context: 'sink' };
          }
          return { ...state, context: 'editorPanel', scanId: msg.payload.scanId, view: 'dashboard' };
        case 'stateUpdate':
          return {
            ...state,
            scans: msg.payload.scans,
            summary: msg.payload.summary,
            scanTargets: msg.payload.scanTargets,
            view: state.view === 'loading' ? 'dashboard' : state.view,
          };
        case 'findingsUpdate':
          return { ...state, findings: msg.payload.findings, view: 'findingList' };
        case 'findingDetail':
          return { ...state, selectedFinding: msg.payload, view: 'findingDetail' };
        case 'dispositionUpdated': {
          const findings = state.findings.map(f =>
            f.id === msg.payload.findingId ? { ...f, disposition: msg.payload.disposition } : f
          );
          const selectedFinding = state.selectedFinding?.id === msg.payload.findingId
            ? { ...state.selectedFinding, disposition: msg.payload.disposition }
            : state.selectedFinding;
          return {
            ...state, findings, selectedFinding,
            summary: recomputeSummary(findings),
          };
        }
        case 'scanStarted':
          return {
            ...state,
            viewHistory: [...state.viewHistory, state.view],
            scanId: msg.payload.scanId,
            targetPath: msg.payload.targetPath,
            view: 'scanProgress',
          };
        case 'scanProgress':
          return {
            ...state,
            scanId: msg.payload.scanId || state.scanId,
            scanElapsed: msg.payload.elapsed,
            scanStatus: msg.payload.status,
          };
        case 'currentFindingsUpdate':
          return {
            ...state,
            currentFindings: msg.payload.findings,
            suppressionSummary: msg.payload.suppressionSummary,
            scanId: msg.payload.scanId || state.scanId,
            lastScannedAt: msg.payload.lastScannedAt,
            view: state.view === 'loading' ? 'dashboard' : state.view,
          };
        case 'ashYamlChanged':
          // Reactive refresh: if viewing suppression manager, re-request data
          if (state.view === 'suppressionManager') {
            postMessage({ type: 'requestSuppressions' });
          }
          return { ...state, ashYamlConfig: msg.payload.config };
        case 'suppressionResult':
          if (msg.payload.success) {
            return { ...state, suppressionFormFindingId: null, suppressionPending: false };
          }
          return { ...state, suppressionPending: false };
        case 'suppressionsUpdate':
          return {
            ...state,
            suppressions: msg.payload.suppressions,
            ignorePaths: msg.payload.ignorePaths,
            suppressionManagerConfig: msg.payload.configInfo,
            view: state.view === 'loading' ? 'suppressionManager' : state.view,
          };
        case 'suppressionWriteResult':
          if (msg.payload.success) {
            return { ...state, editingSuppressionIndex: null, addingNewSuppression: false };
          }
          return state;
        default:
          return state;
      }
    }
    case 'NAVIGATE':
      return {
        ...state,
        viewHistory: [...state.viewHistory, state.view],
        view: action.view,
      };
    case 'SELECT_FINDING': {
      const finding = state.findings.find(f => f.id === action.findingId);
      if (finding) {
        return {
          ...state,
          viewHistory: [...state.viewHistory, state.view],
          selectedFinding: finding,
          view: 'findingDetail',
        };
      }
      return state;
    }
    case 'SELECT_SCAN':
      return {
        ...state,
        viewHistory: [...state.viewHistory, state.view],
        scanId: action.scanId,
        view: 'findingList',
      };
    case 'VIEW_SCAN_DETAIL':
      return {
        ...state,
        viewHistory: [...state.viewHistory, state.view],
        scanId: action.scanId,
        view: 'scanDetail',
      };
    case 'SET_DISPOSITION': {
      const findings = state.findings.map(f =>
        f.id === action.findingId ? { ...f, disposition: action.disposition } : f
      );
      const selectedFinding = state.selectedFinding?.id === action.findingId
        ? { ...state.selectedFinding, disposition: action.disposition }
        : state.selectedFinding;
      return {
        ...state, findings, selectedFinding,
        summary: recomputeSummary(findings),
      };
    }
    case 'SET_NOTES': {
      const findings = state.findings.map(f =>
        f.id === action.findingId ? { ...f, notes: action.notes } : f
      );
      const selectedFinding = state.selectedFinding?.id === action.findingId
        ? { ...state.selectedFinding, notes: action.notes }
        : state.selectedFinding;
      return { ...state, findings, selectedFinding };
    }
    case 'START_SCAN':
      return {
        ...state,
        viewHistory: [...state.viewHistory, state.view],
        targetPath: action.targetPath,
        view: 'scanProgress',
      };
    case 'SELECT_SCAN_TARGET':
      return {
        ...state,
        viewHistory: [...state.viewHistory, state.view],
        selectedScanTargetId: action.scanTargetId,
        view: 'findingList',
      };
    case 'CLEAR_SCAN_TARGET':
      return {
        ...state,
        selectedScanTargetId: undefined,
      };
    case 'TOGGLE_SHOW_SUPPRESSED':
      return { ...state, showSuppressed: !state.showSuppressed };
    case 'OPEN_SUPPRESSION_FORM':
      return { ...state, suppressionFormFindingId: action.findingId, suppressionPending: false };
    case 'CLOSE_SUPPRESSION_FORM':
      return { ...state, suppressionFormFindingId: null, suppressionPending: false };
    case 'SET_SUPPRESSION_PENDING':
      return { ...state, suppressionPending: action.pending };
    case 'OPEN_SUPPRESSION_EDIT':
      return { ...state, editingSuppressionIndex: action.index, addingNewSuppression: false };
    case 'CLOSE_SUPPRESSION_EDIT':
      return { ...state, editingSuppressionIndex: null };
    case 'START_ADD_SUPPRESSION':
      return { ...state, addingNewSuppression: true, editingSuppressionIndex: null };
    case 'CANCEL_ADD_SUPPRESSION':
      return { ...state, addingNewSuppression: false };
    case 'BACK': {
      const history = [...state.viewHistory];
      const prev = history.pop() ?? 'dashboard';
      return { ...state, viewHistory: history, view: prev };
    }
    case 'BACK_TO_LIST':
      return { ...state, selectedFinding: undefined, view: 'findingList', viewHistory: [] };
    default:
      return state;
  }
}

function EditorPanel({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<AppAction> }) {
  const navigate = (view: ViewState) => {
    dispatch({ type: 'NAVIGATE', view });
    if (view === 'suppressionManager') {
      postMessage({ type: 'requestSuppressions' });
    }
  };
  const navigateDashboard = () => {
    dispatch({ type: 'CLEAR_SCAN_TARGET' });
    dispatch({ type: 'NAVIGATE', view: 'dashboard' });
  };
  const navigateFindings = () => dispatch({ type: 'NAVIGATE', view: 'findingList' });
  const navigateScans = () => dispatch({ type: 'NAVIGATE', view: 'scanHistory' });

  // Compute autocomplete suggestions from current findings
  const knownPaths = useMemo(() =>
    [...new Set(state.currentFindings.map(f => f.filePath).filter(Boolean))],
    [state.currentFindings]
  );
  const knownRuleIds = useMemo(() =>
    [...new Set(state.currentFindings.map(f => f.ruleId).filter(Boolean))],
    [state.currentFindings]
  );

  const selectScanTarget = (scanTargetId: string) => {
    dispatch({ type: 'SELECT_SCAN_TARGET', scanTargetId });
    postMessage({ type: 'selectScanTarget', payload: { scanTargetId } });
  };

  const selectScan = (scanId: string) => {
    dispatch({ type: 'SELECT_SCAN', scanId });
    postMessage({ type: 'selectScan', payload: { scanId } });
  };

  // Derive filtered data based on selected scan target
  const selectedTarget = state.scanTargets.find(t => t.id === state.selectedScanTargetId);

  const activeFindings = useMemo(() =>
    state.selectedScanTargetId
      ? state.findings.filter(f => f.scanTargetId === state.selectedScanTargetId)
      : state.findings,
    [state.findings, state.selectedScanTargetId]
  );

  const activeScans = useMemo(() =>
    state.selectedScanTargetId
      ? state.scans.filter(s => s.scanTargetId === state.selectedScanTargetId)
      : state.scans,
    [state.scans, state.selectedScanTargetId]
  );

  const renderView = () => {
    switch (state.view) {
      case 'dashboard':
        return (
          <DashboardView
            project={state.project}
            scanTargets={state.scanTargets}
            scans={state.scans}
            findings={state.findings}
            summary={state.summary}
            currentFindings={state.currentFindings}
            suppressionSummary={state.suppressionSummary}
            lastScannedAt={state.lastScannedAt}
            onNavigate={navigate}
            onSelectScanTarget={selectScanTarget}
          />
        );
      case 'findingList': {
        // Filter suppressed findings unless showSuppressed is on
        const visibleFindings = state.showSuppressed
          ? activeFindings
          : activeFindings.filter(f => !f.isCurrentlySuppressed);
        return (
          <FindingsView
            findings={visibleFindings}
            selectedTarget={selectedTarget}
            showSuppressed={state.showSuppressed}
            onToggleSuppressed={() => dispatch({ type: 'TOGGLE_SHOW_SUPPRESSED' })}
            onSelectFinding={(findingId) => dispatch({ type: 'SELECT_FINDING', findingId })}
            onSetDisposition={(findingId, disposition) =>
              dispatch({ type: 'SET_DISPOSITION', findingId, disposition })
            }
            onNavigateDashboard={navigateDashboard}
            onClearTarget={() => dispatch({ type: 'CLEAR_SCAN_TARGET' })}
          />
        );
      }
      case 'findingDetail':
        if (!state.selectedFinding) {
          navigate('findingList');
          return null;
        }
        return (
          <FindingDetailView
            finding={state.selectedFinding}
            findings={activeFindings}
            onBack={() => dispatch({ type: 'BACK' })}
            onNavigateDashboard={navigateDashboard}
            onNavigateFindings={navigateFindings}
            onNavigate={(findingId) => dispatch({ type: 'SELECT_FINDING', findingId })}
            onSetDisposition={(findingId, disposition) =>
              dispatch({ type: 'SET_DISPOSITION', findingId, disposition })
            }
            onSetNotes={(findingId, notes) =>
              dispatch({ type: 'SET_NOTES', findingId, notes })
            }
            suppressionFormFindingId={state.suppressionFormFindingId}
            suppressionPending={state.suppressionPending}
            onOpenSuppressionForm={(findingId) =>
              dispatch({ type: 'OPEN_SUPPRESSION_FORM', findingId })
            }
            onCloseSuppressionForm={() =>
              dispatch({ type: 'CLOSE_SUPPRESSION_FORM' })
            }
            onSetSuppressionPending={(pending) =>
              dispatch({ type: 'SET_SUPPRESSION_PENDING', pending })
            }
          />
        );
      case 'scanHistory':
        return (
          <ScanHistoryView
            scans={activeScans}
            selectedTarget={selectedTarget}
            scanTargets={state.scanTargets}
            onSelectScan={(scanId) => dispatch({ type: 'VIEW_SCAN_DETAIL', scanId })}
            onNavigateDashboard={navigateDashboard}
            onNavigate={navigate}
            onSelectScanTarget={selectScanTarget}
            onClearTarget={() => dispatch({ type: 'CLEAR_SCAN_TARGET' })}
          />
        );
      case 'scanDetail': {
        const scan = state.scans.find(s => s.id === state.scanId);
        if (!scan) {
          navigate('scanHistory');
          return null;
        }
        return (
          <ScanDetailView
            scan={scan}
            findings={state.findings.filter(f => f.scanTargetId === scan.scanTargetId)}
            onNavigateDashboard={navigateDashboard}
            onNavigateScans={navigateScans}
            onViewFindings={() => selectScan(scan.id)}
          />
        );
      }
      case 'scanProgress':
        return (
          <ScanProgressView
            targetPath={state.targetPath}
            elapsed={state.scanElapsed}
            onNavigateDashboard={navigateDashboard}
            onNavigateScans={navigateScans}
          />
        );
      case 'suppressionManager':
        return (
          <SuppressionManagerView
            suppressions={state.suppressions}
            ignorePaths={state.ignorePaths}
            configInfo={state.suppressionManagerConfig}
            currentFindings={state.currentFindings}
            editingSuppressionIndex={state.editingSuppressionIndex}
            addingNewSuppression={state.addingNewSuppression}
            knownPaths={knownPaths}
            knownRuleIds={knownRuleIds}
            onEdit={(index) => dispatch({ type: 'OPEN_SUPPRESSION_EDIT', index })}
            onCloseEdit={() => dispatch({ type: 'CLOSE_SUPPRESSION_EDIT' })}
            onSaveEdit={(old, updated) => {
              postMessage({ type: 'editSuppression', payload: { old, updated } });
            }}
            onRemove={(suppression) => {
              postMessage({ type: 'removeSuppression', payload: { suppression } });
            }}
            onAdd={(suppression) => {
              postMessage({ type: 'addSuppression', payload: { suppression } });
            }}
            onStartAdd={() => dispatch({ type: 'START_ADD_SUPPRESSION' })}
            onCancelAdd={() => dispatch({ type: 'CANCEL_ADD_SUPPRESSION' })}
            onFindingClick={(findingId) => {
              const finding = state.currentFindings.find(f => f.id === findingId);
              if (finding) {
                dispatch({ type: 'NAVIGATE', view: 'findingDetail' });
                dispatch({ type: 'MESSAGE', payload: { type: 'findingDetail', payload: finding } });
              }
            }}
            onNavigateDashboard={navigateDashboard}
          />
        );
      case 'empty':
        return (
          <EmptyStateView
            variant="welcome"
            onNavigateDashboard={navigateDashboard}
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-64 opacity-50">
            <p className="text-sm">Loading...</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-auto">
        {renderView()}
      </div>
    </div>
  );
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleMessage = useCallback((msg: ExtToWebviewMessage) => {
    dispatch({ type: 'MESSAGE', payload: msg });
  }, []);

  useMessages(handleMessage);

  useEffect(() => {
    postMessage({ type: 'requestState' });
  }, []);

  if (state.context === 'sidebar') {
    return (
      <SidebarDashboard
        scans={state.scans}
        summary={state.summary}
        scanTargets={state.scanTargets}
        currentFindings={state.currentFindings}
        suppressionSummary={state.suppressionSummary}
        lastScannedAt={state.lastScannedAt}
        ashYamlConfig={state.ashYamlConfig}
      />
    );
  }

  if (state.context === 'sink') {
    return <SinkPage />;
  }

  // Both editorPanel and unknown context render the editor panel.
  // In mock mode (unknown), we default to dashboard view.
  return <EditorPanel state={state} dispatch={dispatch} />;
}

export default App;
