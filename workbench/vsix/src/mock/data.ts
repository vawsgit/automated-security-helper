import type { Project, ScanSummary, FindingRow, DispositionSummary, Severity, Disposition } from '../models/types';

const mockProject: Project = {
  id: 'proj-001',
  name: 'my-web-app',
  rootPath: '/home/user/projects/my-web-app',
};

const mockScans: ScanSummary[] = [
  {
    id: 'scan-001',
    projectId: 'proj-001',
    status: 'COMPLETED',
    startedAt: '2026-03-12T14:30:00Z',
    completedAt: '2026-03-12T14:35:22Z',
    sourceDirectory: '/src',
    findingCount: 18,
    severityCounts: { CRITICAL: 2, HIGH: 4, MEDIUM: 6, LOW: 4, INFO: 2 },
  },
  {
    id: 'scan-002',
    projectId: 'proj-001',
    status: 'COMPLETED',
    startedAt: '2026-03-11T10:00:00Z',
    completedAt: '2026-03-11T10:04:15Z',
    sourceDirectory: '/src',
    findingCount: 12,
    severityCounts: { CRITICAL: 1, HIGH: 3, MEDIUM: 4, LOW: 3, INFO: 1 },
  },
  {
    id: 'scan-003',
    projectId: 'proj-001',
    status: 'FAILED',
    startedAt: '2026-03-10T16:45:00Z',
    sourceDirectory: '/src',
    findingCount: 0,
    severityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
  },
  {
    id: 'scan-004',
    projectId: 'proj-001',
    status: 'RUNNING',
    startedAt: '2026-03-12T15:00:00Z',
    sourceDirectory: '/src',
    findingCount: 0,
    severityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
  },
];

