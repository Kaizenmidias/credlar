const DEFAULT_BASE_URL = 'https://employer.tangerino.com.br';

export async function testSolidesConnection({ baseUrl = process.env.SOLIDES_API_BASE_URL || DEFAULT_BASE_URL, token = process.env.SOLIDES_API_TOKEN } = {}) {
  if (!token) return { configured: false, message: 'Token Sólides ainda não configurado no servidor.' };
  const url = new URL('/account', baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json', Authorization: `Basic ${token}` }, signal: controller.signal });
    if (!response.ok) return { configured: true, connected: false, status: response.status, message: `A Sólides recusou a autenticação ou a permissão (HTTP ${response.status}).` };
    const account = await response.json();
    return { configured: true, connected: true, status: response.status, accountStatus: typeof account.accountStatus === 'string' ? account.accountStatus : null, activeEmployeeCount: Number.isFinite(account.activeEmployeeCount) ? account.activeEmployeeCount : null };
  } catch (error) {
    return { configured: true, connected: false, message: error.name === 'AbortError' ? 'A Sólides não respondeu no prazo.' : 'Não foi possível alcançar a Sólides.' };
  } finally { clearTimeout(timer); }
}
