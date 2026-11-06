import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { randomUUID, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDb } from './db.mjs';
import { seed } from './seed.mjs';
import { hashPassword, verifyPassword, digest, validCpf } from './security.mjs';
import { audit, benefit, nightPay, daysBetween } from '../src/domain/engine.mjs';
import { testSolidesConnection, importSolidesEntity, syncAllSolidesData } from './solides.mjs';
import { decryptSecret, encryptSecret } from './secrets.mjs';

const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  role: z.enum(['admin', 'rh', 'consulta']),
  password: z.string().min(12).max(128).optional(),
  active: z.boolean().default(true),
});
const deptSchema = z.object({
  name: z.string().min(2).max(120),
  manager: z.string().max(120).default(''),
  description: z.string().max(1000).default(''),
  color: z.string().default('#3764eb'),
  weekdays: z.array(z.number().int().min(0).max(6)),
  vaDeductions: z.array(z.string()),
  vtDeductions: z.array(z.string()),
  sundayPolicy: z.string().max(1000),
  womenSundayRest: z.number().int().min(0).max(5),
  contractType: z.enum(['CLT', 'PJ', 'AMBOS', 'NAO_IDENTIFICADO']).default('NAO_IDENTIFICADO'),
});
const unitSchema = z.object({ name: z.string().min(2).max(120), description: z.string().max(1000).default(''), contractType: z.enum(['CLT', 'PJ', 'AMBOS', 'NAO_IDENTIFICADO']).default('NAO_IDENTIFICADO'), source: z.string().max(80).default('Manual') });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const empSchema = z.object({
  name: z.string().min(2).max(160),
  registration: z.string().min(1).max(40),
  cpf: z
    .string()
    .default('')
    .refine((v) => !v || validCpf(v), 'CPF inválido'),
  gender: z.enum(['Feminino', 'Masculino', 'Outro', 'Não informado']),
  departmentId: z.string().min(1),
  unitId: z.string().default(''),
  jobTitle: z.string().min(2),
  contractType: z.enum(['CLT', 'PJ']).default('CLT'),
  email: z.union([z.string().email(), z.literal('')]).default(''),
  admissionDate: date,
  terminationDate: z.union([date, z.literal('')]).default(''),
  salary: z.number().min(0),
  weeklyHours: z.number().min(1).max(60),
  scheduleName: z.string().min(1),
  weekdays: z.array(z.number().int().min(0).max(6)),
  startTime: time,
  breakStart: time,
  breakEnd: time,
  endTime: time,
  expectedPunches: z.union([z.literal(2), z.literal(4), z.literal(6)]),
  vaDaily: z.number().min(0),
  vtFare: z.number().min(0),
  vtTrips: z.number().int().min(0).max(10),
  nightPercent: z.number().min(0).max(100),
  status: z.enum(['Ativo', 'Férias', 'Afastado', 'Desligado']),
  extraDays: z.array(date).default([]),
  excludedDays: z.array(date).default([]),
  solidesData: z.record(z.string(), z.unknown()).default({}),
});
const ruleSchema = z.object({
  benefitType: z.enum(['va', 'vt', 'night']),
  departmentId: z.string().default(''),
  validFrom: date,
  validTo: z.union([date, z.literal('')]).default(''),
  active: z.boolean().default(true),
  data: z.record(z.string(), z.unknown()),
});

