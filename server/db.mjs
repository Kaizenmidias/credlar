import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export async function connectDb(url = process.env.MYSQL_URL || process.env.DATABASE_URL) {
  let query, close, driver = 'sqlite';
  if (url && /^mysql(?:\+mysql)?/i.test(url)) {
    const mysql = await import('mysql2/promise');
    const parsed = new URL(url);
    const pool = mysql.createPool({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: decodeURIComponent(parsed.pathname.slice(1)),
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    });
    query = async (sql, args = []) => {
      const [result] = await pool.execute(sql, args);
      return { rows: Array.isArray(result) ? result : [], rowCount: Array.isArray(result) ? result.length : result.affectedRows || 0 };
    };
    close = () => pool.end();
    driver = 'mysql';
  } else if (url && /^postgres(?:ql)?/i.test(url)) {
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
    driver = 'postgresql';
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
    `CREATE TABLE IF NOT EXISTS users (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at VARCHAR(40) NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sessions (hash VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL REFERENCES users(id), expires_at VARCHAR(40) NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS company (id VARCHAR(191) PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS departments (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS employees (id VARCHAR(191) PRIMARY KEY, registration VARCHAR(255) UNIQUE NOT NULL, cpf VARCHAR(32) UNIQUE, department_id VARCHAR(191) NOT NULL REFERENCES departments(id), data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS records (id VARCHAR(191) PRIMARY KEY, kind VARCHAR(40) NOT NULL, external_key VARCHAR(191) UNIQUE, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
    ...(driver === 'mysql' ? [] : ['CREATE INDEX IF NOT EXISTS records_kind ON records(kind)']),
    `CREATE TABLE IF NOT EXISTS audit_log (id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191), action VARCHAR(80) NOT NULL, entity VARCHAR(80) NOT NULL, entity_id VARCHAR(191), detail TEXT NOT NULL, created_at VARCHAR(40) NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS password_resets (hash VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL REFERENCES users(id), expires_at VARCHAR(40) NOT NULL)`,
  ];
  for (const sql of schema) await query(sql);
  if (driver === 'mysql') {
    await query('CREATE INDEX records_kind ON records(kind)').catch((error) => {
      if (!/duplicate|exists/i.test(error.message)) throw error;
    });
  }
  return { query, close, driver };
}
