import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { DatabaseService } from './database';
import type { ApplicationInfo } from '../models/types';

export class AdminService {
  static async getApplicationInfo(
    db: PrismaClient,
    extensionVersion: string,
  ): Promise<ApplicationInfo> {
    const schemaVersion = await DatabaseService.getSchemaVersion();
    const [projectCount, scanCount, findingCount] = await Promise.all([
      db.project.count(),
      db.scan.count(),
      db.finding.count(),
    ]);

    return {
      extensionVersion,
      schemaVersion,
      stats: { projectCount, scanCount, findingCount },
    };
  }

  static async resetApplication(storagePath: string): Promise<void> {
    await DatabaseService.close();
    const dbDir = path.join(storagePath, 'ash-workbench-pgdata');
    await fs.promises.rm(dbDir, { recursive: true, force: true });
  }
}
