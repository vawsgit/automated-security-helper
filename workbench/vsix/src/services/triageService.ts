import * as vscode from 'vscode';
import type { PrismaClient } from '@prisma/client';
import type { FindingsService } from './findings';
import type { AiService } from './aiService';
import type { AshYamlWriteService } from './ashYamlWrite';
import { buildTriagePrompt, parseTriageResponse } from './triagePromptBuilder';
import { computeTriageFingerprint, parseStoredTriageAnalysis } from '../models/mappers';
import type { StoredTriageAnalysis, TriageClassification, TriageMetadata, TriageSummary, TriageSeverityBreakdown, Severity } from '../models/triageTypes.js';
import type { SuppressionInput } from '../models/types';

export type TriageBatchStatus = 'running' | 'completed' | 'cancelled' | 'consecutive-failures' | 'error';

export interface TriageClassifyEvent {
  type: 'started' | 'progress' | 'result' | 'error' | 'complete';
}

export interface TriageStartedEvent extends TriageClassifyEvent {
  type: 'started';
  totalFindings: number;
  findingIds: string[];
}

export interface TriageProgressEvent extends TriageClassifyEvent {
  type: 'progress';
  currentIndex: number;
  totalFindings: number;
  currentFindingId: string;
  status: 'classifying' | 'skipped' | 'failed';
  message?: string;
}

export interface TriageResultEvent extends TriageClassifyEvent {
  type: 'result';
  findingId: string;
  analysis: TriageClassification;
  metadata: TriageMetadata;
}

export interface TriageErrorEvent extends TriageClassifyEvent {
  type: 'error';
  findingId: string;
  errorType: string;
  message: string;
}

export interface TriageCompleteEvent extends TriageClassifyEvent {
  type: 'complete';
  analyzedCount: number;
  failedCount: number;
  skippedCount: number;
  status: TriageBatchStatus;
}

export type TriageEvent =
  | TriageStartedEvent
  | TriageProgressEvent
  | TriageResultEvent
  | TriageErrorEvent
  | TriageCompleteEvent;

const SEVERITY_KEYS: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const CONSECUTIVE_FAILURE_LIMIT = 3;

export class TriageService implements vscode.Disposable {
  private batchAbortController: AbortController | undefined;

  constructor(
    private readonly db: PrismaClient,
    private readonly findingsService: FindingsService,
    private readonly aiService: AiService,
    private readonly ashYamlWriteService: AshYamlWriteService,
    private readonly workspaceRoot: string,
    private readonly outputChannel?: vscode.OutputChannel,
  ) {}

