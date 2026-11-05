import { Link } from 'react-router-dom';
import {
  Users,
  ClipboardList,
  ScanLine,
  Wallet,
  ArrowUpRight,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Building2,
  Download,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useDho } from '../context';
import { Card, PageTitle, Metric, Badge, Button } from '../components/ui';
import PeriodFilter from '../components/PeriodFilter';
import { currency, dateBR, initials } from '../lib/api';
import { benefit, nightPay, audit, daysBetween } from '../domain/engine.mjs';
export default function Dashboard() {
  const { data, filters: f } = useDho();
  const emps = data.employees.filter(
    (e) => (!f.department || e.departmentId === f.department) && e.status !== 'Desligado',
  );
  const occ = data.records.filter(
    (r) =>
      r.kind === 'occurrences' &&
      r.startDate <= f.end &&
      r.endDate >= f.start &&
      emps.some((e) => e.id === r.employeeId),
  );
  const punches = data.records.filter((r) => r.kind === 'punches');
  let va = 0,
    vt = 0,
    night = 0,
    alerts: any[] = [];
  try {
    for (const e of emps) {
      const d = data.departments.find((d) => d.id === e.departmentId)!;
      va += benefit(e, d, occ, f.start, f.end, data.company, 'va').total;
      vt += benefit(e, d, occ, f.start, f.end, data.company, 'vt').total;
      night += nightPay(e, punches, f.start, f.end, data.company).total;
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(),
    );
    alerts = audit(
      emps,
      punches,
      f.start,
      f.end < today ? f.end : today,
      data.company,
      data.records.filter((r) => r.kind === 'reviews'),
    ).filter((r: any) => r.severity !== 'green' && r.status === 'Pendente');
  } catch {}
  const distribution = data.departments
    .map((d) => ({
      name: d.name,
      value: emps.filter((e) => e.departmentId === d.id).length,
      color: d.color,
    }))
    .filter((d) => d.value);
  let activity: { day: string; regulares: number; pendentes: number }[] = [];
  try {
    const dates = daysBetween(f.start, f.end);
    const chunkSize = Math.max(1, Math.ceil(dates.length / 7));
    activity = dates
      .filter((_, i) => i % chunkSize === 0)
      .map((ds, i) => {
        const bucket = dates.slice(i * chunkSize, (i + 1) * chunkSize);
        const records = punches.filter(
          (p) => bucket.includes(p.date) && emps.some((e) => e.id === p.employeeId),
        );
        const complete = records.filter(
          (p) => p.times.length === emps.find((e) => e.id === p.employeeId)?.expectedPunches,
        ).length;
        return {
          day: dateBR(ds).slice(0, 5),
          regulares: complete,
          pendentes: records.length - complete,
        };
      });
  } catch {}
  const pending = occ.filter((o) => o.status === 'Pendente');
  return (
    <>
      <PageTitle
        eyebrow="SEU CENTRO DE GESTÃO"
        title="Visão geral"
        description="Tudo o que importa para cuidar das pessoas e fechar o mês com confiança."
        actions={
          <Link className="btn secondary" to="/relatorios">
            <Download size={16} />
            Exportar relatórios
          </Link>
        }
      />
      <PeriodFilter />
      <div className="metric-grid">
        <Metric
          label="Funcionários ativos"
          value={emps.filter((e) => e.status === 'Ativo').length}
          icon={<Users size={21} />}
          detail={
            <>
              <span className="positive">●</span> Pessoas que fazem acontecer
            </>
          }
        />
        <Metric
          label="Ocorrências no período"
          value={occ.length}
          icon={<ClipboardList size={21} />}
          tone="purple"
          detail={<>{pending.length} aguardando conferência</>}
        />
        <Metric
          label="Pontos para conferir"
          value={alerts.length}
          icon={<ScanLine size={21} />}
          tone="orange"
          detail="Alertas indicativos, sujeitos à revisão"
        />
        <Metric
          label="Benefícios estimados"
          value={currency(va + vt)}
          icon={<Wallet size={21} />}
          tone="green"
          detail="VA + VT · prévia da competência"
        />
      </div>
      <div className="dashboard-main">
        <Card className="journey-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">CONTROLE DE JORNADA</span>
              <h2>A presença que faz a diferença</h2>
              <p>Marcações importadas e jornadas para conferir.</p>
            </div>
            <Link to="/auditoria" className="icon-btn" title="Ir para auditoria">
              <ArrowUpRight size={21} />
            </Link>
          </div>
          <div className="chart-legend">
            <span>
              <i style={{ background: '#3867ef' }} />
              Jornadas completas
            </span>
            <span>
              <i style={{ background: '#b9c9f6' }} />A conferir
            </span>
          </div>
          <div className="area-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity} margin={{ top: 15, right: 12, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3867ef" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#3867ef" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="4 4" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8a96ac', fontSize: 11 }}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8a96ac', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e9edf4', fontSize: 12 }}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  name="Jornadas completas"
                  dataKey="regulares"
                  stroke="#3867ef"
                  strokeWidth={3}
                  fill="url(#blueGradient)"
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  name="A conferir"
                  dataKey="pendentes"
                  stroke="#b0c1f2"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">
            <span>
              <span className="status-dot" /> Dados do período selecionado
            </span>
            <Link to="/integracao">
              Gerenciar importações <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
        <Card className="department-chart">
          <div className="card-heading">
            <div>
              <h2>Nossa equipe</h2>
              <p>Distribuição por departamento</p>
            </div>
            <Building2 size={19} />
          </div>
          <div className="donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={distribution}
                  dataKey="value"
                  innerRadius={70}
                  outerRadius={88}
                  paddingAngle={5}
                  stroke="none"
                >
                  {distribution.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <b>{emps.length}</b>
              <small>funcionários</small>
            </div>
          </div>
          <div className="department-legend">
            {distribution.map((d) => (
              <div key={d.name}>
                <span>
                  <i style={{ background: d.color }} />
                  {d.name}
                </span>
                <b>
                  {d.value} <small>{Math.round((d.value / Math.max(1, emps.length)) * 100)}%</small>
                </b>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="dashboard-lower">
        <Card className="pending-card">
          <div className="card-heading">
            <div>
              <h2>
                Pendências que merecem atenção <span className="count-label">{pending.length}</span>
              </h2>
              <p>Uma conferência hoje, um fechamento mais tranquilo amanhã.</p>
            </div>
            <Link to="/ocorrencias" className="text-link">
              Ver todas
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Ocorrência</th>
                  <th>Período</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.slice(0, 4).map((o) => {
                  const e = data.employees.find((e) => e.id === o.employeeId);
                  return (
                    <tr key={o.id}>
                      <td>
                        <div className="person">
                          <span className="avatar">{initials(e?.name || '?')}</span>
                          <div>
                            <b>{e?.name}</b>
                            <small>{e?.registration}</small>
                          </div>
                        </div>
                      </td>
                      <td>{o.type}</td>
                      <td>
                        {dateBR(o.startDate).slice(0, 5)} – {dateBR(o.endDate).slice(0, 5)}
                      </td>
                      <td>
                        <Badge tone="orange">Pendente</Badge>
                      </td>
                      <td>
                        <Link to="/ocorrencias" className="icon-btn" title="Conferir ocorrência">
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!pending.length && (
                  <tr>
                    <td colSpan={5}>Todas as ocorrências foram conferidas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="closing-callout">
          <div className="callout-icon">
            <CalendarCheck size={25} />
          </div>
          <Badge>COMPETÊNCIA {f.competence.split('-').reverse().join('/')}</Badge>
          <h2>
            Seu fechamento,
            <br />
            sob controle.
          </h2>
          <p>Confira jornadas, ocorrências e benefícios em um só lugar.</p>
          <div className="closing-step">
            <CheckCircle2 size={17} />
            Cadastros centralizados
          </div>
          <div className="closing-step">
            <Clock3 size={17} /> {pending.length} ocorrências aguardando revisão
          </div>
          <Link to="/fechamento" className="btn">
            Preparar fechamento
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
      <div className="finance-summary">
        <Link to="/vale-alimentacao">
          <span className="finance-icon blue">
            <Wallet size={20} />
          </span>
          <div>
            <small>Vale-alimentação</small>
            <b>{currency(va)}</b>
          </div>
          <span>
            Prévia
            <ArrowUpRight size={17} />
          </span>
        </Link>
        <Link to="/vale-transporte">
          <span className="finance-icon purple">
            <Wallet size={20} />
          </span>
          <div>
            <small>Vale-transporte</small>
            <b>{currency(vt)}</b>
          </div>
          <span>
            Prévia
            <ArrowUpRight size={17} />
          </span>
        </Link>
        <Link to="/adicional-noturno">
          <span className="finance-icon orange">
            <Clock3 size={20} />
          </span>
          <div>
            <small>Adicional noturno</small>
            <b>{currency(night)}</b>
          </div>
          <span>
            Prévia
            <ArrowUpRight size={17} />
          </span>
        </Link>
      </div>
      <div className="occurrence-summary">
        {['Falta injustificada', 'Atestado', 'Suspensão', 'Férias', 'Afastamento'].map((t) => (
          <Link key={t} to={'/ocorrencias?tipo=' + encodeURIComponent(t)}>
            <span>{t === 'Falta injustificada' ? 'Faltas' : t}</span>
            <b>{occ.filter((o) => o.type === t).length}</b>
            <ArrowUpRight size={14} />
          </Link>
        ))}
      </div>
    </>
  );
}
