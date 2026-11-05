import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  Users,
  CalendarDays,
  Download,
  Calculator,
  FileText,
  Moon,
  ArrowRight,
} from 'lucide-react';
import { useDho } from '../context';
import {
  Card,
  PageTitle,
  Button,
  Metric,
  Notice,
  Modal,
  Badge,
  Pagination,
} from '../components/ui';
import PeriodFilter from '../components/PeriodFilter';
import { currency } from '../lib/api';
import { calculate } from '../lib/calculations';
import { exportReport } from '../lib/export';
export default function Benefits({ type }: { type: 'va' | 'vt' | 'night' }) {
  const { data, filters: f, notify } = useDho();
  const [memory, setMemory] = useState<any>(null),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false);
  let calc;
  try {
    calc = calculate(data, f);
  } catch (e) {
    return <Notice tone="red">{(e as Error).message}</Notice>;
  }
  const rows = type === 'va' ? calc.va : type === 'vt' ? calc.vt : calc.night,
    total = type === 'va' ? calc.totalVA : type === 'vt' ? calc.totalVT : calc.totalNight;
  const title =
    type === 'va' ? 'Vale-alimentação' : type === 'vt' ? 'Vale-transporte' : 'Adicional noturno';
  const headers =
    type === 'night'
      ? ['Funcionário', 'Salário-base', 'Horas reduzidas', 'Percentual', 'Valor']
      : [
          'Funcionário',
          'Dias-base',
          'Adicionais',
          'Descontos',
          'Elegíveis',
          'Valor diário',
          'Total',
        ];
  const exportRows = rows.map((r: any) =>
    type === 'night'
      ? [r.employee.name, r.employee.salary, r.hours, r.percent, r.total]
      : [r.employee.name, r.baseDays, r.additional, r.discounts, r.eligible, r.daily, r.total],
  );
  return (
    <>
      <PageTitle
        eyebrow="BENEFÍCIOS & FECHAMENTO"
        title={title}
        description={
          type === 'night'
            ? 'Apuração transparente, com parâmetros noturnos configuráveis.'
            : 'Uma apuração clara, respeitando as regras de cada pessoa e departamento.'
        }
        actions={
          <>
            <Link className="btn secondary" to="/configuracoes">
              <Calculator size={16} />
              Regras de cálculo
            </Link>
            <Button
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await exportReport(
                    'xlsx',
                    data.company,
                    title + ' - Prévia',
                    headers,
                    exportRows,
                    `${f.start} a ${f.end}`,
                  );
                } catch (e) {
                  notify((e as Error).message, 'red');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download size={16} />
              Exportar Excel
            </Button>
          </>
        }
      />
      <PeriodFilter employee />
      <Notice tone="orange">
        <Calculator size={18} />
        <span>
          <b>Prévia para conferência.</b>{' '}
          {type === 'night'
            ? 'Parâmetros de hora reduzida e prorrogação precisam de homologação. Jornadas incompletas são excluídas.'
            : 'Somente ocorrências conferidas elegíveis à regra são descontadas. Sobreposições descontam uma única vez.'}
        </span>
      </Notice>
      <div className="metric-grid three">
        <Metric
          label="Total estimado"
          value={currency(total)}
          icon={<Wallet size={20} />}
          detail="Valores para conferência do DHO"
        />
        <Metric
          label="Funcionários no período"
          value={rows.length}
          icon={<Users size={20} />}
          tone="purple"
          detail="Conforme vínculo e filtros selecionados"
        />
        <Metric
          label={type === 'night' ? 'Horas noturnas reduzidas' : 'Dias elegíveis somados'}
          value={rows
            .reduce((s: number, r: any) => s + (type === 'night' ? r.hours : r.eligible), 0)
            .toFixed(type === 'night' ? 2 : 0)}
          icon={type === 'night' ? <Moon size={20} /> : <CalendarDays size={20} />}
          tone="green"
          detail={
            type === 'night'
              ? 'Com base nas marcações importadas'
              : 'Considerando calendário e escala individual'
          }
        />
      </div>
      <Card>
        <div className="table-toolbar">
          <h2>
            Memória individual <span className="count-label">{rows.length}</span>
          </h2>
          <Badge tone="blue">
            Regras{' '}
            {type === 'vt'
              ? 'VT independentes'
              : type === 'va'
                ? 'VA por departamento'
                : 'noturnas configuráveis'}
          </Badge>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
                <th>Conferir</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 8, page * 8).map((r: any, i: number) => (
                <tr key={r.employee.id}>
                  <td>
                    <b>{r.employee.name}</b>
                    <small className="cell-small">
                      {data.departments.find((d) => d.id === r.employee.departmentId)?.name}
                    </small>
                  </td>
                  {type === 'night' ? (
                    <>
                      <td>{currency(r.employee.salary)}</td>
                      <td>{r.hours.toFixed(2)} h</td>
                      <td>{r.percent}%</td>
                      <td className="amount">{currency(r.total)}</td>
                    </>
                  ) : (
                    <>
                      <td>{r.baseDays}</td>
                      <td>{r.additional}</td>
                      <td>
                        <span className={r.discounts ? 'negative' : ''}>{r.discounts}</span>
                      </td>
                      <td>
                        <b>{r.eligible}</b>
                      </td>
                      <td>
                        {currency(r.daily)}
                        {type === 'vt' && (
                          <small className="cell-small">
                            {r.employee.vtTrips} × {currency(r.employee.vtFare)}
                          </small>
                        )}
                      </td>
                      <td className="amount">{currency(r.total)}</td>
                    </>
                  )}
                  <td>
                    <button
                      className="icon-btn"
                      title="Ver memória de cálculo"
                      onClick={() => setMemory(r)}
                    >
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-total">
          <span>Total geral estimado</span>
          <strong>{currency(total)}</strong>
        </div>
        <Pagination total={rows.length} page={page} onChange={setPage} />
      </Card>
      {memory && (
        <Modal
          title="Memória de cálculo"
          description={`${memory.employee.name} · ${title}`}
          wide
          onClose={() => setMemory(null)}
        >
          <div className="calculation-formula">
            <Calculator size={22} />
            <strong>{memory.memory.formula}</strong>
          </div>
          <Notice>{memory.memory.note}</Notice>
          {memory.memory.scheduledDates && (
            <div className="detail-grid">
              <div>
                <small>Dias previstos</small>
                <p>{memory.memory.scheduledDates.join(' · ') || 'Nenhum'}</p>
              </div>
              <div>
                <small>Dias descontados</small>
                <p>{memory.memory.deductedDates.join(' · ') || 'Nenhum'}</p>
              </div>
              <div>
                <small>Ocorrências que descontam</small>
                <p>{memory.memory.rule.join(', ') || 'Nenhuma'}</p>
              </div>
              <div>
                <small>Ocorrências pendentes</small>
                <p>{memory.pending} · não descontadas nesta prévia</p>
              </div>
            </div>
          )}
          {memory.memory.days && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Marcações</th>
                    <th>Minutos noturnos reais</th>
                  </tr>
                </thead>
                <tbody>
                  {memory.memory.days.map((d: any) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.times}</td>
                      <td>{d.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="modal-footer">
            <Button onClick={() => setMemory(null)}>Concluir conferência</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