  async classifyFinding(
    findingId: string,
    onEvent: (event: TriageEvent) => void,
  ): Promise<void> {
    this.log(`Starting triage classification for ${findingId}`);

    try {
      const finding = await this.db.finding.findUnique({ where: { id: findingId } });
      if (!finding) {
        onEvent({ type: 'error', findingId, errorType: 'not_found', message: `Finding not found: ${findingId}` });
        return;
      }

      // Check cache via fingerprint
      const currentFingerprint = computeTriageFingerprint(finding);
      const stored = parseStoredTriageAnalysis((finding as Record<string, unknown>).triageAnalysis);
      if (stored && stored.fingerprint === currentFingerprint) {
        this.log(`Triage cache hit for ${findingId}`);
        onEvent({ type: 'result', findingId, analysis: stored.analysis, metadata: stored.metadata });
        return;
      }

      // Build prompt and call AI
      const { systemPrompt, outputSchema } = buildTriagePrompt({
        ruleId: finding.ruleId,
        severity: finding.severity,
        file: finding.file,
        startLine: finding.startLine,
        endLine: finding.endLine,
        snippet: finding.snippet,
        title: finding.title,
        description: finding.description,
        scanner: finding.scanner,
        notes: finding.notes,
      });

      const { query } = await import('@anthropic-ai/claude-agent-sdk');
      const { buildQueryOptions } = await import('./claudeAgentProvider.js');
      const config = (this.aiService as unknown as { getConfig(): Record<string, unknown> }).getConfig();

      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 60_000);

      const options: Record<string, unknown> = {
        ...buildQueryOptions(config as never),
        abortController,
        cwd: this.workspaceRoot,
        permissionMode: 'dontAsk',
        allowedTools: [] as string[],
        outputFormat: { type: 'json_schema', schema: outputSchema },
      };

      type SDKMessage = { type: string; subtype?: string; structured_output?: unknown; errors?: string[]; cost_usd?: number; model?: string; [key: string]: unknown };

      try {
        const messages = query({ prompt: systemPrompt, options: options as never });

        for await (const raw of messages) {
          const message = raw as SDKMessage;
          if (message.type === 'result') {
            if (message.subtype === 'success' && message.structured_output) {
              const analysis = parseTriageResponse(message.structured_output);
              if (!analysis) {
                onEvent({ type: 'error', findingId, errorType: 'parse_error', message: 'Failed to parse triage classification response' });
                return;
              }

              const metadata: TriageMetadata = {
                classifiedAt: new Date().toISOString(),
                modelId: (message.model as string) ?? 'unknown',
                costUsd: (message.cost_usd as number) ?? 0,
              };

              // Persist to DB
              const storedAnalysis: StoredTriageAnalysis = {
                analysis,
                metadata,
                fingerprint: currentFingerprint,
              };
              await (this.db.finding.update as CallableFunction)({
                where: { id: findingId },
                data: { triageAnalysis: storedAnalysis },
              });

              this.log(`Triage classified ${findingId}: category=${analysis.category}, cost=$${metadata.costUsd.toFixed(4)}`);
              onEvent({ type: 'result', findingId, analysis, metadata });
              return;
            }

            const errors = Array.isArray(message.errors) ? message.errors : [];
            const errorMsg = errors.length > 0 ? errors.join('; ') : 'Classification failed — no structured output returned';
            onEvent({ type: 'error', findingId, errorType: 'provider_error', message: errorMsg });
            return;
          }
        }

        onEvent({ type: 'error', findingId, errorType: 'provider_error', message: 'Classification failed — no result received' });
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Triage exception for ${findingId}: ${message}`);
      onEvent({ type: 'error', findingId, errorType: 'unknown', message: `Classification failed: ${message}` });
    }
  }

  async classifyBatch(
    onEvent: (event: TriageEvent) => void,
  ): Promise<void> {
    if (this.batchAbortController) {
      this.log('Triage batch already in progress');
      return;
    }

    // Query all HIGH severity, non-suppressed findings from the latest completed scan
    const latestScan = await this.db.scan.findFirst({
      where: { projectId: (await this.db.project.findFirst())?.id, status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
    });

    if (!latestScan) {
      this.log('No completed scans found for triage');
      onEvent({ type: 'complete', analyzedCount: 0, failedCount: 0, skippedCount: 0, status: 'completed' });
      return;
    }

    const allFindings = await this.db.finding.findMany({
      where: {
        scanId: latestScan.id,
        severity: 'HIGH',
        disposition: { not: 'SUPPRESS' },
      },
    });

    // Filter to unanalyzed or stale findings
    const eligibleFindings = allFindings.filter(f => {
      const stored = parseStoredTriageAnalysis((f as Record<string, unknown>).triageAnalysis);
      if (!stored) { return true; } // Never classified
      const currentFingerprint = computeTriageFingerprint(f);
      return currentFingerprint !== stored.fingerprint; // Stale
    });

    if (eligibleFindings.length === 0) {
      this.log('No eligible findings for triage classification');
      onEvent({ type: 'complete', analyzedCount: 0, failedCount: 0, skippedCount: allFindings.length - eligibleFindings.length, status: 'completed' });
      return;
    }

    const findingIds = eligibleFindings.map(f => f.id);
    this.batchAbortController = new AbortController();

    this.log(`Starting triage batch: ${findingIds.length} findings`);
    onEvent({ type: 'started', totalFindings: findingIds.length, findingIds });

    let analyzedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let consecutiveFailures = 0;
    let status: TriageBatchStatus = 'running';

    try {
      for (let i = 0; i < findingIds.length; i++) {
        if (this.batchAbortController.signal.aborted) {
          status = 'cancelled';
          break;
        }

        const findingId = findingIds[i];
        const finding = eligibleFindings[i];

        onEvent({
          type: 'progress',
          currentIndex: i + 1,
          totalFindings: findingIds.length,
          currentFindingId: findingId,
          status: 'classifying',
          message: `Classifying: ${finding.title} in ${finding.file}`,
        });

        let succeeded = false;
        await this.classifyFinding(findingId, (event) => {
          if (event.type === 'result') {
            succeeded = true;
            onEvent(event);
          } else if (event.type === 'error') {
            onEvent(event);
          }
        });

        if (succeeded) {
          analyzedCount++;
          consecutiveFailures = 0;
        } else {
          failedCount++;
          consecutiveFailures++;
          if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
            status = 'consecutive-failures';
            this.log(`Triage batch: consecutive failure limit reached (${consecutiveFailures})`);
            break;
          }
        }
      }

      if (status === 'running') {
        status = 'completed';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Triage batch error: ${message}`);
      status = 'error';
    } finally {
      this.batchAbortController = undefined;
      skippedCount = allFindings.length - eligibleFindings.length;
      this.log(`Triage batch finished: status=${status}, analyzed=${analyzedCount}, failed=${failedCount}, skipped=${skippedCount}`);
      onEvent({ type: 'complete', analyzedCount, failedCount, skippedCount, status });
    }
  }

  cancelBatch(): void {
    if (this.batchAbortController) {
      this.log('Cancelling triage batch');
      this.batchAbortController.abort();
    }
  }

  async getTriageSummary(): Promise<TriageSummary> {
    // Get findings from the latest completed scan
    const latestScan = await this.db.scan.findFirst({
      where: { projectId: (await this.db.project.findFirst())?.id, status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
    });

    const emptyBreakdown = (): TriageSeverityBreakdown => ({
      total: 0, suppress: 0, easyFix: 0, systemic: 0, unanalyzed: 0, addressed: 0,
    });

    const bySeverity = {} as Record<Severity, TriageSeverityBreakdown>;
    for (const sev of SEVERITY_KEYS) {
      bySeverity[sev] = emptyBreakdown();
    }

    if (!latestScan) {
      return { bySeverity, totalFindings: 0, totalAnalyzed: 0, totalUnanalyzed: 0 };
    }

    const findings = await this.db.finding.findMany({
      where: { scanId: latestScan.id },
    });

    let totalAnalyzed = 0;
    let totalUnanalyzed = 0;

    for (const f of findings) {
      const sev = f.severity as Severity;
      if (!bySeverity[sev]) { bySeverity[sev] = emptyBreakdown(); }
      bySeverity[sev].total++;

      const stored = parseStoredTriageAnalysis((f as Record<string, unknown>).triageAnalysis);
      if (stored) {
        totalAnalyzed++;
        switch (stored.analysis.category) {
          case 'suppress': bySeverity[sev].suppress++; break;
          case 'easy_fix': bySeverity[sev].easyFix++; break;
          case 'systemic': bySeverity[sev].systemic++; break;
        }
      } else {
        totalUnanalyzed++;
        bySeverity[sev].unanalyzed++;
      }

      if (f.disposition === 'SUPPRESS' || f.disposition === 'FIX') {
        bySeverity[sev].addressed++;
      }
    }

    return {
      bySeverity,
      totalFindings: findings.length,
      totalAnalyzed,
      totalUnanalyzed,
    };
  }

  async applyTriageSuppression(findingId: string): Promise<{ success: true } | { success: false; errorType: string; message: string }> {
    this.log(`Applying triage suppression for ${findingId}`);

    const finding = await this.db.finding.findUnique({ where: { id: findingId } });
    if (!finding) {
      return { success: false, errorType: 'not_found', message: `Finding not found: ${findingId}` };
    }

    const stored = parseStoredTriageAnalysis((finding as Record<string, unknown>).triageAnalysis);
    if (!stored || stored.analysis.category !== 'suppress') {
      return { success: false, errorType: 'wrong_category', message: 'Finding is not classified as suppress' };
    }

    const analysis = stored.analysis;

    const input: SuppressionInput = {
      findingId,
      filePath: finding.file,
      ruleId: finding.ruleId,
      scope: analysis.suggestedScope,
      justification: analysis.suggestedJustification,
      includeLineRange: false,
      startLine: finding.startLine,
      endLine: finding.endLine,
      expiration: null,
    };

    try {
      await this.ashYamlWriteService.addSuppression(input);
      await this.findingsService.setDisposition(findingId, 'SUPPRESS');
      this.log(`Triage suppression applied for ${findingId}`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Triage suppression failed for ${findingId}: ${message}`);
      return { success: false, errorType: 'write_error', message };
    }
  }

  async applyTriageFix(findingId: string): Promise<{ success: true; filePath: string } | { success: false; errorType: 'stale_code' | 'file_not_found' | 'write_error' | 'path_validation'; message: string }> {
    this.log(`Applying triage fix for ${findingId}`);

    const finding = await this.db.finding.findUnique({ where: { id: findingId } });
    if (!finding) {
      return { success: false, errorType: 'file_not_found', message: `Finding not found: ${findingId}` };
    }

    const stored = parseStoredTriageAnalysis((finding as Record<string, unknown>).triageAnalysis);
    if (!stored || stored.analysis.category !== 'easy_fix') {
      return { success: false, errorType: 'path_validation', message: 'Finding is not classified as easy_fix' };
    }

    const analysis = stored.analysis;

    // Validate file path is within workspace
    const path = await import('path');
    const resolvedPath = path.resolve(this.workspaceRoot, analysis.filePath);
    if (!resolvedPath.startsWith(this.workspaceRoot)) {
      return { success: false, errorType: 'path_validation', message: 'File path is outside workspace' };
    }

    try {
      const fileUri = vscode.Uri.file(resolvedPath);

      // Read file
      let content: string;
      try {
        const raw = await vscode.workspace.fs.readFile(fileUri);
        content = Buffer.from(raw).toString('utf-8');
      } catch {
        return { success: false, errorType: 'file_not_found', message: `File not found: ${analysis.filePath}` };
      }

      // Extract lines and validate codeBefore match
      const lines = content.split('\n');
      const startIdx = analysis.startLine - 1; // 0-indexed
      const endIdx = analysis.endLine; // exclusive
      const extractedLines = lines.slice(startIdx, endIdx).join('\n');

      if (extractedLines.trim() !== analysis.codeBefore.trim()) {
        return { success: false, errorType: 'stale_code', message: 'Source file has changed since analysis. Re-analysis recommended.' };
      }

      // Replace lines
      const newLines = [
        ...lines.slice(0, startIdx),
        ...analysis.codeAfter.split('\n'),
        ...lines.slice(endIdx),
      ];
      const newContent = newLines.join('\n');

      // Write file
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(newContent, 'utf-8'));
      await this.findingsService.setDisposition(findingId, 'FIX');

      this.log(`Triage fix applied for ${findingId}: ${analysis.filePath}`);
      return { success: true, filePath: analysis.filePath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Triage fix failed for ${findingId}: ${message}`);
      return { success: false, errorType: 'write_error', message };
    }
  }

  private log(message: string): void {
    const line = `[ASH Triage] ${message}`;
    console.log(line);
    this.outputChannel?.appendLine(line);
  }

  dispose(): void {
    if (this.batchAbortController) {
      this.batchAbortController.abort();
      this.batchAbortController = undefined;
    }
  }
}
