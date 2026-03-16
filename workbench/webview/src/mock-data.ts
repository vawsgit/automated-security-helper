/**
 * Mock data for the ASH Workbench UI prototype.
 *
 * This file provides hardcoded data for all views during the mock phase.
 * When the backend connects, these imports will be replaced by data received
 * via postMessage from the extension host.
 */
import type {
  Project,
  ScanSummary,
  ScanTarget,
  FindingRow,
  DispositionSummary,
  AiAnalysis,
  SuppressionData,
  Disposition,
  Severity,
} from './types/types';

// --- AI Analysis mock data ---

const aiAnalysisHardCodedKey: AiAnalysis = {
  explanation:
    'This finding detects a hard-coded AWS access key in the source code. Hard-coded credentials are a critical security risk because anyone with access to the source code (including version control history) can use these credentials to access AWS resources. Even if the key is rotated, the exposure window can be significant.',
  riskAssessment: {
    exploitability: 'HIGH',
    exploitabilityRationale: 'The key is directly visible in plain text and can be used immediately by anyone with repository access.',
    impact: 'CRITICAL',
    impactRationale: 'AWS access keys can provide broad access to cloud resources, potentially leading to data exfiltration, resource abuse, or complete account takeover.',
    likelihood: 'HIGH',
    likelihoodRationale: 'Hard-coded keys in source repositories are frequently discovered through automated scanning of public and internal repositories.',
  },
  suggestedFix: {
    description: 'Replace the hard-coded key with an environment variable or AWS Secrets Manager reference.',
    diffText: `- const ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
+ const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;`,
    language: 'typescript',
  },
  references: [
    { title: 'AWS Security Best Practices', url: 'https://docs.aws.amazon.com/general/latest/gr/aws-access-keys-best-practices.html' },
    { title: 'CWE-798: Use of Hard-coded Credentials', url: 'https://cwe.mitre.org/data/definitions/798.html' },
  ],
};

