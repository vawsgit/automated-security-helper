import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import picomatch from 'picomatch';
import type {
  AshIgnorePath,
  AshScannerEntry,
  AshSuppression,
  AshYamlConfig,
  FindingRow,
} from '../models/types';

// --- Constants (R-001: 6 filenames from ASH CLI core/constants.py:26-33) ---

export const ASH_CONFIG_FILE_NAMES = [
  '.ash.yml',
  '.ash.yaml',
  '.ash.json',
  'ash.yml',
  'ash.yaml',
  'ash.json',
];

export const ASH_CONFIG_SEARCH_DIRS = ['', '.ash'];

export const DEFAULT_CONFIG: AshYamlConfig = {
  suppressions: [],
  ignorePaths: [],
  severityThreshold: 'MEDIUM',
  projectName: 'ash-scan',
  scanners: [],
  failOnFindings: true,
  configFilePath: null,
};

const SEVERITY_VALUES = new Set(['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const DEBOUNCE_MS = 200;

// --- Discovery ---

export function discoverConfigFile(scanRoot: string): string | null {
  for (const fileName of ASH_CONFIG_FILE_NAMES) {
    for (const dir of ASH_CONFIG_SEARCH_DIRS) {
      const candidate = path.join(scanRoot, dir, fileName);
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch {
        // Permission denied or other fs error — skip candidate
      }
    }
  }
  return null;
}

// --- Parsing ---

export function parseConfigFile(filePath: string): AshYamlConfig {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    let raw: unknown;
    if (ext === '.json') {
      raw = JSON.parse(content);
    } else {
      raw = yaml.load(content, { schema: yaml.DEFAULT_SCHEMA });
    }

    const config = parseRawConfig(raw);
    return { ...config, configFilePath: filePath };
  } catch (err) {
    console.warn(`[ASH Config] Failed to parse ${filePath}:`, err);
    return { ...DEFAULT_CONFIG };
  }
}

export function parseRawConfig(raw: unknown): AshYamlConfig {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return { ...DEFAULT_CONFIG };
  }

  const obj = raw as Record<string, unknown>;
  const globalSettings =
    typeof obj.global_settings === 'object' && obj.global_settings !== null
      ? (obj.global_settings as Record<string, unknown>)
      : {};

  return {
    suppressions: parseSuppressions(globalSettings.suppressions),
    ignorePaths: parseIgnorePaths(globalSettings.ignore_paths),
    severityThreshold: parseSeverityThreshold(globalSettings.severity_threshold),
    projectName: typeof obj.project_name === 'string' ? obj.project_name : 'ash-scan',
    scanners: parseScanners(obj.scanners),
    failOnFindings:
      typeof obj.fail_on_findings === 'boolean' ? obj.fail_on_findings : true,
    configFilePath: null,
  };
}

export function parseSuppressions(raw: unknown): AshSuppression[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: AshSuppression[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      console.warn('[ASH Config] Skipping non-object suppression entry');
      continue;
    }
    const e = entry as Record<string, unknown>;

    if (typeof e.path !== 'string' || !e.path) {
      console.warn('[ASH Config] Skipping suppression entry missing required "path" field');
      continue;
    }
    if (typeof e.reason !== 'string' || !e.reason) {
      console.warn('[ASH Config] Skipping suppression entry missing required "reason" field');
      continue;
    }

    result.push({
      path: e.path,
      reason: e.reason,
      rule_id: typeof e.rule_id === 'string' ? e.rule_id : null,
      line_start: typeof e.line_start === 'number' ? e.line_start : null,
      line_end: typeof e.line_end === 'number' ? e.line_end : null,
      expiration: typeof e.expiration === 'string' ? e.expiration : null,
    });
  }
  return result;
}

export function parseIgnorePaths(raw: unknown): AshIgnorePath[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: AshIgnorePath[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      console.warn('[ASH Config] Skipping non-object ignore_path entry');
      continue;
    }
    const e = entry as Record<string, unknown>;

    if (typeof e.path !== 'string' || !e.path) {
      console.warn('[ASH Config] Skipping ignore_path entry missing required "path" field');
      continue;
    }
    if (typeof e.reason !== 'string' || !e.reason) {
      console.warn('[ASH Config] Skipping ignore_path entry missing required "reason" field');
      continue;
    }

    result.push({
      path: e.path,
      reason: e.reason,
      expiration: typeof e.expiration === 'string' ? e.expiration : null,
    });
  }
  return result;
}

export function parseScanners(raw: unknown): AshScannerEntry[] {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return [];
  }

  const result: AshScannerEntry[] = [];
  const obj = raw as Record<string, unknown>;
  for (const name of Object.keys(obj)) {
    const entry = obj[name];
    if (typeof entry === 'object' && entry !== null) {
      const e = entry as Record<string, unknown>;
      result.push({
        name,
        enabled: typeof e.enabled === 'boolean' ? e.enabled : true,
      });
    }
  }
  return result;
}

