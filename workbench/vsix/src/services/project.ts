import type { PrismaClient, Project } from '@prisma/client';
import type { WorkspaceFolder } from 'vscode';

/**
 * Ensures a Project record exists for the current workspace.
 * Uses the first workspace folder's path as the unique key.
 * Creates a new project if none exists; returns the existing one otherwise.
 */
export async function ensureProject(
  db: PrismaClient,
  workspaceFolders: readonly WorkspaceFolder[],
): Promise<Project> {
  const folder = workspaceFolders[0];
  const rootPath = folder.uri.fsPath;
  const name = folder.name;

  return db.project.upsert({
    where: { rootPath },
    create: { name, rootPath },
    update: {},
  });
}
