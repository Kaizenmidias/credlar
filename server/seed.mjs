import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connectDb } from './db.mjs';
import { hashPassword } from './security.mjs';
export async function seed(db, { demo = false } = {}) {
  if (!(await db.query('SELECT id FROM users')).rows.length) {
    const email = process.env.ADMIN_EMAIL || (demo ? 'admin@dho.local' : null),
      password = process.env.ADMIN_PASSWORD || (demo ? 'DhoLocal!2026' : null);
    if (!email || !password || password.length < 12)
      throw Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres) antes de iniciar.');
    await db.query(
      'INSERT INTO users (id,name,email,password,role,created_at) VALUES (?,?,?,?,?,?)',
      [
        randomUUID(),
        'Administrador',
        email.toLowerCase(),
        hashPassword(password),
        'admin',
        new Date().toISOString(),
      ],
    );
  }
  if (!(await db.query('SELECT id FROM company')).rows.length) {
    let logo = '';
    try {
      logo = `data:image/png;base64,${readFileSync('public/logos/meridio.png').toString('base64')}`;
    } catch {}
    await db.query('INSERT INTO company(id,data) VALUES (?,?)', [
      'company',
      JSON.stringify({
        legalName: 'Merídio Broker',
        tradeName: 'Merídio Broker',
        cnpj: '',
        email: '',
        phone: '',
        address: '',
        logo,
        minPunchMinutes: 10,
        toleranceMinutes: 10,
        holidays: [],
        nightStart: '22:00',
        nightEnd: '05:00',
        nightReducedMinutes: 52.5,
        nightExtension: false,
        monthlyDivisor: 220,
        timezone: 'America/Sao_Paulo',
        defaultStartDay: 21,
        defaultEndDay: 20,
      }),
    ]);
  }
  if (!demo || (await db.query('SELECT id FROM departments')).rows.length) return;
  const depts = [
    {
      id: 'sede',
      name: 'Sede',
      manager: 'Mariana Costa',
      description: 'Administrativo, financeiro e DHO',
      color: '#3764eb',
      weekdays: [1, 2, 3, 4, 5],
    },
    {
      id: 'vendas',
      name: 'Sala de vendas',
      manager: 'Rafael Almeida',
      description: 'Relacionamento e operações comerciais',
      color: '#9066e5',
      weekdays: [1, 2, 3, 4, 5, 6],
    },
  ];
  for (const d of depts) {
    Object.assign(d, {
      vaDeductions: ['Falta injustificada', 'Suspensão'],
      vtDeductions: [
        'Falta injustificada',
        'Falta justificada',
        'Atestado',
        'Suspensão',
        'Férias',
        'Afastamento',
        'Licença',
      ],
      sundayPolicy: 'Revisão manual conforme escala e convenção',
      womenSundayRest: 2,
    });
    await db.query('INSERT INTO departments(id,name,data) VALUES (?,?,?)', [
      d.id,
      d.name,
      JSON.stringify(d),
    ]);
  }
  const names = [
    'Mariana Costa',
    'Rafael Almeida',
    'Ana Beatriz Souza',
    'Lucas Ferreira',
    'Camila Oliveira',
    'Pedro Henrique Lima',
    'Juliana Santos',
    'Gabriel Rodrigues',
    'Fernanda Martins',
    'Bruno Carvalho',
    'Larissa Ribeiro',
    'Thiago Nascimento',
  ];
  for (let i = 0; i < names.length; i++) {
    const e = {
      id: `emp-${i + 1}`,
      name: names[i],
      registration: `CR${String(i + 1).padStart(4, '0')}`,
      cpf: '',
      gender: i % 2 ? 'Masculino' : 'Feminino',
      departmentId: i % 3 ? 'vendas' : 'sede',
      jobTitle: ['Analista de DHO', 'Consultor comercial', 'Assistente comercial'][i % 3],
      email: `pessoa${i + 1}@exemplo.invalid`,
      admissionDate: '2025-03-10',
      terminationDate: '',
      salary: 3200 + i * 180,
      weeklyHours: 44,
      scheduleName: i % 3 ? '6×1 · comercial' : '5×2 · administrativo',
      weekdays: i % 3 ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
      startTime: '08:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      endTime: '17:00',
      expectedPunches: 4,
      vaDaily: 32,
      vtFare: 5.5,
      vtTrips: 2,
      nightPercent: 20,
      status: 'Ativo',
      extraDays: [],
      excludedDays: [],
    };
    await db.query(
      'INSERT INTO employees(id,registration,cpf,department_id,data) VALUES (?,?,?,?,?)',
      [e.id, e.registration, null, e.departmentId, JSON.stringify(e)],
    );
    for (let day = 21; day <= 30; day++) {
      const date = `2026-10-${day}`,
        weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      if (!e.weekdays.includes(weekday)) continue;
      const times =
        day === 22 && i === 2
          ? ['07:58', '12:01', '17:05']
          : day === 23 && i === 3
            ? ['08:00', '12:00', '13:00', '18:05', '18:08']
            : ['08:00', '12:00', '13:00', '17:00'];
      const record = { id: randomUUID(), employeeId: e.id, date, times, source: 'Dados fictícios' };
      await db.query('INSERT INTO records(id,kind,data) VALUES (?,?,?)', [
        record.id,
        'punches',
        JSON.stringify(record),
      ]);
    }
  }
  for (const [i, type, date, endDate] of [
    [0, 'Atestado', '2026-10-26', '2026-10-27'],
    [1, 'Falta injustificada', '2026-10-28', '2026-10-28'],
    [4, 'Férias', '2026-11-02', '2026-11-13'],
    [6, 'Suspensão', '2026-10-29', '2026-10-29'],
  ]) {
    const id = randomUUID();
    await db.query('INSERT INTO records(id,kind,data) VALUES (?,?,?)', [
      id,
      'occurrences',
      JSON.stringify({
        id,
        employeeId: `emp-${Number(i) + 1}`,
        type,
        startDate: date,
        endDate,
        status: 'Pendente',
        note: 'Registro fictício para validação dos fluxos.',
        source: 'Manual',
      }),
    ]);
  }
}
if (process.argv[1]?.endsWith('seed.mjs')) {
  const db = await connectDb();
  await seed(db, { demo: process.env.SEED_DEMO === 'true' });
  await db.close();
  console.log('Banco preparado.');
}
