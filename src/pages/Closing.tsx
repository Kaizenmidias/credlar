import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ScanLine,
  Wallet,
  ClipboardCheck,
  ArrowRight,
  FileCheck2,
  Download,
  LockKeyhole,
  CheckCircle2,
} from 'lucide-react';
import { useDho } from '../context';
import { Card, PageTitle, Button, Notice, Metric, Badge } from '../components/ui';
import PeriodFilter from '../components/PeriodFilter';
import { calculate } from '../lib/calculations';
import { currency } from '../lib/api';
import { audit } from '../domain/engine.mjs';
import { exportReport } from '../lib/export';
export default function Closing() {
  const { data, filters: f, notify } = useDho();
  const [prepared, setPrepared] = useState(false),
    [busy, setBusy] = useState(false);
  let c;
  try {
    c = calculate(data, f);
  } catch (e) {
    return <Notice tone="red">{(e as Error).message}</Notice>;
  }
  const pending = data.records.filter(
    (r) =>
      r.kind === 'occurrences' &&
      r.status === 'Pendente' &&
      r.startDate <= f.end &&
      r.endDate >= f.start &&
      c.employees.some((e) => e.id === r.employeeId),
  );
  let alerts: any[] = [];
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(),
    );
    alerts = audit(
      c.employees,
      data.records.filter((r) => r.kind === 'punches'),
      f.start,
      f.end < today ? f.end : today,
      data.company,
      data.records.filter((r) => r.kind === 'reviews'),
    ).filter((r: any) => r.severity !== 'green' && r.status === 'Pendente');
  } catch {}
  return (
    <>
      <PageTitle
        eyebrow="BENEFÍCIOS & FECHAMENTO"
        title="Fechamento mensal"
        description="Do primeiro registro à última conferência. Um processo que faz sentido."
        actions={
          <Button
            onClick={() => {
              setPrepared(true);
              notify('Prévia preparada. Revise todas as pendências antes de exportar.');
            }}
          >
            <ClipboardCheck size={17} />
            Preparar conferência
          </Button>
        }
      />
      <PeriodFilter />
      <div className="workflow">
        {[
          ['1', 'Definir período', 'Competência e datas livres'],
          ['2', 'Conferir informações', 'Jornadas e ocorrências'],
          ['3', 'Revisar cálculos', 'VA, VT e adicional'],
          ['4', 'Finalizar fechamento', 'Após homologação'],
        ].map(([n, t, s], i) => (
          <div className={i < 3 ? 'active' : ''} key={n}>
            <span>{n}</span>
            <div>
              <b>{t}</b>
              <small>{s}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="metric-grid three">
        <Metric
          label="Vale-alimentação"
          value={currency(c.totalVA)}
          icon={<Wallet size={20} />}
          detail="Prévia da competência"
        />
        <Metric
          label="Vale-transporte"
          value={currency(c.totalVT)}
          icon={<Wallet size={20} />}
          tone="purple"
          detail="Regra independente do VA"
        />
        <Metric
          label="Adicional noturno"
          value={currency(c.totalNight)}
          icon={<Wallet size={20} />}
          tone="orange"
          detail="Prévia sujeita à homologação"
        />
      </div>
      <div className="two-columns">
        <Card className="padded">
          <div className="card-heading">
            <h2>Checklist de conferência</h2>
            <Badge tone="orange">{pending.length + alerts.length} pendências</Badge>
          </div>
          {[
            [Users, 'Funcionários no período', c.employees.length, '/funcionarios'],
            [ClipboardCheck, 'Ocorrências pendentes', pending.length, '/ocorrencias'],
            [ScanLine, 'Alertas de ponto pendentes', alerts.length, '/auditoria'],
            [
              Wallet,
              'Memórias de cálculo',
              c.va.length + c.vt.length + c.night.length,
              '/vale-alimentacao',
            ],
          ].map(([Icon, t, v, path]: any) => (
            <Link className="checklist-row" key={path} to={path}>
              <Icon size={19} />
              <span>{t}</span>
              <b>{v}</b>
              <ArrowRight size={16} />
            </Link>
          ))}
        </Card>
        <Card className="padded closing-info">
          <LockKeyhole size={28} />
          <h2>Conferência antes de concluir.</h2>
          <p>
            O fechamento definitivo exige regras homologadas, pendências apresentadas e fotografia
            imutável dos cálculos.
          </p>
          <Notice tone="orange">
            Fechamento definitivo e reabertura com justificativa estão planejados para a Fase 4.
            Esta entrega gera uma prévia identificada para revisão.
          </Notice>
          <Button
            variant="secondary"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await exportReport(
                  'pdf',
                  data.company,
                  'Fechamento mensal - PRÉVIA',
                  ['Funcionário', 'VA', 'VT', 'Adicional noturno'],
                  c.employees.map((e, i) => [
                    e.name,
                    currency(c.va[i].total),
                    currency(c.vt[i].total),
                    currency(c.night[i].total),
                  ]),
                  `${f.competence} · ${f.start} a ${f.end} · ${pending.length + alerts.length} pendências`,
                );
              } catch (e) {
                notify((e as Error).message, 'red');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={16} />
            Exportar prévia de conferência
          </Button>
        </Card>
      </div>
      {prepared && (
        <Card>
          <div className="table-toolbar">
            <h2>Resumo por funcionário</h2>
            <Badge>Prévia · {f.competence}</Badge>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>VA</th>
                  <th>VT</th>
                  <th>Adicional noturno</th>
                  <th>Total estimado</th>
                </tr>
              </thead>
              <tbody>
                {c.employees.map((e, i) => (
                  <tr key={e.id}>
                    <td>
                      <b>{e.name}</b>
                    </td>
                    <td>{currency(c.va[i].total)}</td>
                    <td>{currency(c.vt[i].total)}</td>
                    <td>{currency(c.night[i].total)}</td>
                    <td className="amount">
                      {currency(c.va[i].total + c.vt[i].total + c.night[i].total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
