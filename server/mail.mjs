import nodemailer from 'nodemailer';
import { decryptSecret } from './secrets.mjs';

export function smtpPublic(record) {
  if (!record) return { configured: false };
  return {
    configured: true,
    host: record.host,
    port: Number(record.port),
    secure: !!record.secure,
    username: record.username,
    fromName: record.from_name,
    fromEmail: record.from_email,
    passwordConfigured: true,
    updatedAt: record.updated_at,
  };
}

export function smtpTransport(record) {
  if (!record) throw Error('SMTP ainda não configurado.');
  return nodemailer.createTransport({
    host: record.host,
    port: Number(record.port),
    secure: !!record.secure,
    auth: { user: record.username, pass: decryptSecret(record) },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendPasswordReset(record, { to, name, resetUrl }) {
  const transport = smtpTransport(record);
  await transport.sendMail({
    from: `"${record.from_name}" <${record.from_email}>`,
    to,
    subject: 'Redefinição de senha · DPControl',
    text: `Olá, ${name}. Use o link abaixo para criar uma nova senha. O link expira em 30 minutos e só pode ser utilizado uma vez:\n\n${resetUrl}\n\nSe você não solicitou esta redefinição, ignore esta mensagem.`,
    html: `<p>Olá, <strong>${name}</strong>.</p><p>Use o botão abaixo para criar uma nova senha. O link expira em 30 minutos e só pode ser utilizado uma vez.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#3764eb;color:#fff;text-decoration:none;border-radius:8px">Criar nova senha</a></p><p>Se você não solicitou esta redefinição, ignore esta mensagem.</p>`,
  });
}
