import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { runMigrations } from './migrations.mjs';

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
  const migrationIds = await runMigrations(query, driver);
  return { query, close, driver, migrationIds, schemaVersion: migrationIds.at(-1) || null };
}
