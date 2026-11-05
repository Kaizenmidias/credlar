import test from 'node:test';
import assert from 'node:assert/strict';
import { benefit, audit, nightPay, daysBetween } from '../src/domain/engine.mjs';
const e = {
  id: 'e1',
  name: 'Teste',
  admissionDate: '2025-01-01',
  terminationDate: '',
  weekdays: [1, 2, 3, 4, 5],
  extraDays: [],
  excludedDays: [],
  startTime: '08:00',
  breakStart: '12:00',
  breakEnd: '13:00',
  endTime: '17:00',
  expectedPunches: 4,
  vaDaily: 30,
  vtFare: 5,
  vtTrips: 2,
  salary: 2200,
  nightPercent: 20,
};
const d = {
  vaDeductions: ['Falta injustificada'],
  vtDeductions: ['Atestado', 'Falta injustificada'],
};
const company = {
  holidays: [],
  minPunchMinutes: 10,
  toleranceMinutes: 10,
  nightStart: '22:00',
  nightEnd: '05:00',
  nightReducedMinutes: 52.5,
  nightExtension: false,
  monthlyDivisor: 220,
};
test('VA e VT usam regras independentes e não descontam ocorrências pendentes', () => {
  const occ = [
    {
      employeeId: 'e1',
      type: 'Atestado',
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      status: 'Conferido',
    },
    {
      employeeId: 'e1',
      type: 'Falta injustificada',
      startDate: '2026-11-04',
      endDate: '2026-11-04',
      status: 'Pendente',
    },
  ];
  assert.equal(benefit(e, d, occ, '2026-11-02', '2026-11-06', company, 'va').total, 150);
  assert.equal(benefit(e, d, occ, '2026-11-02', '2026-11-06', company, 'vt').total, 30);
});
test('sobreposição de ocorrências desconta cada data uma vez', () => {
  const o = {
    employeeId: 'e1',
    type: 'Falta injustificada',
    startDate: '2026-11-02',
    endDate: '2026-11-04',
    status: 'Conferido',
  };
  const r = benefit(
    e,
    d,
    [o, { ...o, startDate: '2026-11-03' }],
    '2026-11-02',
    '2026-11-06',
    company,
  );
  assert.equal(r.discounts, 3);
  assert.equal(r.total, 60);
});
test('calendário, admissão, folgas e dias adicionais são considerados', () => {
  const person = {
    ...e,
    admissionDate: '2026-11-03',
    extraDays: ['2026-11-07'],
    excludedDays: ['2026-11-04'],
  };
  const r = benefit(person, d, [], '2026-11-02', '2026-11-08', {
    ...company,
    holidays: ['2026-11-05'],
  });
  assert.equal(r.eligible, 3);
  assert.equal(r.additional, 1);
});
test('auditoria diferencia quantidades individuais e detecta marcações próximas', () => {
  const people = [e, { ...e, id: 'e2', expectedPunches: 2 }];
  const rows = audit(
    people,
    [
      { employeeId: 'e1', date: '2026-11-02', times: ['08:00', '12:00', '13:00'] },
      { employeeId: 'e2', date: '2026-11-02', times: ['18:05', '18:08'] },
    ],
    '2026-11-02',
    '2026-11-02',
    company,
  );
  assert.equal(rows[0].severity, 'red');
  assert.equal(rows[1].severity, 'yellow');
  assert.ok(rows[1].issues.some((i) => i.includes('próximas')));
});
test('adicional atravessa meia-noite e aplica hora reduzida', () => {
  const person = { ...e, expectedPunches: 2 };
  const r = nightPay(
    person,
    [{ employeeId: 'e1', date: '2026-11-02', times: ['22:00', '05:00'] }],
    '2026-11-02',
    '2026-11-02',
    company,
  );
  assert.equal(r.minutes, 420);
  assert.equal(r.hours, 8);
  assert.equal(r.total, 16);
});
test('jornada incompleta não gera adicional noturno estimado', () => {
  const r = nightPay(
    e,
    [{ employeeId: 'e1', date: '2026-11-02', times: ['22:00', '02:00', '03:00'] }],
    '2026-11-02',
    '2026-11-02',
    company,
  );
  assert.equal(r.total, 0);
  assert.equal(r.excluded, 1);
});
test('período invertido ou excessivo é rejeitado', () => {
  assert.throws(() => daysBetween('2026-11-20', '2026-10-21'));
  assert.throws(() => daysBetween('2020-01-01', '2026-01-01'));
});
