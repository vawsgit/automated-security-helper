import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { SuppressionTable } from '../../../components/SuppressionTable';
import { SuppressionRuleForm } from '../../../components/SuppressionRuleForm';
import { SuppressionManagerView } from '../../../components/SuppressionManagerView';
import type {
  SuppressionEntry,
  AshSuppression,
  AshIgnorePath,
  AshYamlConfigSummary,
  FindingRow,
  MatchedFindingRef,
} from '../../../types/types';

// ---------------------------------------------------------------------------
// Mock matched findings
// ---------------------------------------------------------------------------

const mockMatchedFindings: MatchedFindingRef[] = [
  { id: 'f-1', severity: 'HIGH', title: 'SQL injection in query builder', file: 'src/db/query.ts', line: 42 },
  { id: 'f-2', severity: 'MEDIUM', title: 'Hardcoded API key', file: 'src/config.ts', line: 15 },
];

const mockMatchedFindings2: MatchedFindingRef[] = [
  { id: 'f-3', severity: 'CRITICAL', title: 'Remote code execution via eval()', file: 'src/utils/exec.ts', line: 8 },
];

const mockMatchedFindings3: MatchedFindingRef[] = [
  { id: 'f-4', severity: 'LOW', title: 'Console.log left in production code', file: 'src/handlers/auth.ts', line: 101 },
  { id: 'f-5', severity: 'HIGH', title: 'Insecure cookie settings', file: 'src/handlers/auth.ts', line: 55 },
  { id: 'f-6', severity: 'MEDIUM', title: 'Missing CSRF token validation', file: 'src/handlers/auth.ts', line: 72 },
];

// ---------------------------------------------------------------------------
// Mock suppression entries (3 active, 2 unused, 2 expired)
// ---------------------------------------------------------------------------

const mockSuppressions: SuppressionEntry[] = [
  // Active suppressions (matched findings, not expired)
  {
    path: 'src/db/**/*.ts',
    reason: 'SQL queries are parameterized; false positive from pattern match',
    rule_id: 'B608',
    line_start: null,
    line_end: null,
    expiration: '2027-06-15',
    status: 'active',
    matchCount: 2,
    matchedFindings: mockMatchedFindings,
  },
  {
    path: 'src/utils/exec.ts',
    reason: 'Sandboxed execution environment; input is sanitized upstream',
    rule_id: 'CKV_AWS_18',
    line_start: 5,
    line_end: 20,
    expiration: '2027-12-31',
    status: 'active',
    matchCount: 1,
    matchedFindings: mockMatchedFindings2,
  },
  {
    path: 'src/handlers/auth.ts',
    reason: 'Auth handler reviewed and accepted by security team',
    rule_id: null,
    line_start: 50,
    line_end: 110,
    expiration: null,
    status: 'active',
    matchCount: 3,
    matchedFindings: mockMatchedFindings3,
  },

  // Unused suppressions (no matches, not expired)
  {
    path: 'src/legacy/**/*.js',
    reason: 'Legacy code scheduled for removal in Q3',
    rule_id: 'S5332',
    line_start: null,
    line_end: null,
    expiration: '2027-09-01',
    status: 'unused',
    matchCount: 0,
    matchedFindings: [],
  },
  {
    path: 'tests/fixtures/creds.json',
    reason: 'Test fixture with dummy credentials',
    rule_id: 'detect-secrets',
    line_start: 1,
    line_end: 50,
    expiration: null,
    status: 'unused',
    matchCount: 0,
    matchedFindings: [],
  },

  // Expired suppressions (past expiration date)
  {
    path: 'src/config.ts',
    reason: 'Temporary suppression for sprint demo',
    rule_id: 'HardcodedPasswordString',
    line_start: 10,
    line_end: 15,
    expiration: '2025-01-01',
    status: 'expired',
    matchCount: 0,
    matchedFindings: [],
  },
  {
    path: 'src/**/*.py',
    reason: 'Python scanner had false positives in v2.1; fixed in v2.3',
    rule_id: null,
    line_start: null,
    line_end: null,
    expiration: '2024-06-30',
    status: 'expired',
    matchCount: 0,
    matchedFindings: [],
  },
];