function parseSeverityThreshold(
  raw: unknown,
): 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (typeof raw === 'string') {
    const upper = raw.toUpperCase();
    if (SEVERITY_VALUES.has(upper)) {
      return upper as 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }
  }
  return 'MEDIUM';
}

// --- Matching (R-002: replicates suppression_matcher.py) ---

export function isExpired(expiration: string | null): boolean {
  if (expiration === null) {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiration);
  if (!match) {
    console.warn(`[ASH Config] Invalid expiration date format: "${expiration}", treating as non-expiring`);
    return false;
  }

  const expirationDate = new Date(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return expirationDate < today;
}

export function matchesRuleId(
  findingRuleId: string,
  suppressionRuleId: string | null,
): boolean {
  if (suppressionRuleId === null) {
    return true; // No rule_id constraint = matches all
  }
  if (!findingRuleId) {
    return false;
  }
  if (findingRuleId === suppressionRuleId) {
    return true; // Exact match optimization
  }
  return picomatch.isMatch(findingRuleId, suppressionRuleId);
}

export function matchesFilePath(
  findingPath: string,
  suppressionPath: string,
): boolean {
  if (!findingPath) {
    return false;
  }
  if (findingPath === suppressionPath) {
    return true; // Exact match optimization
  }
  return picomatch.isMatch(findingPath, suppressionPath);
}

export function matchesLineRange(
  finding: FindingRow,
  suppression: AshSuppression,
): boolean {
  const hasStart = suppression.line_start !== null;
  const hasEnd = suppression.line_end !== null;

  // No line range on suppression → matches any line
  if (!hasStart && !hasEnd) {
    return true;
  }

  // Finding has no line info but suppression requires it
  if (finding.startLine === 0 && finding.endLine === 0) {
    return false;
  }

  const findingEnd = finding.endLine > 0 ? finding.endLine : finding.startLine;

  // Only line_start specified
  if (hasStart && !hasEnd) {
    return finding.startLine >= suppression.line_start!;
  }

  // Only line_end specified
  if (!hasStart && hasEnd) {
    return findingEnd <= suppression.line_end!;
  }

  // Both specified — check overlap
  // Invalid range (line_end < line_start) → skip range check, match regardless
  if (suppression.line_end! < suppression.line_start!) {
    return true;
  }

  return (
    finding.startLine <= suppression.line_end! &&
    findingEnd >= suppression.line_start!
  );
}

export function findMatchingSuppression(
  finding: FindingRow,
  suppressions: AshSuppression[],
): AshSuppression | null {
  for (const suppression of suppressions) {
    if (isExpired(suppression.expiration)) {
      continue;
    }
    if (!matchesRuleId(finding.ruleId, suppression.rule_id)) {
      continue;
    }
    if (!matchesFilePath(finding.filePath, suppression.path)) {
      continue;
    }
    if (!matchesLineRange(finding, suppression)) {
      continue;
    }
    return suppression;
  }
  return null;
}

// --- Batch matching with pre-compiled patterns ---

interface CompiledSuppression {
  suppression: AshSuppression;
  ruleIdMatcher: ((value: string) => boolean) | null; // null = match all
  pathMatcher: (value: string) => boolean;
}

function compileSuppression(suppression: AshSuppression): CompiledSuppression {
  return {
    suppression,
    ruleIdMatcher:
      suppression.rule_id !== null
        ? picomatch(suppression.rule_id)
        : null,
    pathMatcher: picomatch(suppression.path),
  };
}

function matchesCompiledSuppression(
  finding: FindingRow,
  compiled: CompiledSuppression,
): boolean {
  // Rule ID check
  if (compiled.ruleIdMatcher !== null) {
    if (!finding.ruleId || !compiled.ruleIdMatcher(finding.ruleId)) {
      return false;
    }
  }

  // File path check
  if (!finding.filePath || !compiled.pathMatcher(finding.filePath)) {
    return false;
  }

  // Line range check
  return matchesLineRange(finding, compiled.suppression);
}

export function batchMatchSuppressions(
  findings: FindingRow[],
  suppressions: AshSuppression[],
): Map<string, AshSuppression> {
  const result = new Map<string, AshSuppression>();

  if (findings.length === 0 || suppressions.length === 0) {
    return result;
  }

  // Pre-filter expired suppressions and pre-compile patterns
  const compiled: CompiledSuppression[] = [];
  for (const suppression of suppressions) {
    if (!isExpired(suppression.expiration)) {
      compiled.push(compileSuppression(suppression));
    }
  }

  if (compiled.length === 0) {
    return result;
  }

  for (const finding of findings) {
    for (const c of compiled) {
      if (matchesCompiledSuppression(finding, c)) {
        result.set(finding.id, c.suppression);
        break; // First match wins
      }
    }
  }

  return result;
}
