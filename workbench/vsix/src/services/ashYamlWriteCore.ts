import * as yaml from 'js-yaml';
import type {
  AshSuppression,
  SuppressionInput,
} from '../models/types';

// --- Pure helpers (exported for testing) ---

export function inputToSuppression(input: SuppressionInput): AshSuppression {
  let filePath: string;
  let ruleId: string | null;

  switch (input.scope) {
    case 'file_rule':
      filePath = input.filePath;
      ruleId = input.ruleId;
      break;
    case 'rule_everywhere':
      filePath = '**';
      ruleId = input.ruleId;
      break;
    case 'file_all_rules':
      filePath = input.filePath;
      ruleId = null;
      break;
  }

  return {
    path: filePath,
    reason: input.justification,
    rule_id: ruleId,
    line_start: input.includeLineRange ? input.startLine : null,
    line_end: input.includeLineRange ? input.endLine : null,
    expiration: input.expiration,
  };
}

export function serializeSuppressionEntry(s: AshSuppression, indent: number = 4): string {
  const pad = ' '.repeat(indent);
  const fieldPad = pad + '  ';
  const lines: string[] = [`${pad}- path: "${s.path}"`];
  if (s.rule_id) {
    lines.push(`${fieldPad}rule_id: "${s.rule_id}"`);
  }
  lines.push(`${fieldPad}reason: "${s.reason}"`);
  if (s.line_start !== null && s.line_start !== undefined) {
    lines.push(`${fieldPad}line_start: ${s.line_start}`);
  }
  if (s.line_end !== null && s.line_end !== undefined) {
    lines.push(`${fieldPad}line_end: ${s.line_end}`);
  }
  if (s.expiration) {
    lines.push(`${fieldPad}expiration: "${s.expiration}"`);
  }
  return lines.join('\n');
}

export function generateSkeleton(entry: AshSuppression): string {
  const lines: string[] = [
    'global_settings:',
    '  suppressions:',
    serializeSuppressionEntry(entry, 4),
    '',
  ];
  return lines.join('\n');
}

export function findSuppressionIndex(
  suppressions: AshSuppression[],
  target: AshSuppression,
): number {
  return suppressions.findIndex((s) => {
    if (s.path !== target.path) {
      return false;
    }
    if (s.rule_id !== target.rule_id) {
      return false;
    }
    if (s.reason !== target.reason) {
      return false;
    }
    if (s.line_start !== target.line_start) {
      return false;
    }
    if (s.line_end !== target.line_end) {
      return false;
    }
    if (s.expiration !== target.expiration) {
      return false;
    }
    return true;
  });
}

export function reserializeSuppressionsSection(
  fileContent: string,
  updatedSuppressions: AshSuppression[],
): string {
  const raw = yaml.load(fileContent) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    return fileContent;
  }

  const globalSettings =
    typeof raw.global_settings === 'object' && raw.global_settings !== null
      ? (raw.global_settings as Record<string, unknown>)
      : {};

  // Rebuild the suppressions in the raw object for serialization
  const serializedSuppressions = updatedSuppressions.map((s) => {
    const entry: Record<string, unknown> = { path: s.path };
    if (s.rule_id) {
      entry.rule_id = s.rule_id;
    }
    entry.reason = s.reason;
    if (s.line_start !== null && s.line_start !== undefined) {
      entry.line_start = s.line_start;
    }
    if (s.line_end !== null && s.line_end !== undefined) {
      entry.line_end = s.line_end;
    }
    if (s.expiration) {
      entry.expiration = s.expiration;
    }
    return entry;
  });

  globalSettings.suppressions = serializedSuppressions;
  raw.global_settings = globalSettings;

  return yaml.dump(raw, { lineWidth: -1, noRefs: true, quotingType: '"' });
}

export function appendSuppressionEntry(fileContent: string, entry: AshSuppression): string {
  // Check if global_settings.suppressions exists in the content
  const hasSuppressionsKey = /^\s*suppressions\s*:/m.test(fileContent);
  const hasGlobalSettings = /^\s*global_settings\s*:/m.test(fileContent);

  if (hasSuppressionsKey) {
    // Append to existing suppressions array
    const entryText = serializeSuppressionEntry(entry, 4);
    // Find the suppressions section and append after the last entry
    const lines = fileContent.split('\n');
    const result: string[] = [];
    let inSuppressions = false;
    let lastSuppressionLine = -1;
    let suppressionsIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\s*)suppressions\s*:/);
      if (match) {
        inSuppressions = true;
        suppressionsIndent = match[1].length + 2; // indent of entries under suppressions
        lastSuppressionLine = i;
      } else if (inSuppressions) {
        // Check if this line is part of the suppressions array
        const lineIndent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
        if (lines[i].trim() === '' || lineIndent >= suppressionsIndent) {
          if (lines[i].trim() !== '') {
            lastSuppressionLine = i;
          }
        } else {
          inSuppressions = false;
        }
      }
      result.push(lines[i]);
    }

    if (lastSuppressionLine >= 0) {
      // Insert the new entry after the last suppression line
      result.splice(lastSuppressionLine + 1, 0, entryText);
      return result.join('\n');
    }
  }

  if (hasGlobalSettings && !hasSuppressionsKey) {
    // global_settings exists but no suppressions key — add it
    const lines = fileContent.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      result.push(lines[i]);
      if (/^\s*global_settings\s*:/.test(lines[i])) {
        result.push('  suppressions:');
        result.push(serializeSuppressionEntry(entry, 4));
      }
    }
    return result.join('\n');
  }

  // No global_settings at all — append section at end
  const section = [
    '',
    'global_settings:',
    '  suppressions:',
    serializeSuppressionEntry(entry, 4),
  ].join('\n');
  return fileContent.trimEnd() + '\n' + section + '\n';
}
