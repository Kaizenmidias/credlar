import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export async function connectDb(url = process.env.DATABASE_URL) {
  let query, close;
  if (url) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: url, max: 10 });
    query = async (sql, args = []) => {
      let i = 0;
      return pool.query(
        sql.replace(/\?/g, () => `$${++i}`),
        args,
      );
    };
    close = () => pool.end();
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    mkdirSync(resolve('var'), { recursive: true });
    const db = new DatabaseSync(process.env.TEST_DB || resolve('var/dho.db'));
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    query = async (sql, args = []) => {
      const stmt = db.prepare(sql);
      return /^\s*(SELECT|PRAGMA)/i.test(sql)
        ? { rows: stmt.all(...args) }
        : { rows: [], rowCount: stmt.run(...args).changes };
    };
    close = async () => db.close();
  }
  const schema = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS company (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, registration TEXT UNIQUE NOT NULL, cpf TEXT UNIQUE, department_id TEXT NOT NULL REFERENCES departments(id), data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, external_key TEXT UNIQUE, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
    `CREATE INDEX IF NOT EXISTS records_kind ON records(kind)`,
    `CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS password_resets (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL)`,
  ];
  for (const sql of schema) await query(sql);
  return { query, close, driver: url ? 'postgresql' : 'sqlite' };
}
