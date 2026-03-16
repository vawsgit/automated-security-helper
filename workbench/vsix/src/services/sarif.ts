import * as path from 'node:path';
import type { SarifLog, SarifResult, SarifRun } from '../types/sarif';

export type { SarifLog, SarifResult, SarifRun } from '../types/sarif';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface ParsedFinding {
  ruleId: string;
  scanner: string;
  severity: Severity;
  file: string;
  startLine: number;
  endLine?: number;
  title: string;
  description: string;
  snippet?: string;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

const VALID_SEVERITIES = new Set<string>(Object.keys(SEVERITY_ORDER));

const LEVEL_TO_SEVERITY: Record<string, Severity> = {
  error: 'HIGH',
  warning: 'MEDIUM',
  note: 'LOW',
  none: 'INFO',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function extractSeverity(result: SarifResult, _run?: SarifRun): Severity {
  const ashSeverity = result.properties?.['severity'] ?? result.properties?.['ash/severity'];
  if (typeof ashSeverity === 'string') {
    const upper = ashSeverity.toUpperCase();
    if (VALID_SEVERITIES.has(upper)) {
      return upper as Severity;
    }
  }

  const level = result.level ?? 'warning';
  return LEVEL_TO_SEVERITY[level] ?? 'MEDIUM';
}

export function normalizeFilePath(uri: string, sourceDir: string): string {
  if (!uri) {
    return 'unknown';
  }

  let filePath = uri;

  // Strip file:// prefix
  if (filePath.startsWith('file:///')) {
    filePath = filePath.slice(7);
  } else if (filePath.startsWith('file://')) {
    filePath = filePath.slice(5);
  }

  // Decode URI-encoded characters
  try {
    filePath = decodeURIComponent(filePath);
  } catch {
    // If decoding fails, use the raw path
  }

  // If the path is absolute and starts with sourceDir, make it relative
  if (path.isAbsolute(filePath)) {
    const normalizedSource = sourceDir.endsWith(path.sep)
      ? sourceDir.slice(0, -1)
      : sourceDir;
    if (filePath.startsWith(normalizedSource + path.sep) || filePath.startsWith(normalizedSource + '/')) {
      filePath = filePath.slice(normalizedSource.length + 1);
    } else if (filePath === normalizedSource) {
      filePath = '.';
    } else {
      filePath = path.relative(normalizedSource, filePath);
    }
  }

  return filePath || 'unknown';
}

export function deduplicateFindings(findings: ParsedFinding[]): ParsedFinding[] {
  const groups = new Map<string, ParsedFinding[]>();

  for (const finding of findings) {
    const key = `${finding.ruleId}\0${finding.file}`;
    const group = groups.get(key);
    if (group) {
      group.push(finding);
    } else {
      groups.set(key, [finding]);
    }
  }

  const result: ParsedFinding[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Merge the group
    const scanners = new Set<string>();
    let minStartLine = Infinity;
    let maxEndLine: number | undefined;
    let bestDescription = '';
    let bestTitle = '';
    let bestSnippet: string | undefined;
    let highestSeverity: Severity = 'INFO';

    for (const f of group) {
      // Collect unique scanner names
      for (const s of f.scanner.split(', ')) {
        scanners.add(s);
      }

      if (f.startLine < minStartLine) {
        minStartLine = f.startLine;
      }

      if (f.endLine !== undefined) {
        if (maxEndLine === undefined || f.endLine > maxEndLine) {
          maxEndLine = f.endLine;
        }
      }

      if (f.description.length > bestDescription.length) {
        bestDescription = f.description;
      }

      if (!bestTitle && f.title) {
        bestTitle = f.title;
      }

      if (!bestSnippet && f.snippet) {
        bestSnippet = f.snippet;
      }

      if (SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[highestSeverity]) {
        highestSeverity = f.severity;
      }
    }

    result.push({
      ruleId: group[0].ruleId,
      scanner: Array.from(scanners).join(', '),
      severity: highestSeverity,
      file: group[0].file,
      startLine: minStartLine,
      endLine: maxEndLine,
      title: bestTitle || group[0].title,
      description: bestDescription || group[0].description,
      snippet: bestSnippet,
    });
  }

  return result;
}

export function parseSarif(sarifJson: SarifLog, sourceDir: string): ParsedFinding[] {
  if (!sarifJson.runs || sarifJson.runs.length === 0) {
    return [];
  }

  const allFindings: ParsedFinding[] = [];

  for (const run of sarifJson.runs) {
    const scanner = run.tool.driver.name;

    // Build rules lookup for title extraction
    const rulesMap = new Map<string, string>();
    if (run.tool.driver.rules) {
      for (const rule of run.tool.driver.rules) {
        if (rule.shortDescription?.text) {
          rulesMap.set(rule.id, rule.shortDescription.text);
        }
      }
    }

    if (!run.results) {
      continue;
    }

    for (const result of run.results) {
      const ruleId = result.ruleId || 'unknown';
      const severity = extractSeverity(result, run);

      // Extract location data from first location
      const location = result.locations?.[0];
      const physicalLocation = location?.physicalLocation;
      const uri = physicalLocation?.artifactLocation?.uri ?? '';
      const region = physicalLocation?.region;

      const file = normalizeFilePath(uri, sourceDir);
      const startLine = region?.startLine ?? 1;
      const endLine = region?.endLine;
      const snippet = region?.snippet?.text;

      // Title: prefer rules shortDescription, fall back to message
      const title = rulesMap.get(ruleId) ?? result.message.text;
      const description = result.message.text;

      allFindings.push({
        ruleId,
        scanner,
        severity,
        file,
        startLine,
        endLine,
        title,
        description,
        snippet,
      });
    }
  }

  return deduplicateFindings(allFindings);
}
