import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as vscode from 'vscode';
import type {
  AshSuppression,
  SuppressionInput,
  SuppressionResult,
  SuppressionWriteResult,
  FindingRow,
} from '../models/types';
import { discoverConfigFile, parseConfigFile } from './ashYamlCore';
import type { AshYamlService } from './ashYaml';
import {
  inputToSuppression,
  generateSkeleton,
  findSuppressionIndex,
  reserializeSuppressionsSection,
  appendSuppressionEntry,
} from './ashYamlWriteCore';

// Re-export pure helpers for external consumers
export {
  inputToSuppression,
  serializeSuppressionEntry,
  generateSkeleton,
  findSuppressionIndex,
  reserializeSuppressionsSection,
} from './ashYamlWriteCore';

// --- Service class ---

export class AshYamlWriteService {
  private scanRoot: string;
  private ashYamlService: AshYamlService;

  constructor(scanRoot: string, ashYamlService: AshYamlService) {
    this.scanRoot = scanRoot;
    this.ashYamlService = ashYamlService;
  }

  setScanRoot(newRoot: string): void {
    this.scanRoot = newRoot;
  }

  async addSuppression(input: SuppressionInput): Promise<SuppressionResult> {
    const findingId = input.findingId;
    try {
      // Validate input
      if (!input.justification.trim()) {
        return { success: false, findingId, action: 'suppress', error: 'Justification is required.' };
      }
      if (input.expiration) {
        const expDate = new Date(input.expiration);
        if (isNaN(expDate.getTime()) || expDate <= new Date()) {
          return { success: false, findingId, action: 'suppress', error: 'Expiration must be a future date.' };
        }
      }

      const entry = inputToSuppression(input);
      const configPath = discoverConfigFile(this.scanRoot);

      if (!configPath) {
        // FR-008: Create new file
        const newPath = path.join(this.scanRoot, '.ash.yaml');
        const content = generateSkeleton(entry);
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(newPath),
          Buffer.from(content, 'utf-8'),
        );
        return { success: true, findingId, action: 'suppress' };
      }

      // FR-010: Re-read and conflict detection
      const mtime = this.getFileMtime(configPath);
      const fileContent = fs.readFileSync(configPath, 'utf-8');

      // FR-011: Validate YAML is parseable
      try {
        yaml.load(fileContent, { schema: yaml.DEFAULT_SCHEMA });
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        return { success: false, findingId, action: 'suppress', error: `.ash.yaml contains invalid YAML: ${msg}` };
      }

      // Conflict detection: re-check mtime just before write
      const currentMtime = this.getFileMtime(configPath);
      if (currentMtime !== mtime) {
        // Retry once with fresh content
        return this.retryAddSuppression(configPath, entry, findingId);
      }

      // FR-009: Append entry preserving existing content
      const updatedContent = appendSuppressionEntry(fileContent, entry);
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(configPath),
        Buffer.from(updatedContent, 'utf-8'),
      );

