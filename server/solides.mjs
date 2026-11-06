const DEFAULT_BASE_URL = 'https://employer.tangerino.com.br';

const ENTITY_MATCHERS = {
  employees: /employee|colaborador|funcionário|funcionario/i,
  departments: /department|departamento|workplace|local/i,
  schedules: /work.?schedule|schedule|escala|punch.?rule/i,
  punches: /punch|marcação|marcacao|point|ponto/i,
  adjustments: /adjustment|ajuste|justific/i,
  occurrences: /occupational|medical|atestado|absence|afastamento|vacation|férias|ferias/i,
};

async function solidesFetch({ baseUrl, token, path, params = {} }) {
  const normalizedToken = String(token || '').replace(/^Basic\s+/i, '').trim();
  const url = new URL(path, baseUrl);
  Object.entries(params).forEach(([key, value]) => value != null && url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Basic ${normalizedToken}` } });
  const text = await response.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw Object.assign(new Error(`Sólides respondeu HTTP ${response.status}.`), { status: response.status, body });
  return body;
}

export async function discoverSolidesOperations({ baseUrl = DEFAULT_BASE_URL, token }) {
  const spec = await solidesFetch({ baseUrl, token, path: '/v2/api-docs' });
  const paths = Object.entries(spec?.paths || {}).flatMap(([path, operations]) => Object.entries(operations)
    .filter(([method]) => ['get'].includes(method.toLowerCase()))
    .map(([method, operation]) => ({ path, method: method.toUpperCase(), operationId: operation.operationId || '', summary: operation.summary || '', tags: operation.tags || [] })));
  return paths;
}

export async function importSolidesEntity({ baseUrl = DEFAULT_BASE_URL, token, entity }) {
  const matcher = ENTITY_MATCHERS[entity];
  if (!matcher) throw Error('Tipo de importação não suportado.');
  const operations = await discoverSolidesOperations({ baseUrl, token });
  const operation = operations.find((item) => matcher.test(`${item.path} ${item.operationId} ${item.summary} ${item.tags.join(' ')}`));
  if (!operation) return { entity, available: false, message: 'A API autorizada não publicou uma operação GET compatível para este tipo.', operations };
  const body = await solidesFetch({ baseUrl, token, path: operation.path, params: { page: 0, size: 500 } });
  const rows = Array.isArray(body) ? body : body?.content || body?.data || body?.items || [];
  return { entity, available: true, operation, count: rows.length, rows };
}

export async function testSolidesConnection({ baseUrl = process.env.SOLIDES_API_BASE_URL || DEFAULT_BASE_URL, token = process.env.SOLIDES_API_TOKEN } = {}) {
  if (!token) return { configured: false, message: 'Token Sólides ainda não configurado no servidor.' };
  const normalizedToken = token.replace(/^Basic\s+/i, '').trim();
  const url = new URL('/account', baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json', Authorization: `Basic ${normalizedToken}` }, signal: controller.signal });
    if (!response.ok) return { configured: true, connected: false, status: response.status, message: `A Sólides recusou a autenticação ou a permissão (HTTP ${response.status}).` };
    const account = await response.json();
    return { configured: true, connected: true, status: response.status, accountStatus: typeof account.accountStatus === 'string' ? account.accountStatus : null, activeEmployeeCount: Number.isFinite(account.activeEmployeeCount) ? account.activeEmployeeCount : null };
  } catch (error) {
    return { configured: true, connected: false, message: error.name === 'AbortError' ? 'A Sólides não respondeu no prazo.' : 'Não foi possível alcançar a Sólides.' };
  } finally { clearTimeout(timer); }
}