// ---------------------------------------------------------------------------
// Mock ignore paths (one active, one expired)
// ---------------------------------------------------------------------------

const mockIgnorePaths: AshIgnorePath[] = [
  {
    path: 'node_modules/',
    reason: 'Third-party dependencies scanned separately',
    expiration: null,
  },
  {
    path: 'dist/',
    reason: 'Temporary exclusion during build pipeline migration',
    expiration: '2024-12-01',
  },
];

// ---------------------------------------------------------------------------
// Mock config info
// ---------------------------------------------------------------------------

const mockConfigInfo: AshYamlConfigSummary = {
  suppressionCount: mockSuppressions.length,
  ignorePathCount: mockIgnorePaths.length,
  severityThreshold: 'MEDIUM',
  projectName: 'ash-workbench',
  enabledScanners: ['bandit', 'checkov', 'semgrep', 'detect-secrets', 'grype'],
};

// ---------------------------------------------------------------------------
// Mock current findings (for SuppressionManagerView)
// ---------------------------------------------------------------------------

const mockCurrentFindings: FindingRow[] = [
  {
    id: 'f-1',
    scanId: 'scan-001',
    scanTargetId: 'st-001',
    title: 'SQL injection in query builder',
    description: 'User input is concatenated directly into SQL query string.',
    severity: 'HIGH',
    disposition: 'SUPPRESS',
    scanner: 'bandit',
    ruleId: 'B608',
    filePath: 'src/db/query.ts',
    startLine: 42,
    endLine: 42,
    codeSnippet: 'const query = `SELECT * FROM users WHERE id = ${userId}`;',
    notes: '',
    firstDetectedAt: '2025-03-10T08:00:00Z',
    aiAnalysis: null,
    suppression: null,
    isCurrentlySuppressed: true,
    suppressionSource: 'ash_yaml',
  },
  {
    id: 'f-2',
    scanId: 'scan-001',
    scanTargetId: 'st-001',
    title: 'Hardcoded API key',
    description: 'API key found hardcoded in source file.',
    severity: 'MEDIUM',
    disposition: 'PENDING',
    scanner: 'detect-secrets',
    ruleId: 'HardcodedPasswordString',
    filePath: 'src/config.ts',
    startLine: 15,
    endLine: 15,
    codeSnippet: 'const API_KEY = "sk-abc123...";',
    notes: '',
    firstDetectedAt: '2025-03-10T08:00:00Z',
    aiAnalysis: null,
    suppression: null,
    isCurrentlySuppressed: false,
    suppressionSource: null,
  },
];

// ---------------------------------------------------------------------------
// Known autocomplete values
// ---------------------------------------------------------------------------

const knownPaths = [
  'src/db/**/*.ts',
  'src/utils/exec.ts',
  'src/handlers/auth.ts',
  'src/config.ts',
  'src/legacy/**/*.js',
  'tests/fixtures/creds.json',
  'src/**/*.py',
];

const knownRuleIds = [
  'B608',
  'CKV_AWS_18',
  'S5332',
  'HardcodedPasswordString',
  'detect-secrets',
];

// ---------------------------------------------------------------------------
// Pre-filled values for Edit Mode demo
// ---------------------------------------------------------------------------

const editModeInitialValues: AshSuppression = {
  path: 'src/db/**/*.ts',
  reason: 'SQL queries are parameterized; false positive from pattern match',
  rule_id: 'B608',
  line_start: null,
  line_end: null,
  expiration: '2027-06-15',
};

// ---------------------------------------------------------------------------
// Demo component
// ---------------------------------------------------------------------------

