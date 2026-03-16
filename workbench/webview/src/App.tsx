import { useReducer, useCallback, useEffect } from 'react';
import { postMessage, useMessages } from './hooks/useVSCodeAPI';
import { SidebarDashboard } from './components/SidebarDashboard';
import { DevNav } from './components/DevNav';
import { DashboardView } from './components/DashboardView';
import { FindingsView } from './components/FindingsView';
import { FindingDetailView } from './components/FindingDetailView';
import { ScanHistoryView } from './components/ScanHistoryView';
import { ScanDetailView } from './components/ScanDetailView';
import { ScanProgressView } from './components/ScanProgressView';
import { EmptyStateView } from './components/EmptyStateView';
import SinkPage from './pages/sink/SinkPage';
import { mockProject, mockScans, mockFindings, mockSummary, updateMockDisposition, updateMockNotes } from './mock-data';
import type { ExtToWebviewMessage } from './types/messages';
import type { Project, ScanSummary, FindingRow, DispositionSummary, Disposition } from './types/types';

type ViewState =
  | 'loading' | 'dashboard' | 'findingList' | 'findingDetail'
  | 'scanHistory' | 'scanDetail' | 'scanProgress' | 'empty';

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
}

type AppAction =
  | { type: 'MESSAGE'; payload: ExtToWebviewMessage }
  | { type: 'NAVIGATE'; view: ViewState }
  | { type: 'SELECT_FINDING'; findingId: string }
  | { type: 'SELECT_SCAN'; scanId: string }
  | { type: 'VIEW_SCAN_DETAIL'; scanId: string }
  | { type: 'SET_DISPOSITION'; findingId: string; disposition: Disposition }
  | { type: 'SET_NOTES'; findingId: string; notes: string }
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
  view: 'dashboard',
  viewHistory: [],
  project: mockProject,
  scanId: mockScans[0]?.id,
  scans: mockScans,
  summary: mockSummary,
  findings: mockFindings,
  selectedFinding: undefined,
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
          return { ...state, scans: msg.payload.scans, summary: msg.payload.summary };
        case 'findingsUpdate':
          return { ...state, findings: msg.payload.findings, view: 'findingList' };
        case 'findingDetail':
          return { ...state, selectedFinding: msg.payload, view: 'findingDetail' };
        case 'dispositionUpdated': {
          const findings = updateMockDisposition(state.findings, msg.payload.findingId, msg.payload.disposition);
          const selectedFinding = state.selectedFinding?.id === msg.payload.findingId
            ? { ...state.selectedFinding, disposition: msg.payload.disposition }
            : state.selectedFinding;
          return { ...state, findings, selectedFinding, summary: recomputeSummary(findings) };
        }
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
      const findings = updateMockDisposition(state.findings, action.findingId, action.disposition);
      const selectedFinding = state.selectedFinding?.id === action.findingId
        ? { ...state.selectedFinding, disposition: action.disposition }
        : state.selectedFinding;
      return { ...state, findings, selectedFinding, summary: recomputeSummary(findings) };
    }
    case 'SET_NOTES': {
      const findings = updateMockNotes(state.findings, action.findingId, action.notes);
      const selectedFinding = state.selectedFinding?.id === action.findingId
        ? { ...state.selectedFinding, notes: action.notes }
        : state.selectedFinding;
      return { ...state, findings, selectedFinding };
    }
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
  const navigate = (view: ViewState) => dispatch({ type: 'NAVIGATE', view });
  const navigateDashboard = () => dispatch({ type: 'NAVIGATE', view: 'dashboard' });
  const navigateFindings = () => dispatch({ type: 'NAVIGATE', view: 'findingList' });
  const navigateScans = () => dispatch({ type: 'NAVIGATE', view: 'scanHistory' });

  const renderView = () => {
    switch (state.view) {
      case 'dashboard':
        return (
          <DashboardView
            project={state.project}
            scans={state.scans}
            findings={state.findings}
            summary={state.summary}
            onNavigate={navigate}
          />
        );
      case 'findingList':
        return (
          <FindingsView
            findings={state.findings}
            onSelectFinding={(findingId) => dispatch({ type: 'SELECT_FINDING', findingId })}
            onSetDisposition={(findingId, disposition) =>
              dispatch({ type: 'SET_DISPOSITION', findingId, disposition })
            }
            onNavigateDashboard={navigateDashboard}
          />
        );
      case 'findingDetail':
        if (!state.selectedFinding) {
          navigate('findingList');
          return null;
        }
        return (
          <FindingDetailView
            finding={state.selectedFinding}
            findings={state.findings}
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
          />
        );
      case 'scanHistory':
        return (
          <ScanHistoryView
            scans={state.scans}
            onSelectScan={(scanId) => dispatch({ type: 'VIEW_SCAN_DETAIL', scanId })}
            onNavigateDashboard={navigateDashboard}
            onNavigate={navigate}
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
            findings={state.findings}
            onNavigateDashboard={navigateDashboard}
            onNavigateScans={navigateScans}
            onViewFindings={() => dispatch({ type: 'SELECT_SCAN', scanId: scan.id })}
          />
        );
      }
      case 'scanProgress':
        return (
          <ScanProgressView
            onNavigateDashboard={navigateDashboard}
            onNavigateScans={navigateScans}
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
      <DevNav currentView={state.view} onNavigate={navigate} />
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
    return <SidebarDashboard scans={state.scans} summary={state.summary} />;
  }

  if (state.context === 'sink') {
    return <SinkPage />;
  }

  // Both editorPanel and unknown context render the editor panel.
  // In mock mode (unknown), we default to dashboard view.
  return <EditorPanel state={state} dispatch={dispatch} />;
}

export default App;
