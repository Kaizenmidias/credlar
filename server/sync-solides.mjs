import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { connectDb } from './db.mjs';
import { digest } from './security.mjs';

const db = await connectDb();
const token = randomBytes(32).toString('hex');
const hash = digest(token);
try {
  const admin = (await db.query("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1")).rows[0];
  if (!admin) throw Error('Nenhum administrador ativo foi encontrado.');
  await db.query('INSERT INTO sessions(hash,user_id,expires_at) VALUES (?,?,?)', [hash, admin.id, new Date(Date.now() + 10 * 60_000).toISOString()]);
const response = await fetch(process.env.INTERNAL_API_URL || `http://127.0.0.1:3100/api/integration/solides/${process.argv[2] || 'sync-all'}`, {
    method: 'POST',
    headers: { Cookie: `dho_session=${token}`, Origin: process.env.APP_ORIGIN || 'https://credlar.kaizenmidias.com', 'x-dho-request': '1', 'Content-Type': 'application/json' },
    body: process.argv[3] || '{}',
  });
  const body = await response.json();
  if (!response.ok) throw Error(body.message || `Sincronização respondeu HTTP ${response.status}.`);
  console.log(JSON.stringify(body, null, 2));
} finally {
  await db.query('DELETE FROM sessions WHERE hash=?', [hash]).catch(() => {});
  await db.close();
}
