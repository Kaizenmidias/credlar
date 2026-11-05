// Motor de prévia. Homologar regras/CCT antes de uso em folha ou fechamento definitivo.
export const occurrenceTypes = [
  'Falta injustificada',
  'Falta justificada',
  'Atestado',
  'Suspensão',
  'Férias',
  'Afastamento',
  'Licença',
  'Outros',
];
export function daysBetween(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    throw Error('Período inválido.');
  const a = new Date(start + 'T12:00:00Z'),
    b = new Date(end + 'T12:00:00Z');
  if (!Number.isFinite(+a) || !Number.isFinite(+b) || b < a || +b - +a > 366 * 86400000)
    throw Error('Selecione um período de até 366 dias, com início anterior ao fim.');
  const out = [];
  for (let d = +a; d <= +b; d += 86400000) out.push(new Date(d).toISOString().slice(0, 10));
  return out;
}
const weekday = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
const minutes = (t) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw Error('Horário inválido.');
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
};
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const cents = (n) => Math.round(Number(n || 0) * 100);
export function scheduled(e, date, holidays = []) {
  return (
    date >= e.admissionDate &&
    (!e.terminationDate || date <= e.terminationDate) &&
    !e.excludedDays?.includes(date) &&
    (e.extraDays?.includes(date) ||
      (e.weekdays.includes(weekday(date)) && !holidays.includes(date)))
  );
}
export function benefit(e, department, occurrences, start, end, company, type = 'va') {
  const dates = daysBetween(start, end).filter((d) => scheduled(e, d, company.holidays));
  const rules = type === 'va' ? department.vaDeductions : department.vtDeductions;
  const deductions = dates.filter((d) =>
    occurrences.some(
      (o) =>
        o.employeeId === e.id &&
        rules.includes(o.type) &&
        o.status === 'Conferido' &&
        d >= o.startDate &&
        d <= o.endDate,
    ),
  );
  const eligible = dates.length - deductions.length;
  const dailyCents = type === 'va' ? cents(e.vaDaily) : cents(e.vtFare) * e.vtTrips;
  const daily = dailyCents / 100;
  const totalCents = eligible * dailyCents;
  const additional = dates.filter((d) => e.extraDays?.includes(d)).length;
  const pending = occurrences.filter(
    (o) =>
      o.employeeId === e.id && o.status !== 'Conferido' && o.startDate <= end && o.endDate >= start,
  ).length;
  return {
    employee: e,
    baseDays: dates.length - additional,
    additional,
    discounts: deductions.length,
    eligible,
    daily,
    dailyCents,
    totalCents,
    total: totalCents / 100,
    pending,
    memory: {
      type: type.toUpperCase(),
      scheduledDates: dates,
      deductedDates: deductions,
      rule: rules,
      formula: `(${dates.length} dias previstos − ${deductions.length} dias descontados) × ${type === 'vt' ? `${e.vtTrips} passagens × ${e.vtFare}` : e.vaDaily} = ${totalCents / 100}`,
      note: 'Ocorrências pendentes não descontadas. Dias sobrepostos descontados uma única vez.',
    },
  };
}
export function audit(employees, punches, start, end, company, reviews = []) {
  const out = [];
  for (const e of employees)
    for (const date of daysBetween(start, end)) {
      const group = punches.filter((p) => p.employeeId === e.id && p.date === date);
      const times = group.flatMap((p) => p.times);
      if (!scheduled(e, date, company.holidays) && !times.length) continue;
      const issues = [];
      let severity = 'green';
      const add = (text, level = 'yellow') => {
        issues.push(text);
        if (level === 'red' || severity === 'green') severity = level;
      };
      if (times.length < e.expectedPunches)
        add(
          !times.length
            ? 'Sem marcações em dia previsto'
            : `Jornada incompleta: ${times.length} de ${e.expectedPunches} marcações; conferir entrada, saída e intervalos`,
          'red',
        );
      if (times.length > e.expectedPunches)
        add(`${times.length} marcações; escala prevê ${e.expectedPunches}`);
      let normalized = [];
      let offset = 0;
      for (let i = 0; i < times.length; i++) {
        let n = minutes(times[i]);
        if (i && n + offset < normalized[i - 1]) offset += 1440;
        normalized.push(n + offset);
        if (i) {
          let diff = normalized[i] - normalized[i - 1];
          if (times[i] === times[i - 1]) add('Marcações exatamente iguais');
          else if (diff < company.minPunchMinutes)
            add(`Marcações próximas: ${times[i - 1]} e ${times[i]} (${diff} min)`);
        }
      }
      if (new Set(times).size < times.length && !issues.includes('Marcações exatamente iguais'))
        add('Marcações repetidas');
      const expected =
        e.expectedPunches === 2
          ? [e.startTime, e.endTime]
          : e.expectedPunches === 4
            ? [e.startTime, e.breakStart, e.breakEnd, e.endTime]
            : [];
      if (!expected.length) add('Escala de 6 marcações: conferir horários detalhados na origem');
      if (
        times.length &&
        Math.abs(minutes(times[0]) - minutes(e.startTime)) > company.toleranceMinutes
      )
        add('Entrada fora do horário previsto');
      if (!scheduled(e, date, company.holidays) && times.length)
        add('Marcações em dia não previsto na escala');
      let worked = 0;
      for (let i = 0; i + 1 < normalized.length; i += 2)
        worked += normalized[i + 1] - normalized[i];
      const id = `${e.id}:${date}`,
        review = reviews.find((r) => r.key === id);
      out.push({
        id,
        employee: e,
        date,
        times,
        expected,
        issues,
        severity,
        workedMinutes: worked,
        status: review?.status || 'Pendente',
        note: review?.note || '',
        review,
      });
    }
  return out;
}
export function nightPay(e, punches, start, end, company) {
  const startMin = minutes(company.nightStart),
    endMin = minutes(company.nightEnd);
  const memory = [];
  let actual = 0;
  let excluded = 0;
  for (const p of punches.filter(
    (p) => p.employeeId === e.id && p.date >= start && p.date <= end,
  )) {
    if (
      p.times.length !== e.expectedPunches ||
      p.times.length % 2 ||
      new Set(p.times).size !== p.times.length
    ) {
      excluded++;
      continue;
    }
    let offset = 0,
      previous = -1,
      values = [];
    for (const time of p.times) {
      let m = minutes(time) + offset;
      if (m < previous) {
        offset += 1440;
        m += 1440;
      }
      values.push(m);
      previous = m;
    }
    let total = 0;
    for (let i = 0; i < values.length; i += 2) {
      const a = values[i],
        b = values[i + 1];
      for (let day = -1; day <= 2; day++) {
        const ns = day * 1440 + startMin,
          ne = day * 1440 + endMin + (endMin <= startMin ? 1440 : 0);
        let overlap = Math.max(0, Math.min(b, ne) - Math.max(a, ns));
        if (company.nightExtension && overlap > 0 && a <= ns && b > ne) overlap += b - ne;
        total += overlap;
      }
    }
    actual += total;
    if (total) memory.push({ date: p.date, minutes: total, times: p.times.join(' · ') });
  }
  const hours = actual / company.nightReducedMinutes;
  const salaryCents = cents(e.salary);
  const hourlyCents = salaryCents / company.monthlyDivisor;
  const totalCents = Math.round((hours * hourlyCents * e.nightPercent) / 100);
  const hourly = hourlyCents / 100;
  const total = totalCents / 100;
  return {
    employee: e,
    minutes: actual,
    hours: round(hours),
    hourly: round(hourly),
    percent: e.nightPercent,
    total,
    totalCents,
    excluded,
    memory: {
      days: memory,
      formula: `${actual} minutos ÷ ${company.nightReducedMinutes} × (${e.salary} ÷ ${company.monthlyDivisor}) × ${e.nightPercent}% = ${total}`,
      note: `${excluded} jornada(s) excluída(s) por marcações incompletas/repetidas. Prorrogação ${company.nightExtension ? 'ativada (prévia a homologar)' : 'desativada'}.`,
    },
  };
}
