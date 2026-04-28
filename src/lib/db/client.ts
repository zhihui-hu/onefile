import { getEnv } from '@/lib/env';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

import { schema } from './schema';

declare global {
  var __onefileSqlite: Database.Database | undefined;
}

function resolveProjectPath(filePath: string) {
  if (filePath === ':memory:' || path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), filePath);
}

function ensureSchema(sqlite: Database.Database) {
  const modelSql = fs.readFileSync(
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'plan', 'model.sql'),
    'utf8',
  );
  sqlite.exec(modelSql);
}

function createSqliteClient() {
  const dbPath = resolveProjectPath(getEnv().databasePath);
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  ensureSchema(sqlite);
  return sqlite;
}

export function getSqlite() {
  if (process.env.NODE_ENV === 'production') {
    return createSqliteClient();
  }

  globalThis.__onefileSqlite ??= createSqliteClient();
  return globalThis.__onefileSqlite;
}

export const db = drizzle(getSqlite(), { schema });
