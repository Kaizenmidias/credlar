const baseSchema = [
  `CREATE TABLE IF NOT EXISTS users (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at VARCHAR(40) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (hash VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL REFERENCES users(id), expires_at VARCHAR(40) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS company (id VARCHAR(191) PRIMARY KEY, data MEDIUMTEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS departments (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, data MEDIUMTEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS units (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, data MEDIUMTEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`,
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
  {
    id: '002_rules_and_closings',
    async up(query, driver) {
      await query(`CREATE TABLE IF NOT EXISTS calculation_rules (id VARCHAR(191) PRIMARY KEY, benefit_type VARCHAR(20) NOT NULL, department_id VARCHAR(191), valid_from VARCHAR(10) NOT NULL, valid_to VARCHAR(10), data MEDIUMTEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1, created_by VARCHAR(191) NOT NULL, created_at VARCHAR(40) NOT NULL)`);
      await query(`CREATE TABLE IF NOT EXISTS closings (id VARCHAR(191) PRIMARY KEY, competence VARCHAR(7) NOT NULL, start_date VARCHAR(10) NOT NULL, end_date VARCHAR(10) NOT NULL, department_id VARCHAR(191), status VARCHAR(20) NOT NULL, snapshot MEDIUMTEXT NOT NULL, justification MEDIUMTEXT, version INTEGER NOT NULL DEFAULT 1, created_by VARCHAR(191) NOT NULL, created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL)`);
      for (const [name, table, column] of [
        ['rules_validity', 'calculation_rules', 'benefit_type,department_id,valid_from'],
        ['closings_competence', 'closings', 'competence,status'],
      ]) {
        const sql = `CREATE INDEX ${driver === 'mysql' ? '' : 'IF NOT EXISTS '}${name} ON ${table}(${column})`;
        await query(sql).catch((error) => {
          if (!/duplicate|exists/i.test(error.message)) throw error;
        });
      }
    },
  },
  {
    id: '003_encrypted_integration_credentials',
    async up(query) {
      await query(`CREATE TABLE IF NOT EXISTS integration_credentials (id VARCHAR(191) PRIMARY KEY, provider VARCHAR(40) UNIQUE NOT NULL, base_url VARCHAR(500) NOT NULL, ciphertext MEDIUMTEXT NOT NULL, iv VARCHAR(100) NOT NULL, auth_tag VARCHAR(100) NOT NULL, created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL)`);
    },
  },
  {
    id: '004_units',
    async up(query) {
      await query(`CREATE TABLE IF NOT EXISTS units (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, data MEDIUMTEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1)`);
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