export async function createApp(db, { production = false, demo = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '3mb' }));
  const log = async (req, action, entity, id, detail = {}) =>
    db.query(
      'INSERT INTO audit_log(id,user_id,action,entity,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?)',
      [
        randomUUID(),
        req.user?.id || null,
        action,
        entity,
        id || null,
        JSON.stringify(detail),
        new Date().toISOString(),
      ],
    );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== (process.env.APP_ORIGIN || 'http://127.0.0.1:5173'))
        return res.status(403).json({ message: 'Origem não autorizada.' });
      if (req.headers['x-dho-request'] !== '1')
        return res.status(403).json({ message: 'Cabeçalho de segurança ausente.' });
    }
    next();
  });
  const cookie = (res, token, maxAge = 28800000) =>
    res.cookie('dho_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: production,
      path: '/',
      maxAge,
    });
  app.get('/api/health', (_, res) =>
    res.json({
      status: 'ok',
      database: db.driver,
      schemaVersion: db.schemaVersion,
      environment: demo ? 'validation' : 'production',
    }),
  );
  app.post(
    '/api/auth/login',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }),
    async (req, res) => {
      const { email, password } = z
        .object({ email: z.string().max(200), password: z.string().max(128) })
        .parse(req.body);
      const u = (await db.query('SELECT * FROM users WHERE email=?', [email.toLowerCase()]))
        .rows[0];
      if (!u || !u.active || !verifyPassword(password, u.password))
        return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
      const token = randomBytes(32).toString('hex');
      await db.query('INSERT INTO sessions(hash,user_id,expires_at) VALUES (?,?,?)', [
        digest(token),
        u.id,
        new Date(Date.now() + 28800000).toISOString(),
      ]);
      cookie(res, token);
      req.user = u;
      await log(req, 'login', 'users', u.id);
      res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
    },
  );
  app.post('/api/auth/forgot', rateLimit({ windowMs: 900000, limit: 5 }), async (req, res) => {
    z.object({ email: z.string().email() }).parse(req.body);
    res.json({
      message: 'Solicitação recebida. Neste ambiente, solicite a redefinição ao administrador.',
    });
  });
  app.use('/api', async (req, res, next) => {
    const token = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('dho_session='))
      ?.slice(12);
    const session = token
      ? (
          await db.query(
            'SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>? AND u.active=1',
            [digest(token), new Date().toISOString()],
          )
        ).rows[0]
      : null;
    if (!session) return res.status(401).json({ message: 'Entre para continuar.' });
    req.user = session;
    next();
  });
  app.get('/api/auth/me', (req, res) => res.json({ ...req.user, demo }));
  app.post('/api/auth/logout', async (req, res) => {
    const token = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('dho_session='))
      ?.slice(12);
    if (token) await db.query('DELETE FROM sessions WHERE hash=?', [digest(token)]);
    cookie(res, '', 0);
    res.json({ ok: true });
  });
  const admin = (req, res, next) =>
    req.user.role === 'admin'
      ? next()
      : res.status(403).json({ message: 'Acesso exclusivo do administrador.' });
  const write = (req, res, next) =>
    req.user.role !== 'consulta'
      ? next()
      : res.status(403).json({ message: 'Seu perfil permite apenas consulta.' });
  app.get('/api/bootstrap', async (req, res) => {
    const list = async (table) =>
      (await db.query(`SELECT * FROM ${table}`)).rows.map((r) => ({
        ...JSON.parse(r.data),
        id: r.id,
        version: r.version,
      }));
    const company = (await list('company'))[0];
    res.json({
      company,
      employees: await list('employees'),
      departments: await list('departments'),
      units: await list('units'),
      records: (await db.query('SELECT * FROM records')).rows.map((r) => ({
        ...JSON.parse(r.data),
        id: r.id,
        kind: r.kind,
        version: r.version,
      })),
      user: req.user,
      demo,
    });
  });
  app.post('/api/calculations/preview', async (req, res) => {
    const input = z
      .object({
        type: z.enum(['va', 'vt', 'night']),
        start: date,
        end: date,
        departmentId: z.string().default(''),
        employeeId: z.string().default(''),
      })
      .parse(req.body);
    daysBetween(input.start, input.end);
    const list = async (table) =>
      (await db.query(`SELECT * FROM ${table}`)).rows.map((r) => ({
        ...JSON.parse(r.data),
        id: r.id,
        version: r.version,
      }));
    const company = (await list('company'))[0];
    const employees = (await list('employees')).filter(
      (e) => (!input.departmentId || e.departmentId === input.departmentId) &&
        (!input.employeeId || e.id === input.employeeId),
    );
    const departments = await list('departments');
    const records = (await db.query('SELECT * FROM records')).rows.map((r) => ({
      ...JSON.parse(r.data),
      kind: r.kind,
    }));
    const occurrences = records.filter((r) => r.kind === 'occurrences');
    const punches = records.filter((r) => r.kind === 'punches');
    const rows = employees.map((employee) => {
      if (input.type === 'night') return nightPay(employee, punches, input.start, input.end, company);
      const department = departments.find((d) => d.id === employee.departmentId);
      if (!department) throw Error('Departamento do funcionário não encontrado.');
      return benefit(employee, department, occurrences, input.start, input.end, company, input.type);
    });
    res.json({
      type: input.type,
      period: { start: input.start, end: input.end },
      rows,
      totalCents: rows.reduce((sum, row) => sum + row.totalCents, 0),
      total: rows.reduce((sum, row) => sum + row.totalCents, 0) / 100,
      preview: true,
      note: 'Prévia informativa. Homologar regras, CCT e valores antes de uso oficial.',
    });
  });
  app.get('/api/calculation-rules', async (_, res) => {
    const rows = (await db.query('SELECT * FROM calculation_rules ORDER BY valid_from DESC')).rows;
    res.json(rows.map((row) => ({
      id: row.id,
      benefitType: row.benefit_type,
      departmentId: row.department_id || '',
      validFrom: row.valid_from,
      validTo: row.valid_to || '',
      active: !!row.active,
      version: row.version,
      data: JSON.parse(row.data),
    })));
  });
  app.post('/api/calculation-rules', admin, async (req, res) => {
    const rule = ruleSchema.parse(req.body);
    if (rule.validTo && rule.validTo < rule.validFrom)
      return res.status(422).json({ message: 'A vigência final não pode ser anterior à inicial.' });
    const candidates = (await db.query(
      'SELECT * FROM calculation_rules WHERE benefit_type=? AND active=1',
      [rule.benefitType],
    )).rows.filter((row) => (row.department_id || '') === rule.departmentId);
    const overlaps = candidates.some((row) =>
      (!rule.validTo || row.valid_from <= rule.validTo) && (!row.valid_to || row.valid_to >= rule.validFrom),
    );
    if (overlaps)
      return res.status(409).json({ message: 'Já existe uma regra ativa sobreposta para esta vigência.' });
    const id = randomUUID(), now = new Date().toISOString();
    await db.query(
      'INSERT INTO calculation_rules(id,benefit_type,department_id,valid_from,valid_to,data,active,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, rule.benefitType, rule.departmentId || null, rule.validFrom, rule.validTo || null, JSON.stringify(rule.data), rule.active ? 1 : 0, req.user.id, now],
    );
    await log(req, 'create', 'calculation_rules', id, { benefitType: rule.benefitType, validFrom: rule.validFrom });
    res.status(201).json({ id, version: 1 });
  });
  app.get('/api/closings', async (_, res) => {
    const rows = (await db.query('SELECT * FROM closings ORDER BY created_at DESC')).rows;
    res.json(rows.map((row) => ({
      id: row.id,
      competence: row.competence,
      start: row.start_date,
      end: row.end_date,
      departmentId: row.department_id || '',
      status: row.status,
      version: row.version,
      justification: row.justification || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      snapshot: JSON.parse(row.snapshot),
    })));
  });
  app.post('/api/closings/draft', write, async (req, res) => {
    const input = z.object({
      competence: z.string().regex(/^\d{4}-\d{2}$/),
      start: date,
      end: date,
      departmentId: z.string().default(''),
    }).parse(req.body);
    daysBetween(input.start, input.end);
    const list = async (table) =>
      (await db.query(`SELECT * FROM ${table}`)).rows.map((row) => ({ ...JSON.parse(row.data), id: row.id }));
    const company = (await list('company'))[0];
    const departments = await list('departments');
    const employees = (await list('employees')).filter((employee) =>
      !input.departmentId || employee.departmentId === input.departmentId,
    );
    const records = (await db.query('SELECT * FROM records')).rows.map((row) => ({
      ...JSON.parse(row.data), kind: row.kind,
    }));
    const occurrences = records.filter((row) => row.kind === 'occurrences');
    const punches = records.filter((row) => row.kind === 'punches');
    const reviews = records.filter((row) => row.kind === 'reviews');
    const calculations = employees.map((employee) => {
      const department = departments.find((item) => item.id === employee.departmentId);
      if (!department) throw Error('Departamento do funcionário não encontrado.');
      return {
        employee: { id: employee.id, name: employee.name, registration: employee.registration, departmentId: employee.departmentId },
        va: benefit(employee, department, occurrences, input.start, input.end, company, 'va'),
        vt: benefit(employee, department, occurrences, input.start, input.end, company, 'vt'),
        night: nightPay(employee, punches, input.start, input.end, company),
      };
    });
    const pendingOccurrences = occurrences.filter((item) =>
      item.status === 'Pendente' && item.startDate <= input.end && item.endDate >= input.start &&
      employees.some((employee) => employee.id === item.employeeId),
    );
    const pendingAlerts = audit(employees, punches, input.start, input.end, company, reviews)
      .filter((item) => item.severity !== 'green' && item.status === 'Pendente');
    const snapshot = {
      schemaVersion: db.schemaVersion,
      generatedAt: new Date().toISOString(),
      company,
      period: input,
      calculations,
      totals: calculations.reduce((total, item) => ({
        vaCents: total.vaCents + item.va.totalCents,
        vtCents: total.vtCents + item.vt.totalCents,
        nightCents: total.nightCents + item.night.totalCents,
      }), { vaCents: 0, vtCents: 0, nightCents: 0 }),
      pending: { occurrences: pendingOccurrences.length, alerts: pendingAlerts.length },
    };
    const id = randomUUID(), now = new Date().toISOString();
    await db.query('INSERT INTO closings(id,competence,start_date,end_date,department_id,status,snapshot,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [
      id, input.competence, input.start, input.end, input.departmentId || null, 'draft', JSON.stringify(snapshot), req.user.id, now, now,
    ]);
    await log(req, 'create', 'closings', id, { competence: input.competence, status: 'draft' });
    res.status(201).json({ id, status: 'draft', version: 1, snapshot });
  });
  app.post('/api/closings/:id/finalize', admin, async (req, res) => {
    if (process.env.CALCULATIONS_HOMOLOGATED !== 'true')
      return res.status(422).json({ message: 'Finalização bloqueada até a homologação formal das regras de cálculo.' });
    const closing = (await db.query('SELECT * FROM closings WHERE id=?', [req.params.id])).rows[0];
    if (!closing) return res.status(404).json({ message: 'Fechamento não encontrado.' });
    const snapshot = JSON.parse(closing.snapshot);
    if (snapshot.pending.occurrences || snapshot.pending.alerts)
      return res.status(422).json({ message: 'Existem pendências; registre a ciência antes de finalizar.' });
    await db.query('UPDATE closings SET status=?,version=version+1,updated_at=? WHERE id=? AND status=?', ['finalized', new Date().toISOString(), closing.id, 'draft']);
    await log(req, 'finalize', 'closings', closing.id);
    res.json({ ok: true });
  });
  for (const [name, schema] of [
    ['employees', empSchema],
    ['departments', deptSchema],
    ['units', unitSchema],
  ]) {
    app.post(
      `/api/${name}`,
      write,
      ...(['departments', 'units'].includes(name) ? [admin] : []),
      async (req, res) => {
        let d = schema.parse(req.body);
        const id = randomUUID();
        if (name === 'employees') {
          const source = d.solidesData || {};
          const sourceDepartmentName = String(source.departmentName || source.department?.name || source.departmentDTO?.name || '').trim();
          const sourceUnitName = String(source.unitName || source.unit?.name || source.workplaceName || source.workplace?.name || '').trim();
          let departmentId = d.departmentId;
          if (!(await db.query('SELECT id FROM departments WHERE id=?', [departmentId])).rows.length) {
            const byName = sourceDepartmentName ? (await db.query('SELECT id FROM departments WHERE LOWER(name)=LOWER(?)', [sourceDepartmentName])).rows[0] : null;
            if (byName) departmentId = byName.id;
            else {
              const fallbackName = sourceDepartmentName || 'A revisar - importação Sólides';
              const existingFallback = (await db.query('SELECT id FROM departments WHERE LOWER(name)=LOWER(?)', [fallbackName])).rows[0];
              if (existingFallback) departmentId = existingFallback.id;
              else {
                departmentId = randomUUID();
                const department = { name: fallbackName, manager: '', description: sourceDepartmentName ? 'Importado automaticamente da Sólides.' : 'Departamento temporário para registros sem departamento informado.', color: '#3764eb', weekdays: [1, 2, 3, 4, 5], vaDeductions: ['Falta injustificada', 'Suspensão'], vtDeductions: ['Falta injustificada', 'Atestado', 'Férias'], sundayPolicy: 'Revisão por escala e convenção coletiva', womenSundayRest: 2, contractType: d.contractType === 'PJ' ? 'PJ' : 'CLT' };
                await db.query('INSERT INTO departments(id,name,data) VALUES (?,?,?)', [departmentId, department.name, JSON.stringify(department)]);
              }
            }
          }
          let unitId = d.unitId || '';
          if (sourceUnitName) {
            const existingUnit = (await db.query('SELECT id FROM units WHERE LOWER(name)=LOWER(?)', [sourceUnitName])).rows[0];
            if (existingUnit) unitId = existingUnit.id;
            else {
              unitId = randomUUID();
              const unit = { name: sourceUnitName, description: 'Importada automaticamente da Sólides.', contractType: d.contractType === 'PJ' ? 'PJ' : 'CLT', source: 'Sólides' };
              await db.query('INSERT INTO units(id,name,data) VALUES (?,?,?)', [unitId, unit.name, JSON.stringify(unit)]);
            }
          }
          d = { ...d, departmentId, unitId };
          await db.query(
            'INSERT INTO employees(id,registration,cpf,department_id,data) VALUES (?,?,?,?,?)',
            [
              id,
              d.registration,
              d.cpf ? d.cpf.replace(/\D/g, '') : null,
              d.departmentId,
              JSON.stringify(d),
            ],
          );
        } else if (name === 'departments')
          await db.query('INSERT INTO departments(id,name,data) VALUES (?,?,?)', [
            id,
            d.name,
            JSON.stringify(d),
          ]);
        else await db.query('INSERT INTO units(id,name,data) VALUES (?,?,?)', [id, d.name, JSON.stringify(d)]);
        await log(req, 'create', name, id);
        res.status(201).json({ ...d, id, version: 1 });
      },
    );
    app.put(
      `/api/${name}/:id`,
      write,
      ...(['departments', 'units'].includes(name) ? [admin] : []),
      async (req, res) => {
        const d = schema.parse(req.body);
        const version = z.number().int().min(1).parse(req.body.version);
        const sql =
          name === 'employees'
            ? 'UPDATE employees SET registration=?,cpf=?,department_id=?,data=?,version=version+1 WHERE id=? AND version=?'
          : name === 'departments' ? 'UPDATE departments SET name=?,data=?,version=version+1 WHERE id=? AND version=?' : 'UPDATE units SET name=?,data=?,version=version+1 WHERE id=? AND version=?';
        const args =
          name === 'employees'
            ? [
                d.registration,
                d.cpf ? d.cpf.replace(/\D/g, '') : null,
                d.departmentId,
                JSON.stringify(d),
                req.params.id,
                version,
              ]
            : [d.name, JSON.stringify(d), req.params.id, version];
        const result = await db.query(sql, args);
        if (!result.rowCount)
          return res
            .status(409)
            .json({ message: 'Registro alterado por outro usuário. Atualize a página.' });
        await log(req, 'update', name, req.params.id, { fields: Object.keys(d) });
        res.json({ ...d, id: req.params.id, version: version + 1 });
      },
    );
  }
  app.put('/api/company', admin, async (req, res) => {
    const d = z
      .object({
        legalName: z.string().min(2),
        tradeName: z.string().min(2),
        cnpj: z.string(),
        email: z.string(),
        phone: z.string(),
        address: z.string(),
        logo: z.string().max(2400000),
        minPunchMinutes: z.number().min(1).max(120),
        toleranceMinutes: z.number().min(0).max(120),
        holidays: z.array(date),
        nightStart: time,
        nightEnd: time,
        nightReducedMinutes: z.number().min(1).max(60),
        nightExtension: z.boolean(),
        monthlyDivisor: z.number().positive(),
        timezone: z.literal('America/Sao_Paulo'),
        defaultStartDay: z.number().int().min(1).max(28),
        defaultEndDay: z.number().int().min(1).max(28),
      })
      .parse(req.body);
    if (d.logo && !/^data:image\/(png|jpeg);base64,/.test(d.logo) && !d.logo.startsWith('/logos/'))
      throw Error('Use imagem PNG ou JPEG.');
    await db.query('UPDATE company SET data=?,version=version+1 WHERE id=?', [
      JSON.stringify(d),
      'company',
    ]);
    await log(req, 'update', 'company', 'company');
    res.json({ ok: true });
  });
  app.get('/api/users', admin, async (_, res) =>
    res.json((await db.query('SELECT id,name,email,role,active,created_at FROM users')).rows),
  );
  app.post('/api/users', admin, async (req, res) => {
    const u = userSchema.parse(req.body);
    if (!u.password)
      return res.status(422).json({ message: 'Informe uma senha com 12 caracteres ou mais.' });
    const id = randomUUID();
    await db.query(
      'INSERT INTO users(id,name,email,password,role,active,created_at) VALUES (?,?,?,?,?,?,?)',
      [
        id,
        u.name,
        u.email,
        hashPassword(u.password),
        u.role,
        u.active ? 1 : 0,
        new Date().toISOString(),
      ],
    );
    await log(req, 'create', 'users', id);
    res.status(201).json({ id });
  });
  app.put('/api/users/:id', admin, async (req, res) => {
    const u = userSchema.parse(req.body);
    if (req.params.id === req.user.id && (!u.active || u.role !== 'admin'))
      return res
        .status(422)
        .json({ message: 'Não é possível remover o próprio acesso administrativo.' });
    const current = (await db.query('SELECT * FROM users WHERE id=?', [req.params.id])).rows[0];
    if (!current) return res.status(404).json({ message: 'Usuário não encontrado.' });
    await db.query('UPDATE users SET name=?,email=?,role=?,active=?,password=? WHERE id=?', [
      u.name,
      u.email,
      u.role,
      u.active ? 1 : 0,
      u.password ? hashPassword(u.password) : current.password,
      req.params.id,
    ]);
    await db.query('DELETE FROM sessions WHERE user_id=?', [req.params.id]);
    await log(req, 'update', 'users', req.params.id);
    res.json({ ok: true });
  });
  app.get('/api/history', async (_, res) =>
    res.json(
      (
        await db.query(
          'SELECT a.*,u.name AS actor FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200',
        )
      ).rows,
    ),
  );
  app.post('/api/records/:kind', write, async (req, res) => {
    const kind = z.enum(['punches', 'occurrences', 'reviews', 'closings']).parse(req.params.kind);
    const d = z.record(z.string(), z.unknown()).parse(req.body);
    delete d.version;
    const id = typeof d.id === 'string' ? d.id : randomUUID();
    delete d.kind;
    if (kind === 'closings')
      return res
        .status(422)
        .json({
          message:
            'Fechamento definitivo disponível após homologação do motor de cálculo. A prévia pode ser exportada.',
        });
    if (kind === 'punches')
      z.object({ employeeId: z.string().min(1), date, times: z.array(time).max(24) }).parse(d);
    if (kind === 'occurrences') {
      const o = z
        .object({
          employeeId: z.string().min(1),
          type: z.enum([
            'Falta injustificada',
            'Falta justificada',
            'Atestado',
            'Suspensão',
            'Férias',
            'Afastamento',
            'Licença',
            'Outros',
          ]),
          startDate: date,
          endDate: date,
          note: z.string().max(2000),
          status: z.enum(['Pendente', 'Conferido']),
        })
        .parse(d);
      if (o.endDate < o.startDate) throw Error('Data final anterior à inicial.');
    }
    if (
      d.employeeId &&
      !(await db.query('SELECT id FROM employees WHERE id=?', [d.employeeId])).rows.length
    )
      throw Error('Funcionário não encontrado.');
    const old = (await db.query('SELECT * FROM records WHERE id=? AND kind=?', [id, kind])).rows[0];
    if (kind === 'punches' && old)
      return res
        .status(422)
        .json({ message: 'Marcações importadas são imutáveis. Corrija na Sólides e reimporte.' });
    if (kind === 'reviews') {
      z.object({
        key: z.string().min(1),
        employeeId: z.string().min(1),
        date,
        status: z.enum(['Pendente', 'Descartado', 'Conferido na Sólides']),
        note: z.string().trim().min(1).max(2000),
      }).parse(d);
      const prior = old ? JSON.parse(old.data) : null;
      d.history = [
        ...(prior?.history || []),
        { status: d.status, note: d.note, actor: req.user.name, at: new Date().toISOString() },
      ];
    }
    const key =
      kind === 'punches'
        ? digest(`${d.employeeId}|${d.date}|${JSON.stringify(d.times)}`)
        : kind === 'occurrences'
          ? digest(`${d.employeeId}|${d.type}|${d.startDate}|${d.endDate}`)
          : kind === 'reviews'
            ? digest(`review|${d.key}`)
            : null;
    if (
      key &&
      !old &&
      (await db.query('SELECT id FROM records WHERE external_key=?', [key])).rows.length
    )
      return res.json({ duplicate: true });
    if (old)
      await db.query('UPDATE records SET data=?,version=version+1 WHERE id=?', [
        JSON.stringify({ ...d, id }),
        id,
      ]);
    else
      await db.query('INSERT INTO records(id,kind,external_key,data) VALUES (?,?,?,?)', [
        id,
        kind,
        key,
        JSON.stringify({ ...d, id }),
      ]);
    await log(req, old ? 'update' : 'create', kind, id);
    res.status(201).json({ id });
  });
  app.post('/api/integration/test', admin, async (_, res) => {
    const saved = (await db.query('SELECT * FROM integration_credentials WHERE provider=?', ['solides'])).rows[0];
    let token;
    try { token = saved ? decryptSecret(saved) : undefined; }
    catch (error) { return res.status(500).json({ message: error.message }); }
    const result = await testSolidesConnection({ baseUrl: saved?.base_url, token });
    if (!result.configured) return res.status(422).json(result);
    if (!result.connected) return res.json({ ok: false, ...result });
    res.json({ ok: true, ...result });
  });
  app.post('/api/integration/solides/preview', admin, async (req, res) => {
    const entity = z.enum(['employees', 'departments', 'schedules', 'punches', 'adjustments', 'occurrences']).parse(req.body?.entity);
    const saved = (await db.query('SELECT * FROM integration_credentials WHERE provider=?', ['solides'])).rows[0];
    if (!saved) return res.status(422).json({ message: 'Salve o token da Sólides antes de importar.' });
    const token = decryptSecret(saved);
    try {
      res.json(await importSolidesEntity({ baseUrl: saved.base_url, token, entity }));
    } catch (error) {
      res.status(error.status && Number(error.status) >= 400 ? Number(error.status) : 502).json({ message: error.message || 'Não foi possível consultar a Sólides.' });
    }
  });
  app.post('/api/integration/solides/sync-all', admin, async (req, res) => {
    const saved = (await db.query('SELECT * FROM integration_credentials WHERE provider=?', ['solides'])).rows[0];
    if (!saved) return res.status(422).json({ message: 'Salve o token da Sólides antes de sincronizar.' });
    const token = decryptSecret(saved);
    const syncedAt = new Date().toISOString();
    const isoDate = (value) => {
      if (!value) return '';
      const raw = typeof value === 'number' || /^\d{11,13}$/.test(String(value)) ? new Date(Number(value)) : new Date(value);
      return Number.isNaN(raw.getTime()) ? '' : raw.toISOString().slice(0, 10);
    };
    try {
      const datasets = await syncAllSolidesData({ baseUrl: saved.base_url, token });
      let stored = 0;
      for (const dataset of datasets.filter((item) => item.status === 'ok')) {
        for (let index = 0; index < dataset.rows.length; index++) {
          const row = dataset.rows[index];
          const externalId = String(row?.id ?? row?.code ?? row?.externalCode ?? row?.registration ?? index);
          const externalKey = digest(`solides|${dataset.key}|${externalId}`);
          const data = { id: externalKey, kind: `solides_${dataset.key}`, source: 'Sólides', dataset: dataset.label, externalId, syncedAt, payload: row };
          const current = (await db.query('SELECT id FROM records WHERE external_key=?', [externalKey])).rows[0];
          if (current) await db.query('UPDATE records SET data=?,version=version+1 WHERE id=?', [JSON.stringify(data), current.id]);
          else await db.query('INSERT INTO records(id,kind,external_key,data) VALUES (?,?,?,?)', [externalKey, data.kind, externalKey, JSON.stringify(data)]);
          stored++;
        }
      }

      const employeeRows = datasets.find((item) => item.key === 'employees')?.rows || [];
      let employeesCreated = 0;
      let employeesUpdated = 0;
      let employeesSkipped = 0;
      for (const source of employeeRows) {
        const name = String(source.name || source.fullName || source.nome || source.employeeName || '').trim();
        const registration = String(source.registration || source.registrationNumber || source.matricula || source.id || '').trim();
        if (!name || !registration) { employeesSkipped++; continue; }
        const contractText = JSON.stringify(source).toLowerCase();
        const contractType = /pessoa jur[ií]dica|prestador|\bpj\b/.test(contractText) ? 'PJ' : 'CLT';
        const departmentName = String(source.departmentName || source.department?.name || source.departmentDTO?.name || source.costCenter?.name || 'A revisar - importação Sólides').trim();
        let department = (await db.query('SELECT id FROM departments WHERE LOWER(name)=LOWER(?)', [departmentName])).rows[0];
        if (!department) {
          const id = randomUUID();
          const value = { id, name: departmentName, manager: '', description: 'Importado automaticamente da Sólides.', color: '#3764eb', weekdays: [1,2,3,4,5], vaDeductions: ['Falta injustificada','Suspensão'], vtDeductions: ['Falta injustificada','Atestado','Férias'], sundayPolicy: 'Revisão por escala e convenção coletiva', womenSundayRest: 2, contractType };
          await db.query('INSERT INTO departments(id,name,data) VALUES (?,?,?)', [id, departmentName, JSON.stringify(value)]);
          department = { id };
        }
        const unitName = String(source.unitName || source.unit?.name || source.workplaceName || source.workplace?.name || '').trim();
        let unitId = '';
        if (unitName) {
          let unit = (await db.query('SELECT id FROM units WHERE LOWER(name)=LOWER(?)', [unitName])).rows[0];
          if (!unit) {
            unit = { id: randomUUID() };
            await db.query('INSERT INTO units(id,name,data) VALUES (?,?,?)', [unit.id, unitName, JSON.stringify({ id: unit.id, name: unitName, description: 'Importada automaticamente da Sólides.', contractType, source: 'Sólides' })]);
          }
          unitId = unit.id;
        }
        const cpfRaw = String(source.cpf || '').replace(/\D/g, '');
        const genderRaw = String(source.gender || source.sex || '').toLowerCase();
        const gender = genderRaw.startsWith('f') ? 'Feminino' : genderRaw.startsWith('m') ? 'Masculino' : 'Não informado';
        const schedule = source.solidesScheduleName || source.currentWorkSchedule?.name || source.workSchedule?.name || source.schedule?.name || 'Revisar escala importada';
        const draft = empSchema.parse({
          name, registration, cpf: validCpf(cpfRaw) ? cpfRaw : '', gender, departmentId: department.id, unitId,
          jobTitle: String(source.jobTitle || source.role || source.jobRole?.name || source.jobRoleDTO?.name || source.employeeFunction?.name || 'Revisar cargo'),
          contractType, email: String(source.email || '').includes('@') ? String(source.email) : '', admissionDate: isoDate(source.admissionDate || source.hiringDate) || syncedAt.slice(0,10),
          terminationDate: isoDate(source.terminationDate || source.dismissalDate), salary: Number(source.salary || source.baseSalary || 0), weeklyHours: Number(source.weeklyHours || 44),
          scheduleName: String(schedule), weekdays: [1,2,3,4,5], startTime: '08:00', breakStart: '12:00', breakEnd: '13:00', endTime: '17:00', expectedPunches: 4,
          vaDaily: 0, vtFare: 0, vtTrips: 2, nightPercent: 20, status: source.fired === true || source.active === false ? 'Desligado' : 'Ativo', extraDays: [], excludedDays: [], solidesData: source,
        });
        const existing = (await db.query('SELECT id FROM employees WHERE registration=?', [registration])).rows[0];
        if (existing) {
          await db.query('UPDATE employees SET cpf=?,department_id=?,data=?,version=version+1 WHERE id=?', [draft.cpf || null, draft.departmentId, JSON.stringify({ ...draft, id: existing.id }), existing.id]);
          employeesUpdated++;
        } else {
          const id = randomUUID();
          await db.query('INSERT INTO employees(id,registration,cpf,department_id,data) VALUES (?,?,?,?,?)', [id, registration, draft.cpf || null, draft.departmentId, JSON.stringify({ ...draft, id })]);
          employeesCreated++;
        }
      }
      await log(req, 'sync', 'solides', 'all', { stored, employeesCreated, employeesUpdated, employeesSkipped });
      res.json({ syncedAt, stored, employeesCreated, employeesUpdated, employeesSkipped, datasets: datasets.map(({ rows, ...item }) => ({ ...item, count: rows.length })) });
    } catch (error) {
      res.status(error.status && Number(error.status) >= 400 ? Number(error.status) : 502).json({ message: error.message || 'Não foi possível sincronizar todos os dados da Sólides.' });
    }
  });
  app.put('/api/integration/credentials', admin, async (req, res) => {
    const input = z.object({ token: z.string().trim().min(12).max(10000), baseUrl: z.string().url().default('https://employer.tangerino.com.br') }).parse(req.body);
    const encrypted = encryptSecret(input.token);
    const now = new Date().toISOString();
    const current = (await db.query('SELECT id FROM integration_credentials WHERE provider=?', ['solides'])).rows[0];
    if (current) await db.query('UPDATE integration_credentials SET base_url=?,ciphertext=?,iv=?,auth_tag=?,updated_at=? WHERE provider=?', [input.baseUrl, encrypted.ciphertext, encrypted.iv, encrypted.authTag, now, 'solides']);
    else await db.query('INSERT INTO integration_credentials(id,provider,base_url,ciphertext,iv,auth_tag,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', [randomUUID(), 'solides', input.baseUrl, encrypted.ciphertext, encrypted.iv, encrypted.authTag, now, now]);
    await log(req, current ? 'update' : 'create', 'integration_credentials', 'solides');
    res.json({ saved: true, provider: 'solides', updatedAt: now });
  });
  app.use('/api', (_, res) => res.status(404).json({ message: 'Recurso não encontrado.' }));
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_, res) => res.sendFile(resolve('dist/index.html')));
  app.use((err, req, res, next) => {
    if (err instanceof z.ZodError)
      return res
        .status(422)
        .json({ message: err.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ') });
    if (/unique|duplicate/i.test(err.message))
      return res.status(409).json({ message: 'Já existe um registro com esse identificador.' });
    if (/foreign key/i.test(err.message))
      return res.status(422).json({ message: 'Departamento ou registro relacionado inválido.' });
    console.error(err.message);
    res
      .status(400)
      .json({
        message:
          err.message === 'Use imagem PNG ou JPEG.'
            ? err.message
            : 'Não foi possível salvar. Verifique os dados e tente novamente.',
      });
  });
  return app;
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const production = process.env.NODE_ENV === 'production';
  const databaseUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (production && (!databaseUrl || !/^mysql/i.test(databaseUrl) || !process.env.APP_ORIGIN?.startsWith('https://')))
    throw Error('Produção exige MYSQL_URL MySQL e APP_ORIGIN HTTPS.');
  const demo = !production && process.env.SEED_DEMO !== 'false';
  const db = await connectDb();
  await seed(db, { demo });
  const app = await createApp(db, { production, demo });
  app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () =>
    console.log(
      `DHO API http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001} · ${db.driver} · ${demo ? 'validação' : 'produção'}`,
    ),
  );
}
