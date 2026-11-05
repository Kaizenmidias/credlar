import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key() {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!value) throw Error('INTEGRATION_ENCRYPTION_KEY não configurada no servidor.');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32) throw Error('INTEGRATION_ENCRYPTION_KEY deve ter 32 bytes em Base64.');
  return decoded;
}
export function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}
export function decryptSecret(record) {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.auth_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
