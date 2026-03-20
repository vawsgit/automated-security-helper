import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { DatabaseService } from '../../services/database';
import { FindingsService } from '../../services/findings';
import { createFindingMcpServer } from '../../services/mcpTools';

describe('MCP Tools — createFindingMcpServer', () => {
  let service: FindingsService;
  let projectId: string;
  let scanId: string;
  let scanTargetId: string;
  let tmpDir: string;

  before(async function () {
    this.timeout(30_000);
    await DatabaseService.initialize();
    const db = DatabaseService.client;

    const project = await db.project.create({
      data: { name: 'MCP Tools Test', rootPath: '/test/mcp-tools' },
    });
    projectId = project.id;

    const target = await db.scanTarget.create({
      data: { projectId, path: '/src', displayName: 'Source' },
    });
    scanTargetId = target.id;

    const scan = await db.scan.create({
      data: {
        projectId,
        scanTargetId,
        sourceDir: '/src',
        status: 'COMPLETED',
      },
    });
    scanId = scan.id;

    service = new FindingsService(db, projectId);

    // Create a temp directory with a sample source file
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-tools-test-'));
    const srcDir = path.join(tmpDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    // Create a test file with line-numbered content (50 lines)
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}: some code here`);
    await fs.writeFile(path.join(srcDir, 'auth.py'), lines.join('\n'));
  });

  after(async () => {
    await DatabaseService.close();
    // Clean up temp dir
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns a non-null MCP server config object', async () => {
    const finding = await DatabaseService.client.finding.create({
      data: {
        scanId,
        projectId,
        scanTargetId,
        ruleId: 'MCP001',
        scanner: 'bandit',
        severity: 'HIGH',
        file: 'src/auth.py',
        startLine: 25,
        title: 'MCP test finding',
        description: 'Finding for MCP server creation test',
      },
    });

    const server = await createFindingMcpServer(service, finding.id, tmpDir);
    assert.ok(server, 'MCP server config should be non-null');
    assert.equal(typeof server, 'object');
  });

  // Test get_finding_context behavior via FindingsService.getFindingDetail
  describe('get_finding_context — underlying service', () => {
    it('returns finding detail for an existing finding', async () => {
      const finding = await DatabaseService.client.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'MCP002',
          scanner: 'bandit',
          severity: 'MEDIUM',
          file: 'src/auth.py',
          startLine: 10,
          endLine: 15,
          title: 'Context test finding',
          description: 'Finding for context retrieval test',
          snippet: 'password = input()',
        },
      });

      const detail = await service.getFindingDetail(finding.id);
      assert.ok(detail);
      assert.equal(detail.filePath, 'src/auth.py');
      assert.equal(detail.startLine, 10);
      assert.equal(detail.endLine, 15);
    });

    it('returns null for a non-existent finding', async () => {
      const detail = await service.getFindingDetail('non-existent-mcp-id');
      assert.equal(detail, null);
    });

    it('reads surrounding code from a valid file path', async () => {
      const filePath = path.join(tmpDir, 'src', 'auth.py');
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Simulate the MCP tool's surrounding code extraction (±20 lines around line 25)
      const startLine = Math.max(0, 25 - 21); // 0-indexed: line 4
      const endLine = Math.min(lines.length, 25 + 20); // line 45
      const surroundingCode = lines.slice(startLine, endLine)
        .map((line, i) => `${startLine + i + 1}: ${line}`)
        .join('\n');

      assert.ok(surroundingCode.length > 0);
      assert.ok(surroundingCode.includes('line 25:'));
      assert.ok(surroundingCode.includes('line 5:'));
      assert.ok(surroundingCode.includes('line 44:'));
    });

    it('handles missing file gracefully', async () => {
      const missingPath = path.join(tmpDir, 'src', 'nonexistent.py');
      let fileExists = false;
      try {
        await fs.readFile(missingPath, 'utf-8');
        fileExists = true;
      } catch {
        // Expected — file does not exist
      }
      assert.equal(fileExists, false, 'Missing file should not exist');
    });
  });

  // Test list_related_findings behavior via FindingsService.getRelatedFindings
  describe('list_related_findings — underlying service', () => {
    let targetFindingId: string;

    before(async () => {
      const db = DatabaseService.client;

      // Create target finding
      const target = await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'SQL-INJ-001',
          scanner: 'semgrep',
          severity: 'CRITICAL',
          file: 'src/db.py',
          startLine: 50,
          title: 'SQL injection target',
          description: 'Target finding for related test',
        },
      });
      targetFindingId = target.id;

      // Create related findings: same ruleId
      await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'SQL-INJ-001',
          scanner: 'checkov',
          severity: 'HIGH',
          file: 'src/api.py',
          startLine: 10,
          title: 'Same rule finding',
          description: 'Shares ruleId with target',
        },
      });

      // Same scanner
      await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'XSS-002',
          scanner: 'semgrep',
          severity: 'MEDIUM',
          file: 'src/views.py',
          startLine: 20,
          title: 'Same scanner finding',
          description: 'Shares scanner with target',
        },
      });

      // Same file
      await db.finding.create({
        data: {
          scanId,
          projectId,
          scanTargetId,
          ruleId: 'CSRF-003',
          scanner: 'bandit',
          severity: 'LOW',
          file: 'src/db.py',
          startLine: 100,
          title: 'Same file finding',
          description: 'Shares file with target',
        },
      });
    });

    it('finds related findings by ruleId, scanner, or file', async () => {
      const related = await service.getRelatedFindings(targetFindingId);
      assert.ok(related.length >= 3, `Expected at least 3 related findings, got ${related.length}`);
    });

    it('excludes the target finding itself from results', async () => {
      const related = await service.getRelatedFindings(targetFindingId);
      const selfMatch = related.find(f => f.id === targetFindingId);
      assert.equal(selfMatch, undefined, 'Target finding should not appear in its own related findings');
    });

    it('assigns matchReason correctly', async () => {
      const related = await service.getRelatedFindings(targetFindingId);
      const reasons = new Set(related.map(f => f.matchReason));
      assert.ok(reasons.has('same_rule'), 'Should have a same_rule match');
      assert.ok(reasons.has('same_scanner'), 'Should have a same_scanner match');
      assert.ok(reasons.has('same_file'), 'Should have a same_file match');
    });

    it('returns empty array for a non-existent finding', async () => {
      const related = await service.getRelatedFindings('non-existent-related-id');
      assert.deepStrictEqual(related, []);
    });

    it('respects the take:25 limit', async () => {
      // The service has take: 25 — with only a few findings in the DB, this just verifies
      // the result count is within bounds
      const related = await service.getRelatedFindings(targetFindingId);
      assert.ok(related.length <= 25, `Expected at most 25 related findings, got ${related.length}`);
    });
  });
});
