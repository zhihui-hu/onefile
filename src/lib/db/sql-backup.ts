import { getSqlite } from '@/lib/db/client';
import type Database from 'better-sqlite3';
import DatabaseClient from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const KNOWN_TABLE_ORDER = [
  'onefile_users',
  'onefile_oauth_tokens',
  'onefile_auth_refresh_tokens',
  'onefile_storage_accounts',
  'onefile_storage_buckets',
  'onefile_file_uploads',
  'onefile_file_upload_parts',
  'onefile_file_api_tokens',
] as const;

type SqliteNameRow = {
  name: string;
};

type SqliteSchemaRow = {
  name: string;
  sql: string | null;
  tbl_name?: string;
};

type SqliteTableInfoRow = {
  cid: number;
  name: string;
  type?: string;
  notnull?: number;
  pk?: number;
};

type SqliteSequenceRow = {
  name: string;
  seq: number;
};

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }

  if (typeof value === 'bigint') {
    return String(value);
  }

  if (Buffer.isBuffer(value)) {
    return `X'${value.toString('hex')}'`;
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function oneFileTables(sqlite: Database.Database) {
  const rows = sqlite
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE 'onefile_%' ORDER BY name",
    )
    .all() as SqliteNameRow[];
  const existing = new Set(rows.map((row) => row.name));
  const ordered = KNOWN_TABLE_ORDER.filter((name) => existing.has(name));
  const extra = rows
    .map((row) => row.name)
    .filter((name) => !KNOWN_TABLE_ORDER.includes(name as never));

  return [...ordered, ...extra];
}

function tableCreateSql(sqlite: Database.Database, table: string) {
  const row = sqlite
    .prepare(
      "SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
    )
    .get(table) as SqliteSchemaRow | undefined;

  if (!row?.sql) {
    throw new Error(`Missing schema for table ${table}`);
  }

  return row.sql;
}

function tableIndexes(sqlite: Database.Database, table: string) {
  return sqlite
    .prepare(
      "SELECT name, tbl_name, sql FROM sqlite_schema WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL ORDER BY name",
    )
    .all(table) as SqliteSchemaRow[];
}

function tableColumns(sqlite: Database.Database, table: string) {
  return (
    sqlite
      .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
      .all() as SqliteTableInfoRow[]
  )
    .sort((left, right) => left.cid - right.cid)
    .map((row) => row.name);
}

function tableRows(
  sqlite: Database.Database,
  table: string,
  columns: string[],
) {
  if (columns.length === 0) {
    return [];
  }

  const columnList = columns.map(quoteIdentifier).join(', ');
  return sqlite
    .prepare(`SELECT ${columnList} FROM ${quoteIdentifier(table)}`)
    .all() as Record<string, unknown>[];
}

function hasSqliteSequence(sqlite: Database.Database) {
  const row = sqlite
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'sqlite_sequence'",
    )
    .get() as SqliteNameRow | undefined;

  return Boolean(row);
}

function sequenceRows(sqlite: Database.Database, tables: string[]) {
  if (!hasSqliteSequence(sqlite) || tables.length === 0) {
    return [];
  }

  const placeholders = tables.map(() => '?').join(', ');
  return sqlite
    .prepare(
      `SELECT name, seq FROM sqlite_sequence WHERE name IN (${placeholders}) ORDER BY name`,
    )
    .all(...tables) as SqliteSequenceRow[];
}

function modelSql() {
  return fs.readFileSync(
    path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      'src',
      'lib',
      'db',
      'model.sql',
    ),
    'utf8',
  );
}

function runSql(sqlite: Database.Database, sqlText: string) {
  try {
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec(sqlText);
  } catch (error) {
    if (sqlite.inTransaction) {
      sqlite.exec('ROLLBACK');
    }
    throw error;
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }
}

function tableInfo(sqlite: Database.Database, table: string) {
  return (
    sqlite
      .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
      .all() as SqliteTableInfoRow[]
  ).sort((left, right) => left.cid - right.cid);
}

function assertBackupSchema(imported: Database.Database) {
  const expected = new DatabaseClient(':memory:');
  try {
    expected.pragma('foreign_keys = ON');
    expected.exec(modelSql());

    for (const table of KNOWN_TABLE_ORDER) {
      const expectedColumns = tableInfo(expected, table);
      const importedColumns = tableInfo(imported, table);

      if (importedColumns.length === 0) {
        throw new Error(`SQL 备份缺少必要表：${table}`);
      }

      const importedColumnMap = new Map(
        importedColumns.map((column) => [column.name, column]),
      );

      for (const expectedColumn of expectedColumns) {
        const importedColumn = importedColumnMap.get(expectedColumn.name);
        if (!importedColumn) {
          throw new Error(
            `SQL 备份表 ${table} 缺少必要字段：${expectedColumn.name}`,
          );
        }

        if ((importedColumn.type ?? '') !== (expectedColumn.type ?? '')) {
          throw new Error(
            `SQL 备份表 ${table}.${expectedColumn.name} 字段类型不匹配`,
          );
        }
      }
    }
  } finally {
    expected.close();
  }
}

export function validateSqlBackup(sqlText: string) {
  if (!sqlText.includes('onefile_')) {
    throw new Error('SQL 文件不包含 OneFile 数据表。');
  }

  const imported = new DatabaseClient(':memory:');
  try {
    runSql(imported, sqlText);
    assertBackupSchema(imported);
  } finally {
    imported.close();
  }
}

export function createSqlBackup() {
  const sqlite = getSqlite();
  try {
    const tables = oneFileTables(sqlite);
    const lines = [
      '-- OneFile SQL backup',
      `-- Generated at ${new Date().toISOString()}`,
      'PRAGMA foreign_keys=OFF;',
      'BEGIN TRANSACTION;',
      '',
    ];

    for (const table of [...tables].reverse()) {
      lines.push(`DROP TABLE IF EXISTS ${quoteIdentifier(table)};`);
    }

    lines.push('');

    const indexSql: string[] = [];
    for (const table of tables) {
      lines.push(`${tableCreateSql(sqlite, table)};`);
      const columns = tableColumns(sqlite, table);
      const quotedColumns = columns.map(quoteIdentifier).join(', ');

      for (const row of tableRows(sqlite, table, columns)) {
        const values = columns.map((column) => sqlLiteral(row[column]));
        lines.push(
          `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES (${values.join(', ')});`,
        );
      }

      for (const index of tableIndexes(sqlite, table)) {
        if (index.sql) {
          indexSql.push(`${index.sql};`);
        }
      }

      lines.push('');
    }

    const sequences = sequenceRows(sqlite, tables);
    if (sequences.length > 0) {
      lines.push(
        `DELETE FROM "sqlite_sequence" WHERE "name" IN (${tables.map(sqlLiteral).join(', ')});`,
      );
      for (const sequence of sequences) {
        lines.push(
          `INSERT INTO "sqlite_sequence" ("name", "seq") VALUES (${sqlLiteral(sequence.name)}, ${sqlLiteral(sequence.seq)});`,
        );
      }
      lines.push('');
    }

    lines.push(...indexSql, '', 'COMMIT;', 'PRAGMA foreign_keys=ON;', '');
    return lines.join('\n');
  } finally {
    if (process.env.NODE_ENV === 'production') {
      sqlite.close();
    }
  }
}

export function restoreSqlBackup(sqlText: string) {
  const sqlite = getSqlite();
  try {
    runSql(sqlite, sqlText);
  } finally {
    if (process.env.NODE_ENV === 'production') {
      sqlite.close();
    }
  }
}
