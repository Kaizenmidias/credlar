const baseSchema = [
  `CREATE TABLE IF NOT EXISTS users (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at VARCHAR(40) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (hash VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL REFERENCES users(id), expires_at VARCHAR(40) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS company (id VARCHAR(191) PRIMARY KEY, data MEDIUMTEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS departments (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, data MEDIUMTEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS employees (id VARCHAR(191) PRIMARY KEY, registration VARCHAR(255) UNIQUE NOT NULL, cpf VARCHAR(32) UNIQUE, department_id VARCHAR(191) NOT NULL REFERENCES departments(id), data MEDIUMTEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS records (id VARCHAR(191) PRIMARY KEY, kind VARCHAR(40) NOT NULL, external_key VARCHAR(191) UNIQUE, data MEDIUMTEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS audit_log (id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191), action VARCHAR(80) NOT NULL, entity VARCHAR(80) NOT NULL, entity_id VARCHAR(191), detail MEDIUMTEXT NOT NULL, created_at VARCHAR(40) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS password_resets (hash VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL REFERENCES users(id), expires_at VARCHAR(40) NOT NULL)`,
];

export const migrations = [
  {
    id: '001_base_schema',
    async up(query, driver) {
      for (const sql of baseSchema) await query(sql);
      if (driver === 'mysql') {
        await query('CREATE INDEX records_kind ON records(kind)').catch((error) => {
          if (!/duplicate|exists/i.test(error.message)) throw error;
        });
      } else {
        await query('CREATE INDEX IF NOT EXISTS records_kind ON records(kind)');
      }
    },
  },
];

export async function runMigrations(query, driver) {
  await query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(191) PRIMARY KEY, applied_at VARCHAR(40) NOT NULL)`,
  );
  const applied = new Set((await query('SELECT id FROM schema_migrations')).rows.map((row) => row.id));
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    await migration.up(query, driver);
    await query('INSERT INTO schema_migrations(id,applied_at) VALUES (?,?)', [
      migration.id,
      new Date().toISOString(),
    ]);
    applied.add(migration.id);
  }
  return [...applied].sort();
}