export function SuppressionManagementDemo() {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* ----------------------------------------------------------------- */}
      {/* Section 1: Suppression Table                                      */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Suppression Table</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Interactive table with filter chips, search, sorting, expand-to-view matched findings, and edit/remove actions.
        </p>
        <SuppressionTable
          suppressions={mockSuppressions}
          editingSuppressionIndex={editingIndex}
          onEdit={(index) => {
            console.log('[SuppressionTable] onEdit:', index);
            setEditingIndex(index);
          }}
          onCloseEdit={() => {
            console.log('[SuppressionTable] onCloseEdit');
            setEditingIndex(null);
          }}
          onSaveEdit={(old, updated) => {
            console.log('[SuppressionTable] onSaveEdit:', { old, updated });
            setEditingIndex(null);
          }}
          onRemove={(suppression) => {
            console.log('[SuppressionTable] onRemove:', suppression);
          }}
          onFindingClick={(findingId) => {
            console.log('[SuppressionTable] onFindingClick:', findingId);
          }}
          editForm={
            editingIndex !== null ? (
              <SuppressionRuleForm
                initialValues={mockSuppressions[editingIndex]}
                knownPaths={knownPaths}
                knownRuleIds={knownRuleIds}
                onSave={(updated) => {
                  console.log('[SuppressionTable editForm] onSave:', updated);
                  setEditingIndex(null);
                }}
                onCancel={() => setEditingIndex(null)}
              />
            ) : undefined
          }
        />
      </section>

      <Separator />

      {/* ----------------------------------------------------------------- */}
      {/* Section 2: Suppression Rule Form (Add Mode)                       */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Suppression Rule Form (Add Mode)</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Empty form for creating a new suppression rule. Path and Rule ID fields have autocomplete from known values.
        </p>
        <div className="max-w-2xl rounded-md border p-4">
          <SuppressionRuleForm
            knownPaths={knownPaths}
            knownRuleIds={knownRuleIds}
            onSave={(suppression) => {
              console.log('[SuppressionRuleForm Add] onSave:', suppression);
            }}
            onCancel={() => {
              console.log('[SuppressionRuleForm Add] onCancel');
            }}
          />
        </div>
      </section>

      <Separator />

      {/* ----------------------------------------------------------------- */}
      {/* Section 3: Suppression Rule Form (Edit Mode)                      */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Suppression Rule Form (Edit Mode)</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Pre-filled form for editing an existing suppression rule. All fields populated from an active rule.
        </p>
        <div className="max-w-2xl rounded-md border p-4">
          <SuppressionRuleForm
            initialValues={editModeInitialValues}
            knownPaths={knownPaths}
            knownRuleIds={knownRuleIds}
            onSave={(suppression) => {
              console.log('[SuppressionRuleForm Edit] onSave:', suppression);
            }}
            onCancel={() => {
              console.log('[SuppressionRuleForm Edit] onCancel');
            }}
          />
        </div>
      </section>

      <Separator />

      {/* ----------------------------------------------------------------- */}
      {/* Section 4: Full SuppressionManagerView                            */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <h3 className="text-sm font-semibold mb-3">SuppressionManagerView (Full View)</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Complete view with summary cards, suppression table, ignore paths, and configuration panel.
        </p>
        <div className="rounded-md border">
          <SuppressionManagerView
            suppressions={mockSuppressions}
            ignorePaths={mockIgnorePaths}
            configInfo={mockConfigInfo}
            currentFindings={mockCurrentFindings}
            editingSuppressionIndex={editingIndex}
            addingNewSuppression={addingNew}
            knownPaths={knownPaths}
            knownRuleIds={knownRuleIds}
            onEdit={(index) => {
              console.log('[SuppressionManagerView] onEdit:', index);
              setEditingIndex(index);
            }}
            onCloseEdit={() => {
              console.log('[SuppressionManagerView] onCloseEdit');
              setEditingIndex(null);
            }}
            onSaveEdit={(old, updated) => {
              console.log('[SuppressionManagerView] onSaveEdit:', { old, updated });
              setEditingIndex(null);
            }}
            onRemove={(suppression) => {
              console.log('[SuppressionManagerView] onRemove:', suppression);
            }}
            onAdd={(suppression) => {
              console.log('[SuppressionManagerView] onAdd:', suppression);
              setAddingNew(false);
            }}
            onStartAdd={() => {
              console.log('[SuppressionManagerView] onStartAdd');
              setAddingNew(true);
            }}
            onCancelAdd={() => {
              console.log('[SuppressionManagerView] onCancelAdd');
              setAddingNew(false);
            }}
            onFindingClick={(findingId) => {
              console.log('[SuppressionManagerView] onFindingClick:', findingId);
            }}
            onNavigateDashboard={() => {
              console.log('[SuppressionManagerView] onNavigateDashboard');
            }}
          />
        </div>
      </section>
    </div>
  );
}
