import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createCipheriv, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const run = promisify(execFile);
const connection = process.env.MYSQL_URL || process.env.DATABASE_URL;
if (!connection || !/^mysql/i.test(connection)) throw Error('MYSQL_URL não configurada.');
const url = new URL(connection);
const keyValue = process.env.BACKUP_ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY;
const key = Buffer.from(keyValue || '', 'base64');
if (key.length !== 32) throw Error('BACKUP_ENCRYPTION_KEY ou INTEGRATION_ENCRYPTION_KEY deve ter 32 bytes em Base64.');
const { stdout } = await run('mysqldump', ['--single-transaction', '--routines', '--events', '--triggers', '-h', url.hostname, '-P', url.port || '3306', '-u', decodeURIComponent(url.username), decodeURIComponent(url.pathname.slice(1))], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, maxBuffer: 1024 * 1024 * 500, encoding: 'buffer' });
const compressed = gzipSync(stdout, { level: 9 });
const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]); const tag = cipher.getAuthTag();
const directory = resolve(process.env.BACKUP_DIRECTORY || 'var/backups'); await mkdir(directory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-'); const path = resolve(directory, `dpcontrol-${stamp}.sql.gz.enc`);
await writeFile(path, Buffer.concat([Buffer.from('DHO1'), iv, tag, encrypted]), { mode: 0o600 });
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14); const threshold = Date.now() - retentionDays * 86400000;
for (const file of await readdir(directory)) { const target = resolve(directory, file); const info = await stat(target); if (file.endsWith('.sql.gz.enc') && info.mtimeMs < threshold) await unlink(target); }
console.log(JSON.stringify({ ok: true, file: path, compressedBytes: compressed.length, encryptedBytes: encrypted.length, retentionDays }));