const mockFindings: FindingRow[] = [
  {
    id: 'f-001', scanId: 'scan-001',
    title: 'Hard-coded AWS access key',
    description: 'A hard-coded AWS access key was detected. This could allow unauthorized access to AWS resources if the source code is exposed.',
    severity: 'CRITICAL', disposition: 'PENDING', scanner: 'detect-secrets', ruleId: 'AWSKeyDetector',
    filePath: 'src/config/aws.ts', startLine: 15, endLine: 15,
    codeSnippet: 'const ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-002', scanId: 'scan-001',
    title: 'SQL injection vulnerability',
    description: 'User input is concatenated directly into a SQL query string without sanitization, enabling SQL injection attacks.',
    severity: 'CRITICAL', disposition: 'FIX', scanner: 'semgrep', ruleId: 'javascript.lang.security.audit.sqli',
    filePath: 'src/api/users.ts', startLine: 42, endLine: 44,
    codeSnippet: 'const query = `SELECT * FROM users WHERE id = ${req.params.id}`;',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-003', scanId: 'scan-001',
    title: 'Cross-site scripting (XSS) via innerHTML',
    description: 'Setting innerHTML with unsanitized user data can lead to XSS attacks.',
    severity: 'HIGH', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.browser.security.innerHTML',
    filePath: 'src/components/Comment.tsx', startLine: 28, endLine: 30,
    codeSnippet: 'element.innerHTML = userComment;',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-004', scanId: 'scan-001',
    title: 'Insecure HTTP used for API endpoint',
    description: 'API endpoint uses HTTP instead of HTTPS, transmitting data in cleartext.',
    severity: 'HIGH', disposition: 'FIX', scanner: 'semgrep', ruleId: 'javascript.lang.security.insecure-transport',
    filePath: 'src/api/config.ts', startLine: 8, endLine: 8,
    codeSnippet: 'const API_URL = "http://api.example.com/v1";',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-005', scanId: 'scan-001',
    title: 'Missing authentication on admin route',
    description: 'Admin API route lacks authentication middleware, allowing unauthenticated access.',
    severity: 'HIGH', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.express.security.missing-auth',
    filePath: 'src/routes/admin.ts', startLine: 12, endLine: 14,
    codeSnippet: 'router.get("/admin/users", async (req, res) => {',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-006', scanId: 'scan-001',
    title: 'Known vulnerable dependency: lodash@4.17.20',
    description: 'lodash version 4.17.20 has known prototype pollution vulnerability (CVE-2021-23337).',
    severity: 'HIGH', disposition: 'DEFER', scanner: 'grype', ruleId: 'CVE-2021-23337',
    filePath: 'package.json', startLine: 25, endLine: 25,
    codeSnippet: '"lodash": "4.17.20"',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-007', scanId: 'scan-001',
    title: 'Checkov: S3 bucket without encryption',
    description: 'S3 bucket resource does not have server-side encryption enabled.',
    severity: 'MEDIUM', disposition: 'FIX', scanner: 'checkov', ruleId: 'CKV_AWS_19',
    filePath: 'infra/s3.tf', startLine: 5, endLine: 12,
    codeSnippet: 'resource "aws_s3_bucket" "data" {\n  bucket = "my-data-bucket"\n}',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-008', scanId: 'scan-001',
    title: 'Weak cryptographic algorithm: MD5',
    description: 'MD5 is cryptographically broken and should not be used for security purposes.',
    severity: 'MEDIUM', disposition: 'PENDING', scanner: 'bandit', ruleId: 'B303',
    filePath: 'src/utils/hash.py', startLine: 7, endLine: 7,
    codeSnippet: 'digest = hashlib.md5(data).hexdigest()',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-009', scanId: 'scan-001',
    title: 'CloudFormation: Security group allows ingress from 0.0.0.0/0',
    description: 'Security group rule allows inbound traffic from any IP address.',
    severity: 'MEDIUM', disposition: 'SUPPRESS', scanner: 'cfn-nag', ruleId: 'W9',
    filePath: 'infra/template.yaml', startLine: 45, endLine: 52,
    codeSnippet: 'CidrIp: 0.0.0.0/0',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-010', scanId: 'scan-001',
    title: 'Insecure random number generator',
    description: 'Math.random() is not cryptographically secure. Use crypto.getRandomValues() for security-sensitive operations.',
    severity: 'MEDIUM', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.lang.security.insecure-random',
    filePath: 'src/auth/token.ts', startLine: 19, endLine: 19,
    codeSnippet: 'const token = Math.random().toString(36).substring(2);',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-011', scanId: 'scan-001',
    title: 'CDK: RDS instance without deletion protection',
    description: 'RDS instance does not have deletion protection enabled.',
    severity: 'MEDIUM', disposition: 'DEFER', scanner: 'cdk-nag', ruleId: 'AwsSolutions-RDS10',
    filePath: 'infra/lib/database-stack.ts', startLine: 30, endLine: 38,
    codeSnippet: 'new rds.DatabaseInstance(this, "Database", {',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-012', scanId: 'scan-001',
    title: 'npm audit: high severity in express',
    description: 'express package has a known high-severity vulnerability in path-to-regexp dependency.',
    severity: 'MEDIUM', disposition: 'PENDING', scanner: 'npm-audit', ruleId: 'GHSA-9wv6-86v2-598j',
    filePath: 'package-lock.json', startLine: 1, endLine: 1,
    codeSnippet: '"path-to-regexp": "0.1.7"',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-013', scanId: 'scan-001',
    title: 'Console.log left in production code',
    description: 'Console.log statements should be removed from production code to prevent information leakage.',
    severity: 'LOW', disposition: 'FIX', scanner: 'semgrep', ruleId: 'javascript.lang.best-practice.no-console',
    filePath: 'src/api/middleware.ts', startLine: 55, endLine: 55,
    codeSnippet: 'console.log("Request body:", JSON.stringify(req.body));',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-014', scanId: 'scan-001',
    title: 'Missing CORS configuration',
    description: 'Express app does not configure CORS headers. Consider adding explicit CORS policy.',
    severity: 'LOW', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.express.best-practice.cors',
    filePath: 'src/app.ts', startLine: 10, endLine: 10,
    codeSnippet: 'const app = express();',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-015', scanId: 'scan-001',
    title: 'Hardcoded port number',
    description: 'Port number is hardcoded. Use environment variables for configuration.',
    severity: 'LOW', disposition: 'SUPPRESS', scanner: 'semgrep', ruleId: 'javascript.lang.best-practice.hardcoded-config',
    filePath: 'src/server.ts', startLine: 3, endLine: 3,
    codeSnippet: 'const PORT = 3000;',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-016', scanId: 'scan-001',
    title: 'Unused npm dependency: moment',
    description: 'The moment package is declared as a dependency but not imported anywhere in the codebase.',
    severity: 'LOW', disposition: 'PENDING', scanner: 'npm-audit', ruleId: 'unused-dependency',
    filePath: 'package.json', startLine: 18, endLine: 18,
    codeSnippet: '"moment": "^2.29.4"',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-017', scanId: 'scan-001',
    title: 'TODO comment references security fix',
    description: 'A TODO comment references a pending security fix that should be addressed.',
    severity: 'INFO', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.lang.best-practice.todo-security',
    filePath: 'src/auth/login.ts', startLine: 88, endLine: 88,
    codeSnippet: '// TODO: implement rate limiting to prevent brute force',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z', aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-018', scanId: 'scan-001',
    title: 'Permissive file permissions in Dockerfile',
    description: 'Dockerfile sets overly permissive file permissions (777).',
    severity: 'INFO', disposition: 'PENDING', scanner: 'checkov', ruleId: 'CKV_DOCKER_7',
    filePath: 'Dockerfile', startLine: 12, endLine: 12,
    codeSnippet: 'RUN chmod 777 /app/data',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z', aiAnalysis: null, suppression: null,
  },
];

// Mutable copy for in-memory disposition updates
let findingsState = mockFindings.map(f => ({ ...f }));

export function getMockProject(): Project {
  return mockProject;
}

export function getMockScans(): ScanSummary[] {
  return mockScans;
}

export function getMockFindings(scanId: string): FindingRow[] {
  return findingsState.filter(f => f.scanId === scanId);
}

export function getMockFindingDetail(findingId: string): FindingRow | undefined {
  return findingsState.find(f => f.id === findingId);
}

export function getMockSummary(): DispositionSummary {
  const findings = findingsState.filter(f => f.scanId === 'scan-001');
  const counts: Record<Disposition, number> = { PENDING: 0, FIX: 0, SUPPRESS: 0, DEFER: 0 };
  for (const f of findings) {
    counts[f.disposition]++;
  }
  return { total: findings.length, counts };
}

export function updateDisposition(findingId: string, disposition: Disposition): FindingRow | undefined {
  const finding = findingsState.find(f => f.id === findingId);
  if (finding) {
    finding.disposition = disposition;
  }
  return finding;
}

export function getSeverityCounts(scanId: string): Record<Severity, number> {
  const findings = findingsState.filter(f => f.scanId === scanId);
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findings) {
    counts[f.severity]++;
  }
  return counts;
}
