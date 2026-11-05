import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ClipboardList, CheckCircle2, MoreHorizontal } from 'lucide-react';
import { useDho } from '../context';
import { Card, PageTitle, Button, Modal, Field, Badge, Notice, Pagination } from '../components/ui';
import PeriodFilter from '../components/PeriodFilter';
import { api, dateBR } from '../lib/api';
import { occurrenceTypes, daysBetween } from '../domain/engine.mjs';
export default function Occurrences() {
  const { data, filters: f, canEdit, reload, notify } = useDho();
  const [params] = useSearchParams();
  const [type, setType] = useState(params.get('tipo') || ''),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const rows = data.records.filter(
    (r) =>
      r.kind === 'occurrences' &&
      r.startDate <= f.end &&
      r.endDate >= f.start &&
      (!type || r.type === type) &&
      (!f.employee || r.employeeId === f.employee) &&
      (!f.department ||
        data.employees.find((e) => e.id === r.employeeId)?.departmentId === f.department),
  );
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/records/occurrences', 'POST', edit);
      await reload();
      setEdit(null);
      notify('Ocorrência salva e registrada no histórico.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="JORNADA & PONTO"
        title="Ocorrências"
        description="Cada ausência tem um contexto. Centralize, confira e acompanhe."
        actions={
          canEdit && (
            <Button
              onClick={() => {
                setError('');
                setEdit({
                  employeeId: data.employees[0]?.id || '',
                  type: 'Falta injustificada',
                  startDate: f.start,
                  endDate: f.start,
                  note: '',
                  source: 'Manual',
                  status: 'Pendente',
                });
              }}
            >
              <Plus size={17} />
              Nova ocorrência
            </Button>
          )
        }
      />
      <PeriodFilter employee />
      <Card>
        <div className="table-toolbar">
          <h2>
            Registros do período <span className="count-label">{rows.length}</span>
          </h2>
          <select
            aria-label="Tipo de ocorrência"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os tipos</option>
            {occurrenceTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Tipo</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Dias corridos</th>
                <th>Origem</th>
                <th>Conferência</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 8, page * 8).map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{data.employees.find((e) => e.id === o.employeeId)?.name}</b>
                  </td>
                  <td>{o.type}</td>
                  <td>{dateBR(o.startDate)}</td>
                  <td>{dateBR(o.endDate)}</td>
                  <td>{daysBetween(o.startDate, o.endDate).length}</td>
                  <td>{o.source}</td>
                  <td>
                    <Badge tone={o.status === 'Conferido' ? 'green' : 'orange'}>{o.status}</Badge>
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      title="Abrir ocorrência"
                      onClick={() => {
                        setError('');
                        setEdit({ ...o });
                      }}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="empty-cell" colSpan={8}>
                    Nenhuma ocorrência encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={rows.length} onChange={setPage} />
      </Card>
      {edit && (
        <Modal
          title={edit.id ? 'Conferir ocorrência' : 'Nova ocorrência'}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            <fieldset disabled={!canEdit}>
              <div className="form-grid">
                <Field label="Funcionário *" full>
                  <select
                    required
                    value={edit.employeeId}
                    onChange={(e) => setEdit({ ...edit, employeeId: e.target.value })}
                  >
                    {data.employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo">
                  <select
                    value={edit.type}
                    onChange={(e) => setEdit({ ...edit, type: e.target.value })}
                  >
                    {occurrenceTypes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Conferência">
                  <select
                    value={edit.status}
                    onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                  >
                    <option>Pendente</option>
                    <option>Conferido</option>
                  </select>
                </Field>
                <Field label="Data inicial">
                  <input
                    required
                    type="date"
                    value={edit.startDate}
                    onChange={(e) => setEdit({ ...edit, startDate: e.target.value })}
                  />
                </Field>
                <Field label="Data final">
                  <input
                    required
                    min={edit.startDate}
                    type="date"
                    value={edit.endDate}
                    onChange={(e) => setEdit({ ...edit, endDate: e.target.value })}
                  />
                </Field>
                <Field label="Observação / justificativa" full>
                  <textarea
                    value={edit.note}
                    onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                  />
                </Field>
              </div>
            </fieldset>
            <Notice>
              Documentos anexos serão habilitados na Fase 2, com armazenamento privado e controle de
              acesso. Não inclua informações médicas no campo de observação.
            </Notice>
            {error && <Notice tone="red">{error}</Notice>}
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setEdit(null)}>
                Fechar
              </Button>
              {canEdit && <Button busy={busy}>Salvar ocorrência</Button>}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