const aiAnalysisSqlInjection: AiAnalysis = {
  explanation:
    'This code constructs a SQL query by directly interpolating user-supplied input (req.params.id) into the query string. This pattern is vulnerable to SQL injection, where an attacker can manipulate the query to access unauthorized data, modify the database, or execute administrative operations.',
  riskAssessment: {
    exploitability: 'CRITICAL',
    exploitabilityRationale: 'SQL injection is one of the most well-known and easily exploitable vulnerabilities. Automated tools can detect and exploit this within seconds.',
    impact: 'CRITICAL',
    impactRationale: 'Successful exploitation can lead to full database access, data theft, data modification, and in some cases remote code execution on the database server.',
    likelihood: 'HIGH',
    likelihoodRationale: 'This is a public-facing API endpoint that accepts user input directly in the URL path.',
  },
  suggestedFix: {
    description: 'Use parameterized queries to prevent SQL injection.',
    diffText: `- const query = \`SELECT * FROM users WHERE id = \${req.params.id}\`;
+ const query = 'SELECT * FROM users WHERE id = $1';
+ const result = await db.query(query, [req.params.id]);`,
    language: 'typescript',
  },
  references: [
    { title: 'OWASP SQL Injection Prevention', url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html' },
    { title: 'CWE-89: SQL Injection', url: 'https://cwe.mitre.org/data/definitions/89.html' },
  ],
};

const aiAnalysisXss: AiAnalysis = {
  explanation:
    'Setting innerHTML with unsanitized user data creates a Cross-Site Scripting (XSS) vulnerability. An attacker can inject malicious scripts that execute in the context of other users\' sessions, potentially stealing cookies, session tokens, or performing actions on their behalf.',
  riskAssessment: {
    exploitability: 'HIGH',
    exploitabilityRationale: 'XSS via innerHTML is straightforward to exploit by injecting script tags or event handlers in the user comment.',
    impact: 'HIGH',
    impactRationale: 'Stored XSS can affect every user who views the comment, enabling session hijacking, credential theft, and phishing.',
    likelihood: 'HIGH',
    likelihoodRationale: 'Comments are user-generated content displayed to other users, making this a high-value target for attackers.',
  },
  suggestedFix: {
    description: 'Use textContent instead of innerHTML, or use a sanitization library like DOMPurify.',
    diffText: `- element.innerHTML = userComment;
+ element.textContent = userComment;
+ // Or use DOMPurify: element.innerHTML = DOMPurify.sanitize(userComment);`,
    language: 'typescript',
  },
  references: [
    { title: 'OWASP XSS Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html' },
    { title: 'CWE-79: Cross-site Scripting', url: 'https://cwe.mitre.org/data/definitions/79.html' },
  ],
};

const aiAnalysisS3: AiAnalysis = {
  explanation:
    'This S3 bucket resource is created without server-side encryption. Data stored in unencrypted S3 buckets is vulnerable to unauthorized access if bucket permissions are misconfigured or if an attacker gains access to the AWS account.',
  riskAssessment: {
    exploitability: 'MEDIUM',
    exploitabilityRationale: 'Requires access to the AWS account or a bucket policy misconfiguration to exploit.',
    impact: 'MEDIUM',
    impactRationale: 'Depends on the sensitivity of data stored in the bucket. Could range from low (public assets) to critical (PII, credentials).',
    likelihood: 'MEDIUM',
    likelihoodRationale: 'S3 bucket misconfigurations are common and frequently targeted by automated scanners.',
  },
  suggestedFix: {
    description: 'Enable server-side encryption with AES-256 or AWS KMS.',
    diffText: `  resource "aws_s3_bucket" "data" {
    bucket = "my-data-bucket"
+   server_side_encryption_configuration {
+     rule {
+       apply_server_side_encryption_by_default {
+         sse_algorithm = "aws:kms"
+       }
+     }
+   }
  }`,
    language: 'hcl',
  },
  references: [
    { title: 'AWS S3 Encryption', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-encryption.html' },
  ],
};

// --- Suppression mock data ---

const suppressionSecurityGroup: SuppressionData = {
  justification: 'This security group is for a public-facing load balancer that intentionally accepts traffic from all IP addresses. Access is further restricted by application-level authentication and WAF rules.',
  yamlEntry: `rules:
  - id: W9
    reason: "Public ALB - ingress from 0.0.0.0/0 is intentional"
    file: infra/template.yaml
    lines: 45-52
    expires: "2026-06-12"`,
  expiresAt: '2026-06-12',
  createdAt: '2026-03-12T14:35:00Z',
};

const suppressionHardcodedPort: SuppressionData = {
  justification: 'This is a development server configuration. The production deployment uses environment variables via the container orchestrator. The hardcoded port is only used for local development.',
  yamlEntry: `rules:
  - id: javascript.lang.best-practice.hardcoded-config
    reason: "Dev-only default port, overridden in production"
    file: src/server.ts
    lines: 3`,
  expiresAt: null,
  createdAt: '2026-03-12T14:36:00Z',
};

// --- Findings ---
// Scan target st-001: workspace root (my-web-app)

const rootFindings: FindingRow[] = [
  {
    id: 'f-001', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Hard-coded AWS access key',
    description: 'A hard-coded AWS access key was detected. This could allow unauthorized access to AWS resources if the source code is exposed.',
    severity: 'CRITICAL', disposition: 'PENDING', scanner: 'detect-secrets', ruleId: 'AWSKeyDetector',
    filePath: 'src/config/aws.ts', startLine: 15, endLine: 15,
    codeSnippet: 'const ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: aiAnalysisHardCodedKey, suppression: null,
  },
  {
    id: 'f-002', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'SQL injection vulnerability',
    description: 'User input is concatenated directly into a SQL query string without sanitization, enabling SQL injection attacks.',
    severity: 'CRITICAL', disposition: 'FIX', scanner: 'semgrep', ruleId: 'javascript.lang.security.audit.sqli',
    filePath: 'src/api/users.ts', startLine: 42, endLine: 44,
    codeSnippet: 'const query = `SELECT * FROM users WHERE id = ${req.params.id}`;',
    notes: 'Migrating to parameterized queries in sprint 24.', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: aiAnalysisSqlInjection, suppression: null,
  },
  {
    id: 'f-003', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Cross-site scripting (XSS) via innerHTML',
    description: 'Setting innerHTML with unsanitized user data can lead to XSS attacks.',
    severity: 'HIGH', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.browser.security.innerHTML',
    filePath: 'src/components/Comment.tsx', startLine: 28, endLine: 30,
    codeSnippet: 'element.innerHTML = userComment;',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: aiAnalysisXss, suppression: null,
  },
  {
    id: 'f-004', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Insecure HTTP used for API endpoint',
    description: 'API endpoint uses HTTP instead of HTTPS, transmitting data in cleartext.',
    severity: 'HIGH', disposition: 'FIX', scanner: 'semgrep', ruleId: 'javascript.lang.security.insecure-transport',
    filePath: 'src/api/config.ts', startLine: 8, endLine: 8,
    codeSnippet: 'const API_URL = "http://api.example.com/v1";',
    notes: 'Switching to HTTPS in the config refactor.', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-005', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Missing authentication on admin route',
    description: 'Admin API route lacks authentication middleware, allowing unauthenticated access.',
    severity: 'HIGH', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.express.security.missing-auth',
    filePath: 'src/routes/admin.ts', startLine: 12, endLine: 14,
    codeSnippet: 'router.get("/admin/users", async (req, res) => {',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-006', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Known vulnerable dependency: lodash@4.17.20',
    description: 'lodash version 4.17.20 has known prototype pollution vulnerability (CVE-2021-23337).',
    severity: 'HIGH', disposition: 'DEFER', scanner: 'grype', ruleId: 'CVE-2021-23337',
    filePath: 'package.json', startLine: 25, endLine: 25,
    codeSnippet: '"lodash": "4.17.20"',
    notes: 'Waiting on lodash v5 release before upgrading.', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-007', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Checkov: S3 bucket without encryption',
    description: 'S3 bucket resource does not have server-side encryption enabled.',
    severity: 'MEDIUM', disposition: 'FIX', scanner: 'checkov', ruleId: 'CKV_AWS_19',
    filePath: 'infra/s3.tf', startLine: 5, endLine: 12,
    codeSnippet: 'resource "aws_s3_bucket" "data" {\n  bucket = "my-data-bucket"\n}',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: aiAnalysisS3, suppression: null,
  },
  {
    id: 'f-008', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Weak cryptographic algorithm: MD5',
    description: 'MD5 is cryptographically broken and should not be used for security purposes.',
    severity: 'MEDIUM', disposition: 'PENDING', scanner: 'bandit', ruleId: 'B303',
    filePath: 'src/utils/hash.py', startLine: 7, endLine: 7,
    codeSnippet: 'digest = hashlib.md5(data).hexdigest()',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-009', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'CloudFormation: Security group allows ingress from 0.0.0.0/0',
    description: 'Security group rule allows inbound traffic from any IP address.',
    severity: 'MEDIUM', disposition: 'SUPPRESS', scanner: 'cfn-nag', ruleId: 'W9',
    filePath: 'infra/template.yaml', startLine: 45, endLine: 52,
    codeSnippet: 'CidrIp: 0.0.0.0/0',
    notes: 'Public ALB - intentional.', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: null, suppression: suppressionSecurityGroup,
  },
  {
    id: 'f-010', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Insecure random number generator',
    description: 'Math.random() is not cryptographically secure. Use crypto.getRandomValues() for security-sensitive operations.',
    severity: 'MEDIUM', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.lang.security.insecure-random',
    filePath: 'src/auth/token.ts', startLine: 19, endLine: 19,
    codeSnippet: 'const token = Math.random().toString(36).substring(2);',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-011', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'CDK: RDS instance without deletion protection',
    description: 'RDS instance does not have deletion protection enabled.',
    severity: 'MEDIUM', disposition: 'DEFER', scanner: 'cdk-nag', ruleId: 'AwsSolutions-RDS10',
    filePath: 'infra/lib/database-stack.ts', startLine: 30, endLine: 38,
    codeSnippet: 'new rds.DatabaseInstance(this, "Database", {',
    notes: 'Will enable after migration to production stack.', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-012', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'npm audit: high severity in express',
    description: 'express package has a known high-severity vulnerability in path-to-regexp dependency.',
    severity: 'MEDIUM', disposition: 'PENDING', scanner: 'npm-audit', ruleId: 'GHSA-9wv6-86v2-598j',
    filePath: 'package-lock.json', startLine: 1, endLine: 1,
    codeSnippet: '"path-to-regexp": "0.1.7"',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-013', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Console.log left in production code',
    description: 'Console.log statements should be removed from production code to prevent information leakage.',
    severity: 'LOW', disposition: 'FIX', scanner: 'semgrep', ruleId: 'javascript.lang.best-practice.no-console',
    filePath: 'src/api/middleware.ts', startLine: 55, endLine: 55,
    codeSnippet: 'console.log("Request body:", JSON.stringify(req.body));',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-014', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Missing CORS configuration',
    description: 'Express app does not configure CORS headers. Consider adding explicit CORS policy.',
    severity: 'LOW', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.express.best-practice.cors',
    filePath: 'src/app.ts', startLine: 10, endLine: 10,
    codeSnippet: 'const app = express();',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-015', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Hardcoded port number',
    description: 'Port number is hardcoded. Use environment variables for configuration.',
    severity: 'LOW', disposition: 'SUPPRESS', scanner: 'semgrep', ruleId: 'javascript.lang.best-practice.hardcoded-config',
    filePath: 'src/server.ts', startLine: 3, endLine: 3,
    codeSnippet: 'const PORT = 3000;',
    notes: 'Dev-only default.', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: null, suppression: suppressionHardcodedPort,
  },
  {
    id: 'f-016', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Unused npm dependency: moment',
    description: 'The moment package is declared as a dependency but not imported anywhere in the codebase.',
    severity: 'LOW', disposition: 'PENDING', scanner: 'npm-audit', ruleId: 'unused-dependency',
    filePath: 'package.json', startLine: 18, endLine: 18,
    codeSnippet: '"moment": "^2.29.4"',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-017', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'TODO comment references security fix',
    description: 'A TODO comment references a pending security fix that should be addressed.',
    severity: 'INFO', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'javascript.lang.best-practice.todo-security',
    filePath: 'src/auth/login.ts', startLine: 88, endLine: 88,
    codeSnippet: '// TODO: implement rate limiting to prevent brute force',
    notes: '', firstDetectedAt: '2026-03-11T10:02:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'f-018', scanId: 'scan-001', scanTargetId: 'st-001',
    title: 'Permissive file permissions in Dockerfile',
    description: 'Dockerfile sets overly permissive file permissions (777).',
    severity: 'INFO', disposition: 'PENDING', scanner: 'checkov', ruleId: 'CKV_DOCKER_7',
    filePath: 'Dockerfile', startLine: 12, endLine: 12,
    codeSnippet: 'RUN chmod 777 /app/data',
    notes: '', firstDetectedAt: '2026-03-12T14:32:00Z',
    aiAnalysis: null, suppression: null,
  },
];

// Scan target st-002: backend (Python Flask API)

const backendFindings: FindingRow[] = [
  {
    id: 'fb-001', scanId: 'scan-006', scanTargetId: 'st-002',
    title: 'Use of eval() with user input',
    description: 'eval() is called with user-controlled data, allowing arbitrary code execution.',
    severity: 'CRITICAL', disposition: 'FIX', scanner: 'bandit', ruleId: 'B307',
    filePath: 'api/handlers/transform.py', startLine: 45, endLine: 45,
    codeSnippet: 'result = eval(request.json["expression"])',
    notes: 'Replacing with ast.literal_eval.', firstDetectedAt: '2026-03-10T09:15:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'fb-002', scanId: 'scan-006', scanTargetId: 'st-002',
    title: 'Open redirect vulnerability',
    description: 'User-supplied URL is used for redirect without validation.',
    severity: 'HIGH', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'python.flask.security.open-redirect',
    filePath: 'api/auth/callback.py', startLine: 32, endLine: 34,
    codeSnippet: 'return redirect(request.args.get("next", "/"))',
    notes: '', firstDetectedAt: '2026-03-10T09:15:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'fb-003', scanId: 'scan-006', scanTargetId: 'st-002',
    title: 'Flask debug mode enabled',
    description: 'Flask application runs with debug=True in a configuration that may reach production.',
    severity: 'MEDIUM', disposition: 'PENDING', scanner: 'bandit', ruleId: 'B201',
    filePath: 'api/app.py', startLine: 89, endLine: 89,
    codeSnippet: 'app.run(debug=True, host="0.0.0.0")',
    notes: '', firstDetectedAt: '2026-03-10T09:15:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'fb-004', scanId: 'scan-006', scanTargetId: 'st-002',
    title: 'Missing rate limiting on login endpoint',
    description: 'Login endpoint accepts unlimited requests, enabling brute force attacks.',
    severity: 'LOW', disposition: 'DEFER', scanner: 'semgrep', ruleId: 'python.flask.best-practice.rate-limit',
    filePath: 'api/auth/login.py', startLine: 15, endLine: 22,
    codeSnippet: '@app.route("/login", methods=["POST"])',
    notes: 'Will add rate limiting with Redis in Q2.', firstDetectedAt: '2026-03-10T09:15:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'fb-005', scanId: 'scan-006', scanTargetId: 'st-002',
    title: 'Deprecated Flask-Login API usage',
    description: 'Code uses a deprecated Flask-Login method that will be removed in v1.0.',
    severity: 'INFO', disposition: 'PENDING', scanner: 'semgrep', ruleId: 'python.flask.deprecated.flask-login',
    filePath: 'api/auth/utils.py', startLine: 8, endLine: 8,
    codeSnippet: 'from flask_login import _user_context_processor',
    notes: '', firstDetectedAt: '2026-03-13T11:00:00Z',
    aiAnalysis: null, suppression: null,
  },
];

// Scan target st-003: infra (Terraform/CloudFormation)

const infraFindings: FindingRow[] = [
  {
    id: 'fi-001', scanId: 'scan-005', scanTargetId: 'st-003',
    title: 'IAM policy with wildcard actions',
    description: 'IAM policy grants * (all) actions, violating principle of least privilege.',
    severity: 'HIGH', disposition: 'PENDING', scanner: 'checkov', ruleId: 'CKV_AWS_1',
    filePath: 'iam/policies.tf', startLine: 12, endLine: 18,
    codeSnippet: '"Action": "*"',
    notes: '', firstDetectedAt: '2026-03-09T16:00:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'fi-002', scanId: 'scan-005', scanTargetId: 'st-003',
    title: 'CloudWatch log group not encrypted',
    description: 'CloudWatch log group does not use KMS encryption for data at rest.',
    severity: 'MEDIUM', disposition: 'PENDING', scanner: 'cfn-nag', ruleId: 'W84',
    filePath: 'monitoring/logs.yaml', startLine: 8, endLine: 14,
    codeSnippet: 'Type: AWS::Logs::LogGroup',
    notes: '', firstDetectedAt: '2026-03-09T16:00:00Z',
    aiAnalysis: null, suppression: null,
  },
  {
    id: 'fi-003', scanId: 'scan-005', scanTargetId: 'st-003',
    title: 'Resources missing required tags',
    description: 'Multiple resources do not have required cost-tracking and ownership tags.',
    severity: 'LOW', disposition: 'PENDING', scanner: 'checkov', ruleId: 'CKV_AWS_153',
    filePath: 'main.tf', startLine: 1, endLine: 5,
    codeSnippet: 'resource "aws_vpc" "main" {',
    notes: '', firstDetectedAt: '2026-03-09T16:00:00Z',
    aiAnalysis: null, suppression: null,
  },
];

// --- All findings combined ---

const baseFindings: FindingRow[] = [...rootFindings, ...backendFindings, ...infraFindings];

export const mockProject: Project = {
  id: 'proj-001',
  name: 'my-web-app',
  rootPath: '/home/user/projects/my-web-app',
};

export const mockScans: ScanSummary[] = [
  {
    id: 'scan-001', projectId: 'proj-001', scanTargetId: 'st-001', status: 'COMPLETED',
    startedAt: '2026-03-12T14:30:00Z', completedAt: '2026-03-12T14:35:22Z',
    sourceDirectory: '/home/user/projects/my-web-app', findingCount: 18,
    severityCounts: { CRITICAL: 2, HIGH: 4, MEDIUM: 6, LOW: 4, INFO: 2 },
  },
  {
    id: 'scan-002', projectId: 'proj-001', scanTargetId: 'st-001', status: 'COMPLETED',
    startedAt: '2026-03-11T10:00:00Z', completedAt: '2026-03-11T10:04:15Z',
    sourceDirectory: '/home/user/projects/my-web-app', findingCount: 12,
    severityCounts: { CRITICAL: 1, HIGH: 3, MEDIUM: 4, LOW: 3, INFO: 1 },
  },
  {
    id: 'scan-003', projectId: 'proj-001', scanTargetId: 'st-001', status: 'FAILED',
    startedAt: '2026-03-10T16:45:00Z',
    sourceDirectory: '/home/user/projects/my-web-app', findingCount: 0,
    severityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
  },
  {
    id: 'scan-004', projectId: 'proj-001', scanTargetId: 'st-001', status: 'RUNNING',
    startedAt: '2026-03-12T15:00:00Z',
    sourceDirectory: '/home/user/projects/my-web-app', findingCount: 0,
    severityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
  },
  {
    id: 'scan-005', projectId: 'proj-001', scanTargetId: 'st-003', status: 'COMPLETED',
    startedAt: '2026-03-09T16:00:00Z', completedAt: '2026-03-09T16:02:30Z',
    sourceDirectory: '/home/user/projects/my-web-app/infra', findingCount: 3,
    severityCounts: { CRITICAL: 0, HIGH: 1, MEDIUM: 1, LOW: 1, INFO: 0 },
  },
  {
    id: 'scan-006', projectId: 'proj-001', scanTargetId: 'st-002', status: 'COMPLETED',
    startedAt: '2026-03-13T11:00:00Z', completedAt: '2026-03-13T11:03:45Z',
    sourceDirectory: '/home/user/projects/my-web-app/backend', findingCount: 5,
    severityCounts: { CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 1, INFO: 1 },
  },
  {
    id: 'scan-007', projectId: 'proj-001', scanTargetId: 'st-002', status: 'COMPLETED',
    startedAt: '2026-03-10T09:15:00Z', completedAt: '2026-03-10T09:18:22Z',
    sourceDirectory: '/home/user/projects/my-web-app/backend', findingCount: 4,
    severityCounts: { CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 1, INFO: 0 },
  },
];

// Mutable copy for in-app state changes
export const mockFindings: FindingRow[] = baseFindings.map(f => ({ ...f }));

function computeSummary(findings: FindingRow[]): DispositionSummary {
  const counts: Record<Disposition, number> = { PENDING: 0, FIX: 0, SUPPRESS: 0, DEFER: 0 };
  for (const f of findings) {
    counts[f.disposition]++;
  }
  return { total: findings.length, counts };
}

function computeSeverityCounts(findings: FindingRow[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findings) {
    counts[f.severity]++;
  }
  return counts;
}

export const mockSummary: DispositionSummary = computeSummary(mockFindings);

// --- Scan Targets ---

function buildScanTarget(
  id: string,
  path: string,
  displayName: string,
  findings: FindingRow[],
  scans: ScanSummary[],
): ScanTarget {
  const targetFindings = findings.filter(f => f.scanTargetId === id);
  const targetScans = scans.filter(s => s.scanTargetId === id);
  const latestCompleted = targetScans
    .filter(s => s.status === 'COMPLETED' && s.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];

  return {
    id,
    path,
    displayName,
    lastScannedAt: latestCompleted?.completedAt,
    scanCount: targetScans.length,
    findingCount: targetFindings.length,
    severityCounts: computeSeverityCounts(targetFindings),
    triageSummary: computeSummary(targetFindings),
  };
}

export const mockScanTargets: ScanTarget[] = [
  buildScanTarget('st-001', '/home/user/projects/my-web-app', 'my-web-app', mockFindings, mockScans),
  buildScanTarget('st-002', '/home/user/projects/my-web-app/backend', 'backend', mockFindings, mockScans),
  buildScanTarget('st-003', '/home/user/projects/my-web-app/infra', 'infra', mockFindings, mockScans),
];

// --- Mutation helpers ---

export function updateMockDisposition(findings: FindingRow[], findingId: string, disposition: Disposition): FindingRow[] {
  return findings.map(f => f.id === findingId ? { ...f, disposition } : f);
}

export function updateMockNotes(findings: FindingRow[], findingId: string, notes: string): FindingRow[] {
  return findings.map(f => f.id === findingId ? { ...f, notes } : f);
}

export function recomputeScanTargets(findings: FindingRow[], scans: ScanSummary[]): ScanTarget[] {
  return [
    buildScanTarget('st-001', '/home/user/projects/my-web-app', 'my-web-app', findings, scans),
    buildScanTarget('st-002', '/home/user/projects/my-web-app/backend', 'backend', findings, scans),
    buildScanTarget('st-003', '/home/user/projects/my-web-app/infra', 'infra', findings, scans),
  ];
}
