import { useState } from 'react';
import {
  ScanLine,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  MessageSquare,
} from 'lucide-react';
import { useDho } from '../context';
import {
  Card,
  PageTitle,
  Button,
  Notice,
  Metric,
  Badge,
  Modal,
  Field,
  Pagination,
  Empty,
} from '../components/ui';
import PeriodFilter from '../components/PeriodFilter';
import { audit } from '../domain/engine.mjs';
import { api, dateBR } from '../lib/api';
export default function Audit() {
  const { data, filters: f, canEdit, reload, notify } = useDho();
  const [result, setResult] = useState<any[] | null>(null),
    [filter, setFilter] = useState('all'),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState<any>(null),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false);
  const analyze = () => {
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(),
      );
      const emps = data.employees.filter(
        (e) =>
          (!f.department || e.departmentId === f.department) &&
          (!f.employee || e.id === f.employee),
      );
      setResult(
        audit(
          emps,
          data.records.filter((r) => r.kind === 'punches'),
          f.start,
          f.end < today ? f.end : today,
          data.company,
          data.records.filter((r) => r.kind === 'reviews'),
          data.records.filter((r) => r.kind === 'occurrences'),
        ),
      );
      setPage(1);
      notify('Análise concluída. Alertas precisam de conferência humana.');
    } catch (e) {
      notify((e as Error).message, 'red');
    }
  };
  const rows = result?.filter((r) => filter === 'all' || r.severity === filter) || [];
  const review = async (status: string) => {
    if (!note.trim()) {
      notify('Registre a observação ou justificativa da conferência.', 'red');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        id: detail.review?.id,
        key: detail.id,
        employeeId: detail.employee.id,
        date: detail.date,
        status,
        note,
        history: [
          ...(detail.review?.history || []),
          { status, note, actor: data.user.name, at: new Date().toISOString() },
        ],
      };
      const saved = await api('/records/reviews', 'POST', payload);
      payload.id = saved.id;
      await reload();
      setResult(
        (prev) =>
          prev?.map((r) => (r.id === detail.id ? { ...r, status, note, review: payload } : r)) ||
          null,
      );
      setDetail(null);
      notify('Conferência registrada no histórico.');
    } catch (e) {
      notify((e as Error).message, 'red');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="JORNADA & PONTO"
        title="Auditoria de ponto"
        description="Encontre inconsistências, organize a conferência e mantenha a decisão humana."
        actions={
          <Button onClick={analyze}>
            <ScanLine size={17} />
            Analisar pontos
          </Button>
        }
      />
      <PeriodFilter employee />
      <Notice>
        <ShieldIcon />
        <span>
          Alertas indicam possíveis inconsistências. Ajustes são feitos diretamente na Sólides. A
          análise considera somente dias até hoje.
        </span>
      </Notice>
      {result ? (
        <>
          <div className="metric-grid">
            <Metric
              label="Dias analisados"
              value={result.length}
              icon={<ScanLine size={20} />}
              detail="Conforme escalas individuais"
            />
            <Metric
              label="Pontos faltantes"
              value={result.filter((r) => r.severity === 'red').length}
              icon={<AlertTriangle size={20} />}
              tone="red"
              detail="Prioridade de conferência"
            />
            <Metric
              label="Possíveis inconsistências"
              value={result.filter((r) => r.severity === 'yellow').length}
              icon={<Clock3 size={20} />}
              tone="orange"
              detail="Marcações próximas ou fora de escala"
            />
            <Metric
              label="Sem alertas identificados"
              value={result.filter((r) => r.severity === 'green').length}
              icon={<CheckCircle2 size={20} />}
              tone="green"
              detail="Não substitui a revisão do DHO"
            />
          </div>
          <Card>
            <div className="table-toolbar">
              <h2>Resultado da análise</h2>
              <select
                aria-label="Filtrar classificação"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Todas as classificações</option>
                <option value="red">Vermelho · pontos faltantes</option>
                <option value="yellow">Amarelo · suspeitas</option>
                <option value="green">Verde · sem alertas</option>
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Funcionário / matrícula</th>
                    <th>Departamento</th>
                    <th>Data</th>
                    <th>Marcações</th>
                    <th>Problema identificado</th>
                    <th>Classificação</th>
                    <th>Conferência</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((page - 1) * 8, page * 8).map((r) => (
                    <tr
                      key={r.id}
                      className="clickable"
                      onClick={() => {
                        setDetail(r);
                        setNote(r.note);
                      }}
                    >
                      <td>
                        <b>{r.employee.name}</b>
                        <small className="cell-small">{r.employee.registration}</small>
                      </td>
                      <td>
                        {data.departments.find((d) => d.id === r.employee.departmentId)?.name}
                      </td>
                      <td>{dateBR(r.date)}</td>
                      <td>
                        <span className="punches">{r.times.join(' · ') || 'Sem marcações'}</span>
                      </td>
                      <td className="issue-cell">
                        {r.issues[0] || 'Sem inconsistências identificadas'}
                      </td>
                      <td>
                        <Badge tone={r.severity === 'yellow' ? 'orange' : r.severity}>
                          {r.severity === 'red'
                            ? 'Atenção'
                            : r.severity === 'yellow'
                              ? 'Conferir'
                              : 'Regular'}
                        </Badge>
                      </td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={rows.length} page={page} onChange={setPage} />
          </Card>
        </>
      ) : (
        <Card>
          <Empty
            title="Pronto para olhar mais de perto?"
            description="Selecione o período, o departamento e clique em Analisar pontos."
            action={
              <Button onClick={analyze}>
                <ScanLine size={17} />
                Iniciar análise
              </Button>
            }
          />
        </Card>
      )}
      {detail && (
        <Modal
          title={detail.employee.name}
          description={`${dateBR(detail.date)} · ${detail.employee.registration}`}
          onClose={() => setDetail(null)}
          wide
        >
          <div className="audit-timeline">
            {Array.from(
              { length: Math.max(detail.expected.length, detail.times.length) },
              (_, i) => (
                <div key={i}>
                  <span>{i + 1}</span>
                  <small>Previsto: {detail.expected[i] || 'A conferir'}</small>
                  <b>{detail.times[i] || 'SEM REGISTRO'}</b>
                </div>
              ),
            )}
          </div>
          <Notice tone={detail.severity === 'green' ? 'green' : 'orange'}>
            <div>
              {detail.issues.length
                ? detail.issues.map((s: string) => <p key={s}>{s}</p>)
                : 'Sem alertas identificados.'}
              <p>
                Horas registradas em pares: {(detail.workedMinutes / 60).toFixed(2)} h. Posições
                ausentes devem ser confirmadas na origem.
              </p>
            </div>
          </Notice>
          <Field label="Observação / justificativa *">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Descreva o que foi conferido na Sólides..."
            />
          </Field>
          {!!detail.review?.history?.length && (
            <div className="history-list">
              <h3>
                <History size={16} />
                Histórico da conferência
              </h3>
              {detail.review.history.map((h: any, i: number) => (
                <div key={i}>
                  <b>
                    {h.actor} · {h.status}
                  </b>
                  <p>{h.note}</p>
                  <small>{new Date(h.at).toLocaleString('pt-BR')}</small>
                </div>
              ))}
            </div>
          )}
          <div className="modal-footer">
            <a
              className="btn secondary"
              href="https://app.tangerino.com.br/"
              target="_blank"
              rel="noreferrer"
            >
              Abrir Sólides
              <ExternalLink size={15} />
            </a>
            {canEdit && (
              <>
                <Button variant="secondary" busy={busy} onClick={() => review('Pendente')}>
                  Pendente
                </Button>
                <Button variant="secondary" busy={busy} onClick={() => review('Descartado')}>
                  Descartar alerta
                </Button>
                <Button busy={busy} onClick={() => review('Conferido na Sólides')}>
                  Conferido na Sólides
                </Button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
function ShieldIcon() {
  return <CheckCircle2 size={19} />;
}
