import { Button } from '@/components/ui/button';
import { LayoutDashboard, List, FileText, History, Loader, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

type ViewState =
  | 'loading' | 'dashboard' | 'findingList' | 'findingDetail'
  | 'scanHistory' | 'scanDetail' | 'scanProgress' | 'empty';

const DEV_VIEWS: { view: ViewState; label: string; icon: ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { view: 'findingList', label: 'Findings', icon: <List className="h-3.5 w-3.5" /> },
  { view: 'findingDetail', label: 'Detail', icon: <FileText className="h-3.5 w-3.5" /> },
  { view: 'scanHistory', label: 'Scans', icon: <History className="h-3.5 w-3.5" /> },
  { view: 'scanProgress', label: 'Progress', icon: <Loader className="h-3.5 w-3.5" /> },
  { view: 'empty', label: 'Empty', icon: <Inbox className="h-3.5 w-3.5" /> },
];

export function DevNav({ currentView, onNavigate }: {
  currentView: ViewState;
  onNavigate: (v: ViewState) => void;
}) {
  return (
    <div className="flex gap-1 p-2 border-b bg-yellow-500/10">
      <span className="text-xs font-mono opacity-50 self-center mr-2">
        DEV
      </span>
      {DEV_VIEWS.map(({ view, label, icon }) => (
        <Button
          key={view}
          variant={currentView === view ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-7 gap-1.5"
          onClick={() => onNavigate(view)}
        >
          {icon}
          {label}
        </Button>
      ))}
    </div>
  );
}
