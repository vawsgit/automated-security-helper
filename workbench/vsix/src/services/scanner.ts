import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn as defaultSpawn } from 'node:child_process';
import type { ChildProcess, SpawnOptionsWithoutStdio } from 'node:child_process';
import type { PrismaClient } from '@prisma/client';
import type { OutputChannel } from 'vscode';
import { parseSarif } from './sarif';
import type { SarifLog } from './sarif';

export type SpawnFn = (
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio,
) => ChildProcess;

export interface ScanProgress {
  elapsed: number;
  statusText: string;
}

export interface StartScanParams {
  targetPath: string;
  severityThreshold?: string;
}

export interface ScanResult {
  scanId: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  findingsCount: number;
  severityBreakdown: Record<string, number> | null;
  errorMessage: string | null;
}

export interface ScannerConfig {
  ashPath: string;
  ashMode: string;
  scanTimeout: number;
}

export class ScannerService {
  private readonly db: PrismaClient;
  private readonly projectId: string;
  private readonly spawnFn: SpawnFn;
  private readonly outputChannel: OutputChannel | undefined;
  private configOverride: ScannerConfig | null = null;

  private currentScanId: string | null = null;
  private currentProcess: ChildProcess | null = null;
  private currentTempDir: string | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelled = false;
  private scanStartTime: number | null = null;

  constructor(db: PrismaClient, projectId: string, spawnFn?: SpawnFn, outputChannel?: OutputChannel) {
    this.db = db;
    this.projectId = projectId;
    this.spawnFn = spawnFn ?? defaultSpawn;
    this.outputChannel = outputChannel;
  }

  getCurrentScanId(): string | null {
    return this.currentScanId;
  }

  /** Override config for testing (avoids vscode.workspace.getConfiguration). */
  setConfigOverride(config: ScannerConfig): void {
    this.configOverride = config;
  }

  private getConfig(): ScannerConfig {
    if (this.configOverride) {
      return this.configOverride;
    }
    // Dynamic import avoided — vscode is available at runtime in extension host
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscode = require('vscode') as typeof import('vscode');
    const cfg = vscode.workspace.getConfiguration('ashWorkbench');
    return {
      ashPath: cfg.get<string>('ashPath', 'ash') ?? 'ash',
      ashMode: cfg.get<string>('ashMode', 'local') ?? 'local',
      scanTimeout: cfg.get<number>('scanTimeout', 600) ?? 600,
    };
  }

  async recoverStaleScans(): Promise<number> {
    const result = await this.db.scan.updateMany({
      where: { projectId: this.projectId, status: 'RUNNING' },
      data: {
        status: 'FAILED',
        errorMessage: 'Scan interrupted: VS Code was closed while this scan was running.',
        completedAt: new Date(),
      },
    });
    return result.count;
  }

