import { useReducer, useCallback, useEffect } from 'react';
import { postMessage, useMessages } from './hooks/useVSCodeAPI';
import { SidebarDashboard } from './components/SidebarDashboard';
import { FindingList } from './components/FindingList';
import { FindingDetail } from './components/FindingDetail';
import type { ExtToWebviewMessage } from './types/messages';
import type { ScanSummary, FindingRow, DispositionSummary } from './types/types';

type ViewState = 'loading' | 'findingList' | 'findingDetail';

interface AppState {
  context: 'sidebar' | 'editorPanel' | 'unknown';
  scanId: string | undefined;
  scans: ScanSummary[];
  summary: DispositionSummary;
  findings: FindingRow[];
  selectedFinding: FindingRow | undefined;
  view: ViewState;
}

type AppAction =
  | { type: 'MESSAGE'; payload: ExtToWebviewMessage }
  | { type: 'SELECT_FINDING'; findingId: string }
  | { type: 'BACK_TO_LIST' };

const initialState: AppState = {
  context: 'unknown',
  scanId: undefined,
  scans: [],
  summary: { total: 0, counts: { PENDING: 0, FIX: 0, SUPPRESS: 0, DEFER: 0 } },
  findings: [],
  selectedFinding: undefined,
  view: 'loading',
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
          return { ...state, context: 'editorPanel', scanId: msg.payload.scanId, view: 'loading' };
        case 'stateUpdate':
          return { ...state, scans: msg.payload.scans, summary: msg.payload.summary };
        case 'findingsUpdate':
          return { ...state, findings: msg.payload.findings, view: 'findingList' };
        case 'findingDetail':
          return { ...state, selectedFinding: msg.payload, view: 'findingDetail' };
        case 'dispositionUpdated': {
          const updateDisposition = (finding: FindingRow): FindingRow =>
            finding.id === msg.payload.findingId
              ? { ...finding, disposition: msg.payload.disposition }
              : finding;
          return {
            ...state,
            findings: state.findings.map(updateDisposition),
            selectedFinding: state.selectedFinding
              ? updateDisposition(state.selectedFinding)
              : undefined,
          };
        }
        default:
          return state;
      }
    }
    case 'SELECT_FINDING': {
      const finding = state.findings.find(f => f.id === action.findingId);
      if (finding) {
        return { ...state, selectedFinding: finding, view: 'findingDetail' };
      }
      return state;
    }
    case 'BACK_TO_LIST':
      return { ...state, selectedFinding: undefined, view: 'findingList' };
    default:
      return state;
  }
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

  if (state.context === 'editorPanel') {
    if (state.view === 'findingDetail' && state.selectedFinding) {
      return (
        <FindingDetail
          finding={state.selectedFinding}
          onBack={() => dispatch({ type: 'BACK_TO_LIST' })}
        />
      );
    }

    return (
      <FindingList
        scanId={state.scanId ?? ''}
        findings={state.findings}
        onSelectFinding={(findingId) => dispatch({ type: 'SELECT_FINDING', findingId })}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-screen opacity-50">
      <p className="text-sm">Loading...</p>
    </div>
  );
}

export default App;