      return { success: true, findingId, action: 'suppress' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, findingId, action: 'suppress', error: `Failed to write suppression: ${msg}` };
    }
  }

  async removeSuppression(findingId: string, findings: FindingRow[]): Promise<SuppressionResult> {
    try {
      // Find the matching finding to get its suppression data
      const finding = findings.find((f) => f.id === findingId);
      if (!finding) {
        return { success: false, findingId, action: 'unsuppress', error: 'Finding not found.' };
      }

      // Look up the matching suppression from the read service
      const matchingSuppression = this.ashYamlService.matchesSuppression(finding);
      if (!matchingSuppression) {
        // Already removed externally
        return { success: true, findingId, action: 'unsuppress' };
      }

      const configPath = discoverConfigFile(this.scanRoot);
      if (!configPath) {
        return { success: true, findingId, action: 'unsuppress' };
      }

      // FR-010: Re-read for conflict detection
      const mtime = this.getFileMtime(configPath);
      const fileContent = fs.readFileSync(configPath, 'utf-8');

      // Parse current suppressions
      const config = parseConfigFile(configPath);
      const index = findSuppressionIndex(config.suppressions, matchingSuppression);
      if (index === -1) {
        // Already removed
        return { success: true, findingId, action: 'unsuppress' };
      }

      // Conflict detection
      const currentMtime = this.getFileMtime(configPath);
      if (currentMtime !== mtime) {
        return this.retryRemoveSuppression(configPath, matchingSuppression, findingId);
      }

      // Remove entry and re-serialize
      const updatedSuppressions = [...config.suppressions];
      updatedSuppressions.splice(index, 1);
      const updatedContent = reserializeSuppressionsSection(fileContent, updatedSuppressions);

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(configPath),
        Buffer.from(updatedContent, 'utf-8'),
      );

      return { success: true, findingId, action: 'unsuppress' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, findingId, action: 'unsuppress', error: `Failed to remove suppression: ${msg}` };
    }
  }

  async updateSuppression(old: AshSuppression, updated: AshSuppression): Promise<SuppressionWriteResult> {
    try {
      if (!updated.reason?.trim()) {
        return { success: false, error: 'Reason is required.' };
      }
      if (updated.expiration) {
        const expDate = new Date(updated.expiration);
        if (isNaN(expDate.getTime()) || expDate <= new Date()) {
          return { success: false, error: 'Expiration must be a future date.' };
        }
      }

      const configPath = discoverConfigFile(this.scanRoot);
      if (!configPath) {
        return { success: false, error: 'No .ash.yaml config file found.' };
      }

      const mtime = this.getFileMtime(configPath);
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const config = parseConfigFile(configPath);
      const index = findSuppressionIndex(config.suppressions, old);
      if (index === -1) {
        return { success: false, error: 'Suppression rule not found. It may have been modified externally.' };
      }

      const currentMtime = this.getFileMtime(configPath);
      if (currentMtime !== mtime) {
        return { success: false, error: '.ash.yaml was modified externally. Please try again.' };
      }

      const updatedSuppressions = [...config.suppressions];
      updatedSuppressions[index] = updated;
      const updatedContent = reserializeSuppressionsSection(fileContent, updatedSuppressions);

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(configPath),
        Buffer.from(updatedContent, 'utf-8'),
      );

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to update suppression: ${msg}` };
    }
  }

  async removeSuppressionRule(suppression: AshSuppression): Promise<SuppressionWriteResult> {
    try {
      const configPath = discoverConfigFile(this.scanRoot);
      if (!configPath) {
        return { success: true }; // No file = nothing to remove
      }

      const mtime = this.getFileMtime(configPath);
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const config = parseConfigFile(configPath);
      const index = findSuppressionIndex(config.suppressions, suppression);
      if (index === -1) {
        return { success: true }; // Already removed
      }

      const currentMtime = this.getFileMtime(configPath);
      if (currentMtime !== mtime) {
        return { success: false, error: '.ash.yaml was modified externally. Please try again.' };
      }

      const updatedSuppressions = [...config.suppressions];
      updatedSuppressions.splice(index, 1);
      const updatedContent = reserializeSuppressionsSection(fileContent, updatedSuppressions);

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(configPath),
        Buffer.from(updatedContent, 'utf-8'),
      );

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to remove suppression: ${msg}` };
    }
  }

  async addSuppressionDirect(suppression: AshSuppression): Promise<SuppressionWriteResult> {
    try {
      if (!suppression.reason?.trim()) {
        return { success: false, error: 'Reason is required.' };
      }
      if (suppression.expiration) {
        const expDate = new Date(suppression.expiration);
        if (isNaN(expDate.getTime()) || expDate <= new Date()) {
          return { success: false, error: 'Expiration must be a future date.' };
        }
      }

      const configPath = discoverConfigFile(this.scanRoot);

      if (!configPath) {
        const newPath = path.join(this.scanRoot, '.ash.yaml');
        const content = generateSkeleton(suppression);
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(newPath),
          Buffer.from(content, 'utf-8'),
        );
        return { success: true };
      }

      const mtime = this.getFileMtime(configPath);
      const fileContent = fs.readFileSync(configPath, 'utf-8');

      try {
        yaml.load(fileContent, { schema: yaml.DEFAULT_SCHEMA });
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        return { success: false, error: `.ash.yaml contains invalid YAML: ${msg}` };
      }

      const currentMtime = this.getFileMtime(configPath);
      if (currentMtime !== mtime) {
        return { success: false, error: '.ash.yaml was modified externally. Please try again.' };
      }

      const updatedContent = appendSuppressionEntry(fileContent, suppression);
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(configPath),
        Buffer.from(updatedContent, 'utf-8'),
      );

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to add suppression: ${msg}` };
    }
  }

  // --- Private helpers ---

  private getFileMtime(filePath: string): number {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return 0;
    }
  }

  private async retryAddSuppression(
    configPath: string,
    entry: AshSuppression,
    findingId: string,
  ): Promise<SuppressionResult> {
    try {
      const mtime = this.getFileMtime(configPath);
      const fileContent = fs.readFileSync(configPath, 'utf-8');

      try {
        yaml.load(fileContent, { schema: yaml.DEFAULT_SCHEMA });
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        return { success: false, findingId, action: 'suppress', error: `.ash.yaml contains invalid YAML: ${msg}` };
      }

      const currentMtime = this.getFileMtime(configPath);
      if (currentMtime !== mtime) {
        return { success: false, findingId, action: 'suppress', error: '.ash.yaml was modified externally. Please try again.' };
      }

      const updatedContent = appendSuppressionEntry(fileContent, entry);
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(configPath),
        Buffer.from(updatedContent, 'utf-8'),
      );
      return { success: true, findingId, action: 'suppress' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, findingId, action: 'suppress', error: `Failed to write suppression: ${msg}` };
    }
  }

  private async retryRemoveSuppression(
    configPath: string,
    target: AshSuppression,
    findingId: string,
  ): Promise<SuppressionResult> {
    try {
      const mtime = this.getFileMtime(configPath);
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const config = parseConfigFile(configPath);
      const index = findSuppressionIndex(config.suppressions, target);
      if (index === -1) {
        return { success: true, findingId, action: 'unsuppress' };
      }

      const currentMtime = this.getFileMtime(configPath);
      if (currentMtime !== mtime) {
        return { success: false, findingId, action: 'unsuppress', error: '.ash.yaml was modified externally. Please try again.' };
      }

      const updatedSuppressions = [...config.suppressions];
      updatedSuppressions.splice(index, 1);
      const updatedContent = reserializeSuppressionsSection(fileContent, updatedSuppressions);

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(configPath),
        Buffer.from(updatedContent, 'utf-8'),
      );
      return { success: true, findingId, action: 'unsuppress' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, findingId, action: 'unsuppress', error: `Failed to remove suppression: ${msg}` };
    }
  }
}
