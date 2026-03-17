import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PrismaClient as PrismaClientType } from '@prisma/client';

// PGLite instance type (resolved dynamically since ESM-only)
interface PGLiteInstance {
  exec(sql: string): Promise<unknown>;
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction(callback: (tx: PGLiteTransaction) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

interface PGLiteTransaction {
  exec(sql: string): Promise<unknown>;
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export class DatabaseService {
  private static pgliteInstance: PGLiteInstance | null = null;
  private static prismaInstance: PrismaClientType | null = null;
  // __dirname at runtime is out/services/, so go up two levels to reach vsix/prisma/
  private static migrationsDir: string = path.join(__dirname, '..', '..', 'prisma', 'migrations');

  static get client(): PrismaClientType {
    if (!DatabaseService.prismaInstance) {
      throw new Error('DatabaseService not initialized. Call initialize() first.');
    }
    return DatabaseService.prismaInstance;
  }

  static async initialize(storagePath?: string): Promise<PrismaClientType> {
    // Idempotency: return existing client if already initialized
    if (DatabaseService.prismaInstance) {
      return DatabaseService.prismaInstance;
    }

    // Resolve database path
    let dbPath: string | undefined;
    if (storagePath) {
      const dbDir = path.join(storagePath, 'ash-workbench-pgdata');
      fs.mkdirSync(dbDir, { recursive: true });
      dbPath = dbDir;
    }
    // If no storagePath, PGLite runs in-memory (for tests)

    // Dynamic import for ESM-only PGLite
    const { PGlite } = await import('@electric-sql/pglite');
    const pglite = new PGlite(dbPath) as unknown as PGLiteInstance;
    DatabaseService.pgliteInstance = pglite;

    // Run raw SQL migrations
    await DatabaseService.runMigrations(pglite);

    // Create PrismaClient with PGLite adapter
    // Use PrismaPgliteAdapter directly (not createPgliteAdapter which tries to run prisma CLI)
    const { PrismaClient } = await import('@prisma/client');
    const { PrismaPgliteAdapter } = await import('prisma-pglite');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaPgliteAdapter(pglite as any, {
      wasJustInitialized: false,
      databaseDirPath: dbPath ?? '',
    });
    DatabaseService.prismaInstance = new PrismaClient({ adapter }) as PrismaClientType;

    return DatabaseService.prismaInstance;
  }

  static async getSchemaVersion(): Promise<string> {
    if (!DatabaseService.pgliteInstance) {
      return 'none';
    }
    const result = await DatabaseService.pgliteInstance.query<{ name: string }>(
      'SELECT name FROM _ash_migrations ORDER BY id DESC LIMIT 1',
    );
    if (result.rows.length === 0) {
      return 'none';
    }
    return result.rows[0].name;
  }

  static async close(): Promise<void> {
    try {
      if (DatabaseService.prismaInstance) {
        await DatabaseService.prismaInstance.$disconnect();
      }
    } catch {
      // Graceful shutdown: log but don't throw
      console.error('[ASH Database] Error disconnecting Prisma client');
    }

    try {
      if (DatabaseService.pgliteInstance) {
        await DatabaseService.pgliteInstance.close();
      }
    } catch {
      console.error('[ASH Database] Error closing PGLite instance');
    }

    DatabaseService.prismaInstance = null;
    DatabaseService.pgliteInstance = null;
  }

  private static async runMigrations(pglite: PGLiteInstance): Promise<void> {
    // Create migration tracking table
    await pglite.exec(`
      CREATE TABLE IF NOT EXISTS _ash_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Read migration directories
    const migrationsDir = DatabaseService.migrationsDir;
    if (!fs.existsSync(migrationsDir)) {
      return;
    }

    const migrations = fs.readdirSync(migrationsDir)
      .filter(d => {
        const fullPath = path.join(migrationsDir, d);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort();

    for (const migration of migrations) {
      // Check if already applied
      const applied = await pglite.query<{ count: string }>(
        'SELECT 1 FROM _ash_migrations WHERE name = $1',
        [migration],
      );

      if (applied.rows.length === 0) {
        const sqlPath = path.join(migrationsDir, migration, 'migration.sql');
        if (!fs.existsSync(sqlPath)) {
          throw new Error(`Migration file not found: ${sqlPath}`);
        }
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        // Execute migration within a transaction
        await pglite.transaction(async (tx) => {
          await tx.exec(sql);
          await tx.exec(
            `INSERT INTO _ash_migrations (name) VALUES ('${migration}')`,
          );
        });
      }
    }
  }
}
