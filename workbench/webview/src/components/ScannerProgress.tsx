interface ScannerInfo {
  name: string;
  status: 'completed' | 'running' | 'queued';
  duration?: string;
}

interface ScannerProgressProps {
  scanners: ScannerInfo[];
}

const statusIcon: Record<ScannerInfo['status'], string> = {
  completed: 'v',
  running: '*',
  queued: 'o',
};

const statusStyle: Record<ScannerInfo['status'], string> = {
  completed: 'text-green-500',
  running: 'text-yellow-500 animate-pulse',
  queued: 'opacity-40',
};

export function ScannerProgress({ scanners }: ScannerProgressProps) {
  return (
    <ul className="space-y-1">
      {scanners.map(s => (
        <li key={s.name} className="flex items-center gap-2 text-sm">
          <span className={statusStyle[s.status]}>{statusIcon[s.status]}</span>
          <span className={s.status === 'queued' ? 'opacity-50' : ''}>{s.name}</span>
          {s.duration && <span className="text-xs opacity-50 ml-auto">{s.duration}</span>}
        </li>
      ))}
    </ul>
  );
}