  async startScan(
    params: StartScanParams,
    onProgress?: (progress: ScanProgress) => void,
  ): Promise<ScanResult> {
    // FR-010: Single-scan constraint
    const running = await this.db.scan.findFirst({
      where: { projectId: this.projectId, status: 'RUNNING' },
    });
    if (running) {
      throw new Error('A scan is already in progress for this project.');
    }

    // FR-011: Find or create ScanTarget
    const scanTarget = await this.db.scanTarget.upsert({
      where: {
        projectId_path: {
          projectId: this.projectId,
          path: params.targetPath,
        },
      },
      create: {
        projectId: this.projectId,
        path: params.targetPath,
        displayName: path.basename(params.targetPath),
      },
      update: {},
    });

    // FR-001: Create Scan record
    const scan = await this.db.scan.create({
      data: {
        projectId: this.projectId,
        scanTargetId: scanTarget.id,
        sourceDir: params.targetPath,
        status: 'RUNNING',
        severityThreshold: params.severityThreshold ?? 'LOW',
      },
    });

    this.currentScanId = scan.id;
    this.cancelled = false;
    this.scanStartTime = Date.now();

    const config = this.getConfig();
    let tempDir: string;

    try {
      // FR-009: Create temp directory
      tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ash-scan-'));
      this.currentTempDir = tempDir;
    } catch (err) {
      await this.updateScanFailed(scan.id, `Failed to create temporary directory: ${err}`);
      return this.buildResult(scan.id, 'FAILED', 0, null, `Failed to create temporary directory: ${err}`);
    }

    // Output Channel: clear, reveal, and write scan header
    if (this.outputChannel) {
      this.outputChannel.clear();
      this.outputChannel.show(true);
      const args = [
        '--source-dir', params.targetPath,
        '--output-dir', tempDir,
        '--output-formats', 'sarif',
        '--color', 'false',
        '--progress',
      ];
      if (config.ashMode === 'container') {
        args.push('--mode', 'container');
      }
      const separator = '════════════════════════════════════════════════════════════';
      this.outputChannel.appendLine(separator);
      this.outputChannel.appendLine('ASH Scan Started');
      this.outputChannel.appendLine(`  Target:  ${params.targetPath}`);
      this.outputChannel.appendLine(`  Time:    ${new Date().toISOString()}`);
      this.outputChannel.appendLine(`  Command: ${config.ashPath} ${args.join(' ')}`);
      this.outputChannel.appendLine(separator);
    }

    try {
      const result = await this.executeScan(scan.id, scanTarget.id, params.targetPath, tempDir, config, onProgress);
      return result;
    } finally {
      // FR-009: Cleanup temp directory
      this.clearTimers();
      this.currentScanId = null;
      this.currentProcess = null;
      this.currentTempDir = null;
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup
      }
    }
  }

  async cancelScan(scanId: string): Promise<void> {
    if (!this.currentScanId || this.currentScanId !== scanId || !this.currentProcess) {
      return;
    }

    this.cancelled = true;
    this.currentProcess.kill('SIGTERM');

    // Write cancelled footer to Output Channel
    if (this.outputChannel) {
      const duration = this.scanStartTime ? Math.floor((Date.now() - this.scanStartTime) / 1000) : 0;
      const separator = '────────────────────────────────────────────────────────────';
      this.outputChannel.appendLine(separator);
      this.outputChannel.appendLine('ASH Scan Cancelled');
      this.outputChannel.appendLine(`  Duration: ${this.formatDuration(duration)}`);
      this.outputChannel.appendLine(separator);
    }

    await this.db.scan.update({
      where: { id: scanId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    this.clearTimers();

    if (this.currentTempDir) {
      try {
        await fs.promises.rm(this.currentTempDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup
      }
    }
  }

  private async executeScan(
    scanId: string,
    scanTargetId: string,
    targetPath: string,
    tempDir: string,
    config: ScannerConfig,
    onProgress?: (progress: ScanProgress) => void,
  ): Promise<ScanResult> {
    return new Promise<ScanResult>((resolve) => {
      // FR-002: Build args and spawn process
      const args = [
        '--source-dir', targetPath,
        '--output-dir', tempDir,
        '--output-formats', 'sarif',
        '--color', 'false',
        '--progress',
      ];
      if (config.ashMode === 'container') {
        args.push('--mode', 'container');
      }

      const proc = this.spawnFn(config.ashPath, args);
      this.currentProcess = proc;

      const stderrChunks: Buffer[] = [];
      const startTime = Date.now();

      // Output Channel: pipe stdout and stderr through line buffers
      const stdoutBuffer = this.createLineBuffer();
      const stderrBuffer = this.createLineBuffer('[stderr] ');

      if (proc.stdout) {
        proc.stdout.on('data', (chunk: Buffer) => {
          stdoutBuffer.onData(chunk);
        });
      }

      // Collect stderr for error reporting + pipe to Output Channel
      if (proc.stderr) {
        proc.stderr.on('data', (chunk: Buffer) => {
          stderrChunks.push(chunk);
          stderrBuffer.onData(chunk);
        });
      }

      // Flush line buffers when process streams close
      proc.on('close', () => {
        stdoutBuffer.flush();
        stderrBuffer.flush();
      });

      // FR-013: Progress reporting
      if (onProgress) {
        this.progressTimer = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          onProgress({ elapsed, statusText: 'Scanning...' });
        }, 1000);
      }

      // FR-012: Timeout handling
      this.timeoutTimer = setTimeout(() => {
        proc.kill('SIGTERM');
        this.updateScanFailed(scanId, `Scan timed out after ${config.scanTimeout} seconds`).then(() => {
          this.clearTimers();
          this.writeFooter('FAILED', startTime, 0, `Scan timed out after ${config.scanTimeout} seconds`);
          resolve(this.buildResult(scanId, 'FAILED', 0, null, `Scan timed out after ${config.scanTimeout} seconds`));
        });
      }, config.scanTimeout * 1000);

      // FR-007: Handle ENOENT (ASH not installed)
      proc.on('error', async (err: NodeJS.ErrnoException) => {
        this.clearTimers();
        if (this.cancelled) {
          resolve(this.buildResult(scanId, 'CANCELLED', 0, null, null));
          return;
        }
        let message: string;
        if (err.code === 'ENOENT') {
          message = `ASH CLI not found at "${config.ashPath}". Install it with: pip install automated-security-helper (or configure the path in Settings > ASH Workbench > Ash Path)`;
        } else {
          message = `Failed to start scanner: ${err.message}`;
        }
        this.outputChannel?.appendLine(message);
        this.writeFooter('FAILED', startTime, 0, message);
        await this.updateScanFailed(scanId, message);
        resolve(this.buildResult(scanId, 'FAILED', 0, null, message));
      });

      // FR-003/FR-005/FR-006: Handle process exit
      proc.on('exit', async (code) => {
        this.clearTimers();
        if (this.cancelled) {
          resolve(this.buildResult(scanId, 'CANCELLED', 0, null, null));
          return;
        }

        if (code === 0 || code === 2) {
          // Successful exit — parse SARIF output
          const sarifPath = path.join(tempDir, 'reports', 'ash.sarif');
          try {
            let findingsCount = 0;
            const severityBreakdown: Record<string, number> = {
              CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0,
            };

            if (fs.existsSync(sarifPath)) {
              const sarifContent = await fs.promises.readFile(sarifPath, 'utf-8');
              const sarifJson: SarifLog = JSON.parse(sarifContent);
              const findings = parseSarif(sarifJson, targetPath);

              if (findings.length > 0) {
                // FR-004: Store findings
                await this.db.finding.createMany({
                  data: findings.map((f) => ({
                    scanId,
                    projectId: this.projectId,
                    scanTargetId,
                    ruleId: f.ruleId,
                    scanner: f.scanner,
                    severity: f.severity,
                    file: f.file,
                    startLine: f.startLine,
                    endLine: f.endLine,
                    title: f.title,
                    description: f.description,
                    snippet: f.snippet,
                  })),
                });

                // FR-016: Compute severity breakdown
                for (const f of findings) {
                  severityBreakdown[f.severity] = (severityBreakdown[f.severity] ?? 0) + 1;
                }
              }

              findingsCount = findings.length;
            }
            // Exit 0 with no SARIF file → zero findings (clean scan)

            // FR-005: Update scan to COMPLETED
            await this.db.scan.update({
              where: { id: scanId },
              data: {
                status: 'COMPLETED',
                findingsCount,
                severityBreakdown,
                completedAt: new Date(),
              },
            });

            this.writeFooter('COMPLETED', startTime, findingsCount);
            resolve(this.buildResult(scanId, 'COMPLETED', findingsCount, severityBreakdown, null));
          } catch (err) {
            const message = `Failed to process scan results: ${err}`;
            this.writeFooter('FAILED', startTime, 0, message);
            await this.updateScanFailed(scanId, message);
            resolve(this.buildResult(scanId, 'FAILED', 0, null, message));
          }
        } else {
          // FR-006: Exit code 1 or other error
          const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
          const message = stderr || `Scanner exited with code ${code}`;
          this.writeFooter('FAILED', startTime, 0, message);
          await this.updateScanFailed(scanId, message);
          resolve(this.buildResult(scanId, 'FAILED', 0, null, message));
        }
      });
    });
  }

  private async updateScanFailed(scanId: string, errorMessage: string): Promise<void> {
    try {
      await this.db.scan.update({
        where: { id: scanId },
        data: {
          status: 'FAILED',
          errorMessage,
          completedAt: new Date(),
        },
      });
    } catch {
      // If DB update itself fails, we can't do much
      console.error(`[ASH Scanner] Failed to update scan ${scanId} to FAILED`);
    }
  }

  private clearTimers(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  private buildResult(
    scanId: string,
    status: 'COMPLETED' | 'FAILED' | 'CANCELLED',
    findingsCount: number,
    severityBreakdown: Record<string, number> | null,
    errorMessage: string | null,
  ): ScanResult {
    return { scanId, status, findingsCount, severityBreakdown, errorMessage };
  }

  private createLineBuffer(prefix?: string): { onData: (chunk: Buffer) => void; flush: () => void } {
    let buffer = '';
    const channel = this.outputChannel;
    const linePrefix = prefix ?? '';
    return {
      onData(chunk: Buffer) {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          channel?.appendLine(`${linePrefix}${line}`);
        }
      },
      flush() {
        if (buffer.length > 0) {
          channel?.appendLine(`${linePrefix}${buffer}`);
          buffer = '';
        }
      },
    };
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  private writeFooter(
    status: 'COMPLETED' | 'FAILED' | 'CANCELLED',
    startTime: number,
    findingsCount: number,
    errorMessage?: string,
  ): void {
    if (!this.outputChannel) {
      return;
    }
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const separator = '────────────────────────────────────────────────────────────';
    this.outputChannel.appendLine(separator);
    if (status === 'COMPLETED') {
      this.outputChannel.appendLine('ASH Scan Completed');
      this.outputChannel.appendLine(`  Status:   COMPLETED`);
      this.outputChannel.appendLine(`  Duration: ${this.formatDuration(duration)}`);
      this.outputChannel.appendLine(`  Findings: ${findingsCount}`);
    } else if (status === 'FAILED') {
      this.outputChannel.appendLine('ASH Scan Failed');
      this.outputChannel.appendLine(`  Status:   FAILED`);
      this.outputChannel.appendLine(`  Duration: ${this.formatDuration(duration)}`);
      this.outputChannel.appendLine(`  Error:    ${errorMessage ?? 'Unknown error'}`);
    } else {
      this.outputChannel.appendLine('ASH Scan Cancelled');
      this.outputChannel.appendLine(`  Duration: ${this.formatDuration(duration)}`);
    }
    this.outputChannel.appendLine(separator);
  }
}
