import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SeverityBadge } from './SeverityBadge';
import { DispositionBadge } from './DispositionBadge';
import { postMessage } from '../hooks/useVSCodeAPI';
import type { FindingRow, Severity, Disposition } from '../types/types';

interface FindingListProps {
  scanId: string;
  findings: FindingRow[];
  onSelectFinding: (findingId: string) => void;
}

const ALL_SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const ALL_DISPOSITIONS: Disposition[] = ['PENDING', 'FIX', 'SUPPRESS', 'DEFER'];

export function FindingList({ scanId, findings, onSelectFinding }: FindingListProps) {
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(new Set(ALL_SEVERITIES));
  const [activeDispositions, setActiveDispositions] = useState<Set<Disposition>>(new Set(ALL_DISPOSITIONS));
  const [scannerFilter, setScannerFilter] = useState<string>('all');

  const scanners = [...new Set(findings.map(f => f.scanner))].sort();

  const filtered = findings.filter(f =>
    activeSeverities.has(f.severity) &&
    activeDispositions.has(f.disposition) &&
    (scannerFilter === 'all' || f.scanner === scannerFilter)
  );

  const toggleSeverity = (s: Severity) => {
    setActiveSeverities(prev => {
      const next = new Set(prev);
      if (next.has(s)) {
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  };

  const toggleDisposition = (d: Disposition) => {
    setActiveDispositions(prev => {
      const next = new Set(prev);
      if (next.has(d)) {
        next.delete(d);
      } else {
        next.add(d);
      }
      return next;
    });
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Findings</h1>
          <p className="text-xs opacity-70">
            Scan {scanId} &middot; {findings.length} total findings &middot; {filtered.length} shown
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs opacity-70 mr-1">Severity:</span>
          {ALL_SEVERITIES.map(s => (
            <Badge
              key={s}
              className={`cursor-pointer text-xs ${activeSeverities.has(s) ? '' : 'opacity-30'}`}
              variant={activeSeverities.has(s) ? 'default' : 'outline'}
              onClick={() => toggleSeverity(s)}
            >
              {s}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs opacity-70 mr-1">Disposition:</span>
          {ALL_DISPOSITIONS.map(d => (
            <Badge
              key={d}
              className={`cursor-pointer text-xs ${activeDispositions.has(d) ? '' : 'opacity-30'}`}
              variant={activeDispositions.has(d) ? 'default' : 'outline'}
              onClick={() => toggleDisposition(d)}
            >
              {d}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-70">Scanner:</span>
          <select
            className="text-xs rounded px-2 py-1"
            style={{
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
            }}
            value={scannerFilter}
            onChange={e => setScannerFilter(e.target.value)}
          >
            <option value="all">All</option>
            {scanners.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Findings table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Severity</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-48">File</TableHead>
            <TableHead className="w-28">Scanner</TableHead>
            <TableHead className="w-24">Disposition</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(finding => (
            <TableRow
              key={finding.id}
              className="cursor-pointer"
              onClick={() => {
                postMessage({ type: 'selectFinding', payload: { findingId: finding.id } });
                onSelectFinding(finding.id);
              }}
            >
              <TableCell><SeverityBadge severity={finding.severity} /></TableCell>
              <TableCell className="font-medium max-w-xs truncate">{finding.title}</TableCell>
              <TableCell className="text-xs opacity-70 max-w-[12rem] truncate">{finding.filePath}:{finding.startLine}</TableCell>
              <TableCell className="text-xs">{finding.scanner}</TableCell>
              <TableCell><DispositionBadge disposition={finding.disposition} /></TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center opacity-50 py-8">
                No findings match the current filters
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
