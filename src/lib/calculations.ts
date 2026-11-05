import type { Data, Filters } from '../types';
import { benefit, nightPay, audit } from '../domain/engine.mjs';
export function calculate(data: Data, f: Filters) {
  const employees = data.employees.filter(
    (e) =>
      (!f.department || e.departmentId === f.department) &&
      (!f.employee || e.id === f.employee) &&
      e.admissionDate <= f.end &&
      (!e.terminationDate || e.terminationDate >= f.start),
  );
  const occurrences = data.records.filter((r) => r.kind === 'occurrences'),
    punches = data.records.filter((r) => r.kind === 'punches');
  const va = employees.map((e) =>
    benefit(
      e,
      data.departments.find((d) => d.id === e.departmentId)!,
      occurrences,
      f.start,
      f.end,
      data.company,
      'va',
    ),
  );
  const vt = employees.map((e) =>
    benefit(
      e,
      data.departments.find((d) => d.id === e.departmentId)!,
      occurrences,
      f.start,
      f.end,
      data.company,
      'vt',
    ),
  );
  const night = employees.map((e) => nightPay(e, punches, f.start, f.end, data.company));
  return {
    employees,
    va,
    vt,
    night,
    totalVA: va.reduce((s, r) => s + r.total, 0),
    totalVT: vt.reduce((s, r) => s + r.total, 0),
    totalNight: night.reduce((s, r) => s + r.total, 0),
  };
}
