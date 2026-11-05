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
});
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
  jobTitle: z.string().min(2),
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
  for (const [name, schema] of [
    ['employees', empSchema],
    ['departments', deptSchema],
  ]) {
    app.post(
      `/api/${name}`,
      write,
      ...(name === 'departments' ? [admin] : []),
      async (req, res) => {
        const d = schema.parse(req.body),
          id = randomUUID();
        if (name === 'employees')
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
        else
          await db.query('INSERT INTO departments(id,name,data) VALUES (?,?,?)', [
            id,
            d.name,
            JSON.stringify(d),
          ]);
        await log(req, 'create', name, id);
        res.status(201).json({ ...d, id, version: 1 });
      },
    );
    app.put(
      `/api/${name}/:id`,
      write,
      ...(name === 'departments' ? [admin] : []),
      async (req, res) => {
        const d = schema.parse(req.body);
        const version = z.number().int().min(1).parse(req.body.version);
        const sql =
          name === 'employees'
            ? 'UPDATE employees SET registration=?,cpf=?,department_id=?,data=?,version=version+1 WHERE id=? AND version=?'
            : 'UPDATE departments SET name=?,data=?,version=version+1 WHERE id=? AND version=?';
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
  app.post('/api/integration/test', admin, (_, res) =>
    res
      .status(422)
      .json({
        message:
          'Conector aguardando homologação: token autorizado e contrato Swagger da sua conta. Nenhuma chamada externa foi realizada.',
      }),
  );
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
  if (production && (!process.env.DATABASE_URL || !process.env.APP_ORIGIN?.startsWith('https://')))
    throw Error('Produção exige DATABASE_URL PostgreSQL e APP_ORIGIN HTTPS.');
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
