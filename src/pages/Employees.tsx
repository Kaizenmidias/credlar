import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Upload, MoreHorizontal, UserRound, Briefcase, CalendarDays, RefreshCw } from 'lucide-react';
import { useDho } from '../context';
import {
  PageTitle,
  Card,
  Button,
  SearchInput,
  Badge,
  Pagination,
  Modal,
  Field,
  Notice,
} from '../components/ui';
import { api, initials, currency, dateBR, formatCpf } from '../lib/api';
import type { Employee } from '../types';
const blank: Omit<Employee, 'id' | 'version'> = {
  name: '',
  registration: '',
  cpf: '',
  gender: 'Não informado',
  departmentId: '',
  jobTitle: '',
  email: '',
  admissionDate: new Date().toISOString().slice(0, 10),
  terminationDate: '',
  salary: 0,
  weeklyHours: 44,
  scheduleName: '5×2 · administrativo',
  weekdays: [1, 2, 3, 4, 5],
  startTime: '08:00',
  breakStart: '12:00',
  breakEnd: '13:00',
  endTime: '17:00',
  expectedPunches: 4,
  vaDaily: 0,
  vtFare: 0,
  vtTrips: 2,
  nightPercent: 20,
  status: 'Ativo',
  extraDays: [],
  excludedDays: [],
};
const solidesDate = (value: unknown) => {
  if (!value) return '';
  const date = typeof value === 'number' || /^\d{10,13}$/.test(String(value))
    ? new Date(Number(value))
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const solidesSchedule = (row: any) => {
  const schedule = row.currentWorkSchedule || row.workSchedule || row.schedule;
  if (!schedule) return 'Não informada';
  if (typeof schedule === 'string' || typeof schedule === 'number') return String(schedule);
  return schedule.name || schedule.description || (schedule.id ? `Código ${schedule.id}` : 'Vinculada');
};
export default function Employees() {
  const { data, filters, canEdit, reload, notify } = useDho();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('busca') || ''),
    [status, setStatus] = useState(''),
    [dept, setDept] = useState(filters.department),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [tab, setTab] = useState(0),
    [view, setView] = useState<Employee | null>(null),
    [solidesOpen, setSolidesOpen] = useState(false),
    [solidesRows, setSolidesRows] = useState<any[]>([]),
    [solidesBusy, setSolidesBusy] = useState(false),
    [solidesError, setSolidesError] = useState(''),
    [solidesSummary, setSolidesSummary] = useState('');
  const rows = data.employees.filter(
    (e) =>
      (e.name + e.registration + e.cpf).toLowerCase().includes(search.toLowerCase()) &&
      (!status || e.status === status) &&
      (!dept || e.departmentId === dept),
  );
  const edit = (e?: Employee) => {
    setEditing(e ? { ...e } : { ...blank, departmentId: data.departments[0]?.id || '' });
    setTab(0);
    setError('');
  };
  const set = (k: string, v: unknown) => setEditing({ ...editing, [k]: v });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(
        '/employees' + (editing.id ? '/' + editing.id : ''),
        editing.id ? 'PUT' : 'POST',
        editing,
      );
      await reload();
      setEditing(null);
      notify('Funcionário salvo com sucesso.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const previewSolides = async () => {
    setSolidesBusy(true); setSolidesError(''); setSolidesRows([]);
    try {
      const result = await api('/integration/solides/preview', 'POST', { entity: 'employees' });
      if (!result.available) throw Error(result.message);
      setSolidesRows(result.rows || []);
      setSolidesSummary(`${result.count} funcionários encontrados. Confira a prévia e confirme para cadastrar.`);
    } catch (e) { setSolidesError((e as Error).message); }
    finally { setSolidesBusy(false); }
  };
  const importSolides = async () => {
    setSolidesBusy(true); setSolidesError(''); let imported = 0; let skipped = 0;
    try {
      for (const row of solidesRows) {
        const name = row.name || row.fullName || row.nome || row.employeeName;
        const registration = String(row.registration || row.registrationNumber || row.matricula || row.id || '').trim();
        if (!name || !registration || data.employees.some((e) => e.registration === registration)) { skipped++; continue; }
        try {
          await api('/employees', 'POST', { ...blank, name, registration, departmentId: row.departmentId || data.departments[0]?.id || '', cpf: row.cpf || '', email: row.email || '', jobTitle: row.jobTitle || row.role || row.jobRoleDTO?.name || 'Revisar cargo', admissionDate: solidesDate(row.admissionDate) || blank.admissionDate, scheduleName: solidesSchedule(row), salary: Number(row.salary || 0) });
          imported++;
        } catch { skipped++; }
      }
      await reload(); setSolidesSummary(`${imported} importados · ${skipped} ignorados por duplicidade ou dados incompletos.`); notify('Funcionários importados da Sólides.');
    } catch (e) { setSolidesError((e as Error).message); }
    finally { setSolidesBusy(false); }
  };
  return (
    <>
      <PageTitle
        eyebrow="PESSOAS & ORGANIZAÇÃO"
        title="Funcionários"
        description="Cada pessoa, sua jornada. Mantenha os dados da equipe sempre em dia."
        actions={
          <>
            <Link to="/integracao" className="btn secondary">
              <Upload size={16} />
              Importar funcionários
            </Link>
            {canEdit && <Button variant="secondary" onClick={() => { setSolidesOpen(true); setSolidesRows([]); setSolidesError(''); setSolidesSummary(''); }}><RefreshCw size={16} /> Importar da Sólides</Button>}
            {canEdit && (
              <Button onClick={() => edit()}>
                <Plus size={17} />
                Novo funcionário
              </Button>
            )}
          </>
        }
      />
      <div className="mini-stats">
        <span>
          <b>{data.employees.length}</b> pessoas cadastradas
        </span>
        <span>
          <i className="status-dot" />
          <b>{data.employees.filter((e) => e.status === 'Ativo').length}</b> em atividade
        </span>
        <span>
          <b>{data.departments.length}</b> departamentos
        </span>
      </div>
      <Card>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Buscar nome, matrícula ou CPF..."
          />
          <div>
            <select
              aria-label="Filtrar departamento"
              value={dept}
              onChange={(e) => {
                setDept(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os departamentos</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar situação"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as situações</option>
              {['Ativo', 'Férias', 'Afastado', 'Desligado'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Departamento</th>
                <th>Cargo</th>
                <th>Admissão</th>
                <th>Jornada</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 8, page * 8).map((e) => (
                <tr key={e.id}>
                  <td>
                    <button className="person row-link" onClick={() => setView(e)}>
                      <span className={'avatar color-' + (data.employees.indexOf(e) % 4)}>
                        {initials(e.name)}
                      </span>
                      <span>
                        <b>{e.name}</b>
                        <small>{e.registration}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span
                      className="department-dot"
                      style={{
                        background: data.departments.find((d) => d.id === e.departmentId)?.color,
                      }}
                    />
                    {data.departments.find((d) => d.id === e.departmentId)?.name}
                  </td>
                  <td>{e.jobTitle}</td>
                  <td>{dateBR(e.admissionDate)}</td>
                  <td>{e.weeklyHours}h / semana</td>
                  <td>
                    <Badge
                      tone={
                        e.status === 'Ativo' ? 'green' : e.status === 'Desligado' ? 'gray' : 'blue'
                      }
                    >
                      {e.status}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      title={canEdit ? 'Editar funcionário' : 'Ver funcionário'}
                      onClick={() => (canEdit ? edit(e) : setView(e))}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    Nenhum funcionário encontrado para estes filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={rows.length} onChange={setPage} />
      </Card>
      {editing && (
        <Modal
          title={editing.id ? 'Editar funcionário' : 'Novo funcionário'}
          description="Dados pessoais, jornada e benefícios em um único cadastro."
          onClose={() => setEditing(null)}
          wide
        >
          <div className="tabs">
            {['Dados pessoais', 'Contrato & jornada', 'Benefícios'].map((t, i) => (
              <button key={t} className={tab === i ? 'active' : ''} onClick={() => setTab(i)}>
                {t}
              </button>
            ))}
          </div>
          <form onSubmit={save}>
            <div className="form-grid" style={{ display: tab === 0 ? 'grid' : 'none' }}>
              <Field label="Nome completo *">
                <input value={editing.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="Matrícula *">
                <input
                  value={editing.registration}
                  onChange={(e) => set('registration', e.target.value)}
                />
              </Field>
              <Field label="CPF" hint="Validado pelos dígitos verificadores.">
                <input
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  value={formatCpf(editing.cpf)}
                  onChange={(e) => set('cpf', formatCpf(e.target.value))}
                />
              </Field>
              <Field label="Gênero">
                <select value={editing.gender} onChange={(e) => set('gender', e.target.value)}>
                  {['Não informado', 'Feminino', 'Masculino', 'Outro'].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={editing.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>
              <Field label="Situação">
                <select value={editing.status} onChange={(e) => set('status', e.target.value)}>
                  {['Ativo', 'Férias', 'Afastado', 'Desligado'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-grid" style={{ display: tab === 1 ? 'grid' : 'none' }}>
              <Field label="Departamento *">
                <select
                  value={editing.departmentId}
                  onChange={(e) => set('departmentId', e.target.value)}
                >
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cargo *">
                <input value={editing.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} />
              </Field>
              <Field label="Admissão *">
                <input
                  type="date"
                  value={editing.admissionDate}
                  onChange={(e) => set('admissionDate', e.target.value)}
                />
              </Field>
              <Field label="Desligamento">
                <input
                  type="date"
                  min={editing.admissionDate}
                  value={editing.terminationDate}
                  onChange={(e) => set('terminationDate', e.target.value)}
                />
              </Field>
              <Field label="Salário-base (R$)">
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={editing.salary}
                  onChange={(e) => set('salary', Number(e.target.value))}
                />
              </Field>
              <Field label="Jornada semanal (h)">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={editing.weeklyHours}
                  onChange={(e) => set('weeklyHours', Number(e.target.value))}
                />
              </Field>
              <Field label="Nome da escala">
                <input
                  value={editing.scheduleName}
                  onChange={(e) => set('scheduleName', e.target.value)}
                />
              </Field>
              <Field label="Marcações esperadas">
                <select
                  value={editing.expectedPunches}
                  onChange={(e) => set('expectedPunches', Number(e.target.value))}
                >
                  {[2, 4, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} marcações
                    </option>
                  ))}
                </select>
              </Field>
              {[
                ['startTime', 'Entrada'],
                ['breakStart', 'Saída para intervalo'],
                ['breakEnd', 'Retorno do intervalo'],
                ['endTime', 'Saída'],
              ].map(([k, l]) => (
                <Field key={k} label={l}>
                  <input type="time" value={editing[k]} onChange={(e) => set(k, e.target.value)} />
                </Field>
              ))}
              <Field label="Dias previstos na semana" full>
                <div className="weekday-picker">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                    <button
                      type="button"
                      key={i}
                      className={editing.weekdays.includes(i) ? 'active' : ''}
                      onClick={() =>
                        set(
                          'weekdays',
                          editing.weekdays.includes(i)
                            ? editing.weekdays.filter((n: number) => n !== i)
                            : [...editing.weekdays, i],
                        )
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Dias adicionais (AAAA-MM-DD, separados por vírgula)" full>
                <input
                  value={editing.extraDays.join(',')}
                  onChange={(e) =>
                    set(
                      'extraDays',
                      e.target.value ? e.target.value.split(',').map((s) => s.trim()) : [],
                    )
                  }
                />
              </Field>
              <Field label="Folgas específicas (AAAA-MM-DD, separadas por vírgula)" full>
                <input
                  value={editing.excludedDays.join(',')}
                  onChange={(e) =>
                    set(
                      'excludedDays',
                      e.target.value ? e.target.value.split(',').map((s) => s.trim()) : [],
                    )
                  }
                />
              </Field>
            </div>
            <div className="form-grid" style={{ display: tab === 2 ? 'grid' : 'none' }}>
              {[
                ['vaDaily', 'VA diário (R$)'],
                ['vtFare', 'Valor da passagem VT (R$)'],
                ['vtTrips', 'Passagens por dia'],
                ['nightPercent', 'Adicional noturno (%)'],
              ].map(([k, l]) => (
                <Field key={k} label={l}>
                  <input
                    type="number"
                    min="0"
                    step={k === 'vtTrips' ? '1' : '.01'}
                    value={editing[k]}
                    onChange={(e) => set(k, Number(e.target.value))}
                  />
                </Field>
              ))}
              <Notice>
                VA e VT utilizam regras independentes do departamento. Escalas e exceções
                individuais definem os dias previstos, sem quantidade fixa por gênero.
              </Notice>
            </div>
            {error && <Notice tone="red">{error}</Notice>}
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              {tab < 2 && (
                <Button type="button" variant="secondary" onClick={() => setTab(tab + 1)}>
                  Próxima etapa
                </Button>
              )}
              <Button type="submit" busy={busy}>
                Salvar funcionário
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {solidesOpen && <Modal title="Importar funcionários da Sólides" description="Consulta em modo de leitura. Nada será alterado na Sólides." wide onClose={() => !solidesBusy && setSolidesOpen(false)}>
        {!solidesRows.length && <Notice>O sistema consultará a API usando o token salvo em Integrações.</Notice>}
        {solidesError && <Notice tone="red">{solidesError}</Notice>}
        {solidesSummary && <Notice tone="green">{solidesSummary}</Notice>}
        {solidesRows.length > 0 && <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Matrícula</th><th>CPF</th><th>E-mail</th><th>Nascimento</th><th>Admissão</th><th>Jornada</th></tr></thead><tbody>{solidesRows.slice(0, 10).map((row, i) => <tr key={row.id || i}><td>{row.name || row.fullName || 'Não informado'}</td><td>{row.registration || row.registrationNumber || row.id || '—'}</td><td>{formatCpf(String(row.cpf || '')) || '—'}</td><td>{row.email || '—'}</td><td>{solidesDate(row.birthDate) ? dateBR(solidesDate(row.birthDate)) : '—'}</td><td>{solidesDate(row.admissionDate) ? dateBR(solidesDate(row.admissionDate)) : '—'}</td><td>{solidesSchedule(row)}</td></tr>)}</tbody></table><small style={{ display: 'block', padding: '10px 4px' }}>Exibindo 10 de {solidesRows.length} colaboradores ativos na prévia.</small></div>}
        <div className="modal-footer"><Button variant="secondary" disabled={solidesBusy} onClick={() => setSolidesOpen(false)}>Fechar</Button>{!solidesRows.length ? <Button busy={solidesBusy} onClick={previewSolides}>Buscar na Sólides</Button> : <Button busy={solidesBusy} onClick={importSolides}>Confirmar importação</Button>}</div>
      </Modal>}
      {view && (
        <Modal
          title={view.name}
          description={`${view.registration} · ${view.jobTitle}`}
          onClose={() => setView(null)}
        >
          <div className="detail-grid">
            {[
              ['Departamento', data.departments.find((d) => d.id === view.departmentId)?.name],
              ['CPF', formatCpf(view.cpf)],
              ['Situação', view.status],
              ['Admissão', dateBR(view.admissionDate)],
              ['Escala', view.scheduleName],
              ['Marcações', view.expectedPunches],
              ['Salário', currency(view.salary)],
              ['VA diário', currency(view.vaDaily)],
              ['VT por dia', currency(view.vtFare * view.vtTrips)],
            ].map(([k, v]) => (
              <div key={k}>
                <small>{k}</small>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <Button
              onClick={() => {
                edit(view);
                setView(null);
              }}
              disabled={!canEdit}
            >
              Editar cadastro
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
