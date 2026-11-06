import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { connectDb } from '../server/db.mjs';
import { seed } from '../server/seed.mjs';
import { createApp } from '../server/index.mjs';
import { verifyPassword } from '../server/security.mjs';
test('Fase 1: sessão, CRUD, RBAC, validação, duplicidade e histórico', async (t) => {
  process.env.TEST_DB = ':memory:';
  const db = await connectDb();
  assert.deepEqual(db.migrationIds, ['001_base_schema', '002_rules_and_closings', '003_encrypted_integration_credentials', '004_units', '005_job_roles']);
  assert.equal((await db.query('SELECT id FROM schema_migrations')).rows.length, 5);
  await seed(db, { demo: true });
  const app = await createApp(db, { demo: true });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = '';
  const req = async (path, method = 'GET', body, auth = true) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-dho-request': '1',
        ...(auth ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie') };
  };
  try {
    await t.test('dados protegidos por autenticação', async () =>
      assert.equal((await req('/bootstrap')).status, 401),
    );
    const login = await req('/auth/login', 'POST', {
      email: 'admin@dho.local',
      password: 'DhoLocal!2026',
    });
    cookie = login.cookie.split(';')[0];
    assert.equal(login.status, 200);
    assert.ok(login.cookie.includes('HttpOnly'));
    assert.ok(login.cookie.includes('SameSite=Strict'));
    await t.test('senha armazenada com hash, nunca em texto puro', async () => {
      const u = (await db.query('SELECT password FROM users')).rows[0];
      assert.ok(verifyPassword('DhoLocal!2026', u.password));
      assert.notEqual(u.password, 'DhoLocal!2026');
    });
    const boot = (await req('/bootstrap')).data;
    assert.equal(boot.employees.length, 12);
    await t.test('prévias de VA, VT e adicional noturno são calculadas no servidor', async () => {
      for (const type of ['va', 'vt', 'night']) {
        const result = await req('/calculations/preview', 'POST', {
          type,
          start: '2026-10-21',
          end: '2026-10-31',
          departmentId: '',
          employeeId: '',
        });
        assert.equal(result.status, 200);
        assert.equal(result.data.preview, true);
        assert.equal(result.data.rows.length, 12);
        assert.equal(typeof result.data.total, 'number');
        assert.equal(Number.isInteger(result.data.totalCents), true);
        assert.equal(Number.isInteger(result.data.rows[0].totalCents), true);
        assert.ok(result.data.rows[0].memory.formula);
      }
    });
    await t.test('regras possuem vigência e impedem sobreposição ativa', async () => {
      const rule = {
        benefitType: 'va',
        departmentId: boot.departments[0].id,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        active: true,
        data: { deductions: ['Falta injustificada'], dailyCents: 3200 },
      };
      assert.equal((await req('/calculation-rules', 'POST', rule)).status, 201);
      assert.equal((await req('/calculation-rules', 'POST', rule)).status, 409);
      const rules = await req('/calculation-rules');
      assert.equal(rules.status, 200);
      assert.equal(rules.data[0].data.dailyCents, 3200);
    });
    await t.test('fechamento cria snapshot e mantém finalização bloqueada sem homologação', async () => {
      const draft = await req('/closings/draft', 'POST', {
        competence: '2026-11',
        start: '2026-10-21',
        end: '2026-10-31',
        departmentId: '',
      });
      assert.equal(draft.status, 201);
      assert.equal(draft.data.status, 'draft');
      assert.equal(draft.data.snapshot.calculations.length, 12);
      assert.equal(Number.isInteger(draft.data.snapshot.totals.vaCents), true);
      const history = await req('/closings');
      assert.equal(history.data[0].id, draft.data.id);
      assert.equal((await req(`/closings/${draft.data.id}/finalize`, 'POST', {})).status, 422);
    });
    await t.test('cadastro e atualização persistem; conflito de versão é impedido', async () => {
      const draft = { ...boot.employees[0], registration: 'CRTEST', name: 'Pessoa de teste' };
      const add = await req('/employees', 'POST', draft);
      assert.equal(add.status, 201);
      const update = await req('/employees/' + add.data.id, 'PUT', {
        ...add.data,
        jobTitle: 'Novo cargo',
      });
      assert.equal(update.status, 200);
      assert.equal((await req('/employees/' + add.data.id, 'PUT', add.data)).status, 409);
      assert.ok((await req('/bootstrap')).data.employees.some((e) => e.jobTitle === 'Novo cargo'));
    });
    await t.test('CPF inválido e matrícula duplicada são rejeitados', async () => {
      assert.equal(
        (
          await req('/employees', 'POST', {
            ...boot.employees[0],
            registration: 'INVALID',
            cpf: '11111111111',
          })
        ).status,
        422,
      );
      assert.equal((await req('/employees', 'POST', boot.employees[0])).status, 409);
    });
    await t.test('importação repetida é idempotente', async () => {
      const record = {
        employeeId: boot.employees[0].id,
        date: '2026-11-03',
        times: ['08:00', '12:00', '13:00', '17:00'],
      };
      assert.equal((await req('/records/punches', 'POST', record)).status, 201);
      assert.equal((await req('/records/punches', 'POST', record)).data.duplicate, true);
    });
    await t.test('fechamento definitivo é bloqueado até homologação', async () =>
      assert.equal((await req('/records/closings', 'POST', {})).status, 422),
    );
    await t.test('origem externa e ausência de cabeçalho são bloqueadas', async () => {
      const r = await fetch(base + '/company', {
        method: 'PUT',
        headers: {
          cookie,
          'content-type': 'application/json',
          'x-dho-request': '1',
          origin: 'https://evil.invalid',
        },
        body: JSON.stringify(boot.company),
      });
      assert.equal(r.status, 403);
    });
    await t.test('histórico registra ações sem senha', async () => {
      const logs = (await req('/history')).data;
      assert.ok(logs.some((l) => l.entity === 'employees'));
      assert.ok(!JSON.stringify(logs).includes('DhoLocal!2026'));
    });
    await t.test('consulta não pode cadastrar ou administrar usuários', async () => {
      await req('/users', 'POST', {
        name: 'Consulta teste',
        email: 'consulta@exemplo.invalid',
        role: 'consulta',
        password: 'Consulta!2026',
        active: true,
      });
      const view = await req('/auth/login', 'POST', {
        email: 'consulta@exemplo.invalid',
        password: 'Consulta!2026',
      });
      cookie = view.cookie.split(';')[0];
      assert.equal((await req('/bootstrap')).status, 200);
      assert.equal((await req('/employees', 'POST', boot.employees[0])).status, 403);
      assert.equal((await req('/users')).status, 403);
    });
    await t.test('logout revoga sessão', async () => {
      await req('/auth/logout', 'POST');
      assert.equal((await req('/bootstrap')).status, 401);
    });
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
  }
});
