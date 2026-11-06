import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connectDb } from './db.mjs';
import { validCpf } from './security.mjs';

const sourceRows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const db = await connectDb();
const clean = (value) => String(value ?? '').trim();
const key = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const digits = (value) => clean(value).replace(/\D/g, '');
const parseDate = (value) => { const text = clean(value); const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : ''; };
const parseMoney = (value) => { const text = clean(value).replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.'); const number = Number(text); return Number.isFinite(number) ? number : 0; };
const employees = (await db.query('SELECT id,registration,cpf,data FROM employees')).rows.map((row) => ({ ...row, data: JSON.parse(row.data) }));
const byCpf = new Map(employees.filter((row) => row.cpf).map((row) => [digits(row.cpf), row]));
const byRegistration = new Map(employees.map((row) => [key(row.registration), row]));
const byName = new Map(employees.map((row) => [key(row.data.name), row]));
const getDepartment = async (name, contractType) => { const existing = (await db.query('SELECT id FROM departments WHERE LOWER(name)=LOWER(?)', [name])).rows[0]; if (existing) return existing.id; const id = randomUUID(); const data = { name, manager: '', description: 'Importado da planilha de colaboradores.', color: '#3764eb', weekdays: [1,2,3,4,5], vaDeductions: ['Falta injustificada','Suspensão'], vtDeductions: ['Falta injustificada','Atestado','Férias'], sundayPolicy: 'Revisão por escala e convenção coletiva', womenSundayRest: 2, contractType }; await db.query('INSERT INTO departments(id,name,data) VALUES (?,?,?)', [id, name, JSON.stringify(data)]); return id; };
const getUnit = async (name, contractType) => { if (!name) return ''; const existing = (await db.query('SELECT id FROM units WHERE LOWER(name)=LOWER(?)', [name])).rows[0]; if (existing) return existing.id; const id = randomUUID(); await db.query('INSERT INTO units(id,name,data) VALUES (?,?,?)', [id, name, JSON.stringify({ name, description: 'Importada da planilha de colaboradores.', contractType, source: 'Planilha Sólides' })]); return id; };
const getRole = async (name) => { if (!name) return { id: '', name: '' }; const existing = (await db.query('SELECT id,name FROM job_roles WHERE LOWER(name)=LOWER(?)', [name])).rows[0]; if (existing) return existing; const id = randomUUID(); await db.query('INSERT INTO job_roles(id,name,source_id,cbo,data) VALUES (?,?,?,?,?)', [id, name, null, '', JSON.stringify({ name, source: 'Planilha Sólides' })]); return { id, name }; };
let matched = 0, created = 0, enriched = 0, unmatched = 0;
for (const row of sourceRows) {
  const name = clean(row['Nome']); if (!name) continue;
  const cpf = digits(row['CPF']); const registration = clean(row['Matrícula']);
  const contractText = key(row['Tipo de contrato']); const contractType = /prestador|pessoa juridica|pj/.test(contractText) ? 'PJ' : 'CLT';
  const roleName = clean(row['Cargo']); const departmentName = clean(row['Departamento']) || 'Sem departamento informado pela planilha'; const unitName = clean(row['Unidade']);
  const departmentId = await getDepartment(departmentName, contractType); const unitId = await getUnit(unitName, contractType); const role = await getRole(roleName);
  const current = (cpf && validCpf(cpf) ? byCpf.get(cpf) : null) || (registration ? byRegistration.get(key(registration)) : null) || byName.get(key(name));
  const admissionDate = parseDate(row['Data de admissão']); const terminationDate = parseDate(row['Data de demissão']); const genderText = key(row['Gênero'] || row['Sexo']); const gender = genderText.startsWith('f') ? 'Feminino' : genderText.startsWith('m') ? 'Masculino' : 'Não informado';
  const spreadsheet = { ...row, origem: 'Planilha colaboradores_1793936018.xls', importadoEm: new Date().toISOString() };
  const base = current?.data || { name, registration: registration || cpf || randomUUID(), cpf: validCpf(cpf) ? cpf : '', gender, departmentId, unitId, jobTitle: roleName || 'Revisar cargo', contractType, email: clean(row['Email Empresarial'] || row['Email'] || row['Email Pessoal']), admissionDate: admissionDate || new Date().toISOString().slice(0,10), terminationDate, salary: parseMoney(row['Salário']), weeklyHours: 44, scheduleName: clean(row['Turno']) || 'Revisar escala importada', weekdays: [1,2,3,4,5], startTime: '08:00', breakStart: '12:00', breakEnd: '13:00', endTime: '17:00', expectedPunches: 4, vaDaily: 0, vtFare: 0, vtTrips: 2, nightPercent: 20, status: terminationDate ? 'Desligado' : 'Ativo', extraDays: [], excludedDays: [], solidesData: {} };
  const next = { ...base, name: base.name || name, registration: base.registration || registration || cpf, cpf: base.cpf || (validCpf(cpf) ? cpf : ''), gender: base.gender === 'Não informado' ? gender : base.gender, departmentId, unitId: base.unitId || unitId, jobTitle: roleName || base.jobTitle, jobRoleId: role.id || base.jobRoleId || '', contractType, email: base.email || clean(row['Email Empresarial'] || row['Email'] || row['Email Pessoal']), admissionDate: base.admissionDate || admissionDate, terminationDate: base.terminationDate || terminationDate, salary: base.salary || parseMoney(row['Salário']), status: terminationDate || base.status === 'Desligado' ? 'Desligado' : base.status, solidesData: { ...(base.solidesData || {}), planilha: spreadsheet } };
  if (current) { await db.query('UPDATE employees SET registration=?,cpf=?,department_id=?,data=?,version=version+1 WHERE id=?', [next.registration, next.cpf || null, next.departmentId, JSON.stringify({ ...next, id: current.id }), current.id]); matched++; enriched++; }
  else { const id = randomUUID(); await db.query('INSERT INTO employees(id,registration,cpf,department_id,data) VALUES (?,?,?,?,?)', [id, next.registration, next.cpf || null, next.departmentId, JSON.stringify({ ...next, id })]); created++; }
}
console.log(JSON.stringify({ rows: sourceRows.length, matched, created, enriched, unmatched }));
await db.close();
