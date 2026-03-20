import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { FindingsService } from './findings';

// Return type from createSdkMcpServer — mirrors McpSdkServerConfigWithInstance.
// We use Record<string, unknown> to avoid importing ESM-only SDK types at the top level.
type McpServerConfig = Record<string, unknown>;

/**
 * Creates an in-process MCP server that exposes finding-analysis tools
 * (get_finding_context, list_related_findings) to the Claude Agent SDK.
 *
 * Uses dynamic import because `@anthropic-ai/claude-agent-sdk` is ESM-only
 * and this project is CJS.
 */
export async function createFindingMcpServer(
  findingsService: FindingsService,
  _findingId: string,
  workspaceRoot: string,
): Promise<McpServerConfig> {
  const { z } = await import('zod');
  const sdk = await import('@anthropic-ai/claude-agent-sdk');

  const getFindingContextTool = sdk.tool(
    'get_finding_context',
    'Retrieve a security finding and its surrounding source code context',
    {
      findingId: z.string().describe('The unique ID of the finding to retrieve context for'),
    },
    async (args: { findingId: string }) => {
      const finding = await findingsService.getFindingDetail(args.findingId);
      if (!finding) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ finding: null, surroundingCode: '', fileExists: false }) }],
        };
      }

      let surroundingCode = '';
      let fileExists = false;

      const filePath = path.isAbsolute(finding.filePath)
        ? finding.filePath
        : path.join(workspaceRoot, finding.filePath);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        fileExists = true;
        const lines = content.split('\n');
        const startLine = Math.max(0, finding.startLine - 21); // 20 lines before (0-indexed)
        const endLine = Math.min(lines.length, (finding.endLine || finding.startLine) + 20);
        surroundingCode = lines.slice(startLine, endLine)
          .map((line, i) => `${startLine + i + 1}: ${line}`)
          .join('\n');
      } catch {
        // File does not exist or is unreadable — handled gracefully
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ finding, surroundingCode, fileExists }) }],
      };
    },
  );

  const listRelatedFindingsTool = sdk.tool(
    'list_related_findings',
    'Find related security findings that share the same rule, scanner, or file',
    {
      findingId: z.string().describe('The unique ID of the finding to find related findings for'),
    },
    async (args: { findingId: string }) => {
      const relatedFindings = await findingsService.getRelatedFindings(args.findingId);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ relatedFindings, totalCount: relatedFindings.length }) }],
      };
    },
  );

  return sdk.createSdkMcpServer({
    name: 'ash-finding-tools',
    tools: [getFindingContextTool, listRelatedFindingsTool],
  });
}
