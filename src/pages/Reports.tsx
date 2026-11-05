import { useState } from 'react';
import {
  FileText,
  Users,
  CalendarDays,
  ScanLine,
  Wallet,
  Moon,
  Download,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import { useDho } from '../context';
import { Card, PageTitle, Button, Badge, Notice } from '../components/ui';
import PeriodFilter from '../components/PeriodFilter';
import { calculate } from '../lib/calculations';
import { audit } from '../domain/engine.mjs';
import { currency, dateBR } from '../lib/api';
import { exportReport } from '../lib/export';
const reports = [
  ['employees', 'Funcionários', 'Cadastro geral da equipe', Users],
  ['Falta injustificada', 'Faltas', 'Ausências registradas no período', CalendarDays],
  ['Atestado', 'Atestados', 'Registros e status de conferência', FileText],
  ['Suspensão', 'Suspensões', 'Ocorrências disciplinares registradas', FileText],
  ['Férias', 'Férias', 'Períodos de descanso cadastrados', CalendarDays],
  ['missing', 'Pontos faltantes', 'Jornadas incompletas para conferência', ScanLine],
  ['suspicious', 'Pontos suspeitos', 'Possíveis inconsistências de marcação', ScanLine],
  ['va', 'Vale-alimentação', 'Dias elegíveis e valores calculados', Wallet],
  ['vt', 'Vale-transporte', 'Passagens, tarifas e totais individuais', Wallet],
  ['night', 'Adicional noturno', 'Horas e memória de cálculo', Moon],
  ['closing', 'Fechamento mensal', 'Consolidação da prévia do período', FileSpreadsheet],
] as const;
export default function Reports() {
  const { data, filters: f, notify } = useDho();
  const [busy, setBusy] = useState('');
  const run = async (id: string, title: string, format: 'pdf' | 'xlsx') => {
    setBusy(id + format);
    try {
      const c = calculate(data, f);
      let headers: string[] = [],
        rows: any[][] = [];
      if (id === 'employees') {
        headers = ['Nome', 'Matrícula', 'Departamento', 'Cargo', 'Situação', 'Admissão'];
        rows = c.employees.map((e) => [
          e.name,
          e.registration,
          data.departments.find((d) => d.id === e.departmentId)?.name || '',
          e.jobTitle,
          e.status,
          dateBR(e.admissionDate),
        ]);
      } else if (['va', 'vt', 'night'].includes(id)) {
        headers = ['Funcionário', 'Memória de cálculo', 'Total estimado'];
        rows = (id === 'va' ? c.va : id === 'vt' ? c.vt : c.night).map((r: any) => [
          r.employee.name,
          r.memory.formula,
          r.total,
        ]);
      } else if (id === 'closing') {
        headers = ['Funcionário', 'VA', 'VT', 'Adicional noturno', 'Total'];
        rows = c.employees.map((e, i) => [
          e.name,
          c.va[i].total,
          c.vt[i].total,
          c.night[i].total,
          c.va[i].total + c.vt[i].total + c.night[i].total,
        ]);
      } else if (['missing', 'suspicious'].includes(id)) {
        headers = [
          'Funcionário',
          'Matrícula',
          'Data',
          'Marcações',
          'Possível inconsistência',
          'Conferência',
        ];
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
          new Date(),
        );
        rows = audit(
          c.employees,
          data.records.filter((r) => r.kind === 'punches'),
          f.start,
          f.end < today ? f.end : today,
          data.company,
          data.records.filter((r) => r.kind === 'reviews'),
        )
          .filter((r: any) => r.severity === (id === 'missing' ? 'red' : 'yellow'))
          .map((r: any) => [
            r.employee.name,
            r.employee.registration,
            dateBR(r.date),
            r.times.join(' · '),
            r.issues.join('; '),
            r.status,
          ]);
      } else {
        headers = ['Funcionário', 'Tipo', 'Início', 'Fim', 'Origem', 'Status'];
        rows = data.records
          .filter(
            (r) =>
              r.kind === 'occurrences' &&
              r.type === id &&
              r.startDate <= f.end &&
              r.endDate >= f.start &&
              c.employees.some((e) => e.id === r.employeeId),
          )
          .map((r) => [
            data.employees.find((e) => e.id === r.employeeId)?.name || '',
            r.type,
            dateBR(r.startDate),
            dateBR(r.endDate),
            r.source,
            r.status,
          ]);
      }
      await exportReport(
        format,
        data.company,
        title + (['va', 'vt', 'night', 'closing'].includes(id) ? ' - PRÉVIA' : ''),
        headers,
        rows,
        `${f.competence} · ${dateBR(f.start)} a ${dateBR(f.end)}`,
      );
      notify(`Relatório ${format.toUpperCase()} gerado com a identidade da empresa.`);
    } catch (e) {
      notify((e as Error).message, 'red');
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="INFORMAÇÃO QUE VIRA DECISÃO"
        title="Relatórios"
        description="Exporte informações organizadas, com a identidade de quem é responsável pelo registro."
      />
      <PeriodFilter employee />
      <div className="report-identity">
        <span className="section-icon blue">
          <Building2 size={23} />
        </span>
        <div>
          <small>EMPRESA RESPONSÁVEL PELOS RELATÓRIOS</small>
          <b>{data.company.legalName}</b>
        </div>
        {data.company.logo && <img src={data.company.logo} alt="Logo da empresa responsável" />}
        <Badge tone="green">Identidade aplicada ao PDF e Excel</Badge>
      </div>
      <div className="report-grid">
        {reports.map(([id, title, desc, Icon]) => (
          <Card key={id} className="report-card">
            <div className="report-card-head">
              <span className="section-icon blue">
                <Icon size={23} />
              </span>
              {['va', 'vt', 'night', 'closing'].includes(id) && <Badge tone="orange">Prévia</Badge>}
            </div>
            <h2>{title}</h2>
            <p>{desc}</p>
            <div className="report-actions">
              <Button
                variant="secondary"
                busy={busy === id + 'pdf'}
                disabled={!!busy}
                onClick={() => run(id, title, 'pdf')}
              >
                <FileText size={16} />
                PDF
              </Button>
              <Button
                variant="secondary"
                busy={busy === id + 'xlsx'}
                disabled={!!busy}
                onClick={() => run(id, title, 'xlsx')}
              >
                <FileSpreadsheet size={16} />
                Excel
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
