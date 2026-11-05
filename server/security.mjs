import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  try {
    const [salt, key] = stored.split(':');
    return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(password, salt, 64));
  } catch {
    return false;
  }
}
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export function validCpf(value) {
  const n = value.replace(/\D/g, '');
  if (!/^\d{11}$/.test(n) || /^(\d)\1+$/.test(n)) return false;
  for (let len = 9; len <= 10; len++) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(n[i]) * (len + 1 - i);
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(n[len])) return false;
  }
  return true;
}
