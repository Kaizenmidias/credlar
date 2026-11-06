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
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Basic ${normalizedToken}` }, signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (response.ok) return body;
    lastError = Object.assign(new Error(`Sólides respondeu HTTP ${response.status}.`), { status: response.status, body });
    if (response.status !== 429 && response.status < 500) throw lastError;
    const retryAfter = Number(response.headers.get('retry-after'));
    await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : 500 * (2 ** attempt)));
  }
  throw lastError;
}

export const SOLIDES_DATASETS = [
  ['account', 'Conta e empresa responsável', '/account'],
  ['companies', 'Empresas e filiais', '/companies'],
  ['costCenters', 'Centros de custo', '/cost-center/find-all'],
  ['workplaces', 'Unidades e locais de trabalho', '/workplace/find-all'],
  ['jobRoles', 'Cargos', '/job-role/find-all'],
  ['employeeFunctions', 'Funções', '/employee-function'],
  ['managers', 'Gestores', '/manager/find-all'],
  ['workSchedules', 'Jornadas e escalas', '/work-schedule'],
  ['punchRules', 'Regras de ponto', '/v2/punch-rule'],
  ['holidays', 'Calendários e feriados', '/holiday-calendar/'],
  ['adjustmentReasons', 'Motivos de ajuste', '/adjustment-reason/find-all'],
  ['adjustments', 'Ajustes e justificativas', '/adjustment/find-all'],
];

const rowsFrom = (body) => Array.isArray(body) ? body : body?.content || body?.data || body?.items || body?.results || (body && typeof body === 'object' ? [body] : []);

async function fetchAllPages({ baseUrl, token, path, params = {} }) {
  const collected = [];
  let page = 0;
  let body;
  do {
    body = await solidesFetch({ baseUrl, token, path, params: { page, size: 500, ...params } });
    collected.push(...rowsFrom(body));
    const totalPages = Number(body?.totalPages || body?.page?.totalPages || 1);
    page += 1;
    if (page >= totalPages || page >= 200 || Array.isArray(body)) break;
  } while (true);
  return [...new Map(collected.map((row, index) => [String(row?.id ?? row?.code ?? row?.externalCode ?? index), row])).values()];
}

export async function syncAllSolidesData({ baseUrl = DEFAULT_BASE_URL, token }) {
  const result = [];
  const employees = await importSolidesEntity({ baseUrl, token, entity: 'employees' });
  for (let index = 0; index < employees.rows.length; index++) {
    const row = employees.rows[index];
    const hasValidWorkplace = Array.isArray(row?.workplaceList) && row.workplaceList.some((item) => Number(item?.id) > 0);
    const hasContractType = Object.keys(row || {}).some((key) => /contract|employment|v[ií]nculo|tipo/i.test(key));
    if ((hasValidWorkplace && hasContractType) || !row?.id) continue;
    try {
      const detail = await solidesFetch({ baseUrl, token, path: '/employee/find', params: { tangerinoId: row.id, ignoreFired: false } });
      const detailedRow = Array.isArray(detail) ? detail[0] : detail?.data || detail;
      if (detailedRow && typeof detailedRow === 'object') employees.rows[index] = { ...row, ...detailedRow };
    } catch { /* o registro resumido continua preservado quando o detalhe não estiver autorizado */ }
  }
  result.push({ key: 'employees', label: 'Funcionários', path: employees.operation?.path, status: 'ok', rows: employees.rows });
  for (const [key, label, path] of SOLIDES_DATASETS) {
    try {
      const rows = await fetchAllPages({ baseUrl, token, path });
      result.push({ key, label, path, status: 'ok', rows });
    } catch (error) {
      result.push({ key, label, path, status: 'unavailable', statusCode: Number(error.status) || null, message: error.message, rows: [] });
    }
  }
  return result;
}

async function fetchSolidesSpec(baseUrl, token) {
  try {
    const response = await fetch(new URL('/v2/api-docs', baseUrl), { headers: { Accept: 'application/json' } });
    if (response.ok) return response.json();
  } catch { /* fallback authenticated */ }
  return solidesFetch({ baseUrl, token, path: '/v2/api-docs' });
}

export async function discoverSolidesOperations({ baseUrl = DEFAULT_BASE_URL, token }) {
  const spec = await fetchSolidesSpec(baseUrl, token);
  const paths = Object.entries(spec?.paths || {}).flatMap(([path, operations]) => Object.entries(operations)
    .filter(([method]) => ['get'].includes(method.toLowerCase()))
    .map(([method, operation]) => ({ path, method: method.toUpperCase(), operationId: operation.operationId || '', summary: operation.summary || '', tags: operation.tags || [] })));
  return paths;
}

export async function importSolidesEntity({ baseUrl = DEFAULT_BASE_URL, token, entity }) {
  const matcher = ENTITY_MATCHERS[entity];
  if (!matcher) throw Error('Tipo de importação não suportado.');
  const operations = await discoverSolidesOperations({ baseUrl, token });
  const operation = entity === 'employees'
    ? operations.find((item) => item.path === '/employee/find-all')
      || operations.find((item) => item.path === '/employee/find')
    : operations.find((item) => matcher.test(`${item.path} ${item.operationId} ${item.summary} ${item.tags.join(' ')}`));
  if (!operation) return { entity, available: false, message: 'A API autorizada não publicou uma operação GET compatível para este tipo.', operations };
  let body;
  let rows;
  if (entity === 'employees') {
    const allRows = [];
    let page = 1;
    let totalPages = 1;
    do {
      body = await solidesFetch({
        baseUrl,
        token,
        path: operation.path,
        params: { page, size: 20, showFired: 0 },
      });
      const pageRows = Array.isArray(body) ? body : body?.content || body?.data || body?.items || [];
      allRows.push(...pageRows);
      totalPages = Number(body?.totalPages || 1);
      page += 1;
    } while (page <= totalPages && page <= 100);
    rows = [...new Map(allRows.map((row) => [String(row?.id ?? row?.registration ?? JSON.stringify(row)), row])).values()]
      .filter((row) => row && row.fired !== true);
    try {
      const scheduleBody = await solidesFetch({ baseUrl, token, path: '/work-schedule', params: { page: 0, size: 100, active: true } });
      const schedules = Array.isArray(scheduleBody) ? scheduleBody : scheduleBody?.content || scheduleBody?.data || scheduleBody?.items || [];
      const scheduleNames = new Map(schedules.map((schedule) => [String(schedule.id), schedule.name || schedule.description || `Código ${schedule.id}`]));
      rows = rows.map((row) => {
        const schedule = row.currentWorkSchedule || row.workSchedule || row.schedule;
        const scheduleId = typeof schedule === 'object' ? schedule?.id : schedule;
        return { ...row, solidesScheduleName: scheduleNames.get(String(scheduleId)) || (scheduleId ? `Código ${scheduleId}` : '') };
      });
    } catch {
      // A jornada é complementar; a importação continua mesmo sem essa consulta.
    }
  } else {
    body = await solidesFetch({ baseUrl, token, path: operation.path, params: { page: 0, size: 500 } });
    rows = Array.isArray(body) ? body : body?.content || body?.data || body?.items || [];
  }
  if (entity === 'employees' && rows.length && !rows.some((row) => row && (row.name || row.fullName || row.nome || row.employeeName || row.registration || row.registrationNumber || row.matricula))) {
    throw Object.assign(new Error('A operação de funcionários retornou outro tipo de dado. Verifique a permissão do endpoint /employee/find-all na Sólides.'), { status: 422 });
  }
  return { entity, available: true, operation, count: rows.length, rows };
}

const brDate = (value) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export async function fetchSolidesPunches({ baseUrl = DEFAULT_BASE_URL, token, employeeId, startDate, endDate }) {
  const rows = [];
  let pageNumber = 0;
  let totalPages = 1;
  do {
    const body = await solidesFetch({
      baseUrl, token,
      path: `/external/api/v1/payssego/punches/${encodeURIComponent(employeeId)}`,
      params: { startDate: brDate(startDate), endDate: brDate(endDate), pageNumber, pageSize: 100, showFired: false },
    });
    rows.push(...(Array.isArray(body) ? body : body?.content || body?.data || body?.items || []));
    totalPages = Number(body?.totalPages || 1);
    pageNumber += 1;
  } while (pageNumber < totalPages && pageNumber < 200);
  return rows;
}

export async function fetchSolidesWorkSchedule({ baseUrl = DEFAULT_BASE_URL, token, scheduleId }) {
  return solidesFetch({ baseUrl, token, path: `/work-schedule/${encodeURIComponent(scheduleId)}` });
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
