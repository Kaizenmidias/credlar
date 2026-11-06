import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Calculator,
  CalendarDays,
  Users,
  History,
  Upload,
  Save,
  Plus,
  ShieldCheck,
  MoreHorizontal,
  Trash2,
  Mail,
} from 'lucide-react';
import { useDho } from '../context';
import { Card, PageTitle, Button, Field, Notice, Modal, Badge } from '../components/ui';
import { api } from '../lib/api';
import type { Company } from '../types';
export default function Configuration() {
  const { data, isAdmin, reload, notify } = useDho();
  const [tab, setTab] = useState('company'),
    [company, setCompany] = useState<Company>({ ...data.company }),
    [busy, setBusy] = useState(false),
    [users, setUsers] = useState<any[]>([]),
    [history, setHistory] = useState<any[]>([]),
    [edit, setEdit] = useState<any>(null),
    [holiday, setHoliday] = useState(''),
    [smtp, setSmtp] = useState<any>({ host: '', port: 465, secure: true, username: '', password: '', fromName: 'DPControl', fromEmail: '' }),
    [error, setError] = useState('');
  useEffect(() => {
    if (tab === 'users' && isAdmin)
      api('/users')
        .then(setUsers)
        .catch((e) => notify(e.message, 'red'));
    if (tab === 'history')
      api('/history')
        .then(setHistory)
        .catch((e) => notify(e.message, 'red'));
    if (tab === 'smtp' && isAdmin)
      api('/settings/smtp').then((value) => setSmtp({ ...smtp, ...value, password: '' })).catch((e) => notify(e.message, 'red'));
  }, [tab]);
  const set = (key: string, value: any) => setCompany({ ...company, [key]: value });
  const save = async () => {
    setBusy(true);
    try {
      await api('/company', 'PUT', company);
      await reload();
      notify('Configurações salvas. Os próximos relatórios usarão esta identidade.');
    } catch (e) {
      notify((e as Error).message, 'red');
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file: File) => {
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1500000) {
      notify('Selecione uma imagem PNG ou JPEG de até 1,5 MB.', 'red');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('logo', String(reader.result));
    reader.readAsDataURL(file);
  };
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRAÇÃO"
        title="Configurações"
        description="A identidade, as regras e os acessos que sustentam sua operação."
        actions={
          isAdmin &&
          ['company', 'rules', 'calendar'].includes(tab) && (
            <Button busy={busy} onClick={save}>
              <Save size={17} />
              Salvar alterações
            </Button>
          )
        }
      />
      <div className="settings-layout">
        <aside className="settings-menu">
          {[
            ['company', 'Dados da empresa', Building2],
            ['rules', 'Regras de cálculo', Calculator],
            ['calendar', 'Calendário e feriados', CalendarDays],
            ['users', 'Usuários e permissões', Users],
            ['smtp', 'E-mail e recuperação', Mail],
            ['history', 'Histórico de alterações', History],
          ].map(([k, l, Icon]: any) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              <Icon size={18} />
              {l}
            </button>
          ))}
          <Link to="/departamentos">
            <Building2 size={18} />
            Departamentos e escalas
          </Link>
          <Link to="/integracao">
            <ShieldCheck size={18} />
            Integração Sólides
          </Link>
        </aside>
        <Card className="settings-content">
          {tab === 'company' && (
            <>
              <h2>Empresa responsável pelo registro</h2>
              <p className="muted">
                Nome e logo utilizados no cabeçalho de todos os relatórios. A marca DPControl
                identifica a plataforma.
              </p>
              <fieldset disabled={!isAdmin}>
                <div className="logo-upload">
                  <div>
                    {company.logo ? (
                      <img src={company.logo} alt="Logo cadastrada" />
                    ) : (
                      <Building2 size={35} />
                    )}
                  </div>
                  <section>
                    <b>Logo da empresa</b>
                    <p>PNG ou JPEG · até 1,5 MB</p>
                    <label className="btn secondary small">
                      <Upload size={15} />
                      Alterar logo
                      <input
                        hidden
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                      />
                    </label>
                  </section>
                </div>
                <div className="form-grid">
                  <Field label="Razão social *">
                    <input
                      value={company.legalName}
                      onChange={(e) => set('legalName', e.target.value)}
                    />
                  </Field>
                  <Field label="Nome fantasia *">
                    <input
                      value={company.tradeName}
                      onChange={(e) => set('tradeName', e.target.value)}
                    />
                  </Field>
                  <Field label="CNPJ">
                    <input
                      value={company.cnpj}
                      onChange={(e) => set('cnpj', e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                  </Field>
                  <Field label="E-mail">
                    <input
                      type="email"
                      value={company.email}
                      onChange={(e) => set('email', e.target.value)}
                    />
                  </Field>
                  <Field label="Telefone">
                    <input value={company.phone} onChange={(e) => set('phone', e.target.value)} />
                  </Field>
                  <Field label="Endereço">
                    <input
                      value={company.address}
                      onChange={(e) => set('address', e.target.value)}
                    />
                  </Field>
                </div>
              </fieldset>
              <div className="report-preview">
                <span>PRÉVIA DO CABEÇALHO DO RELATÓRIO</span>
                <div>
                  {company.logo && <img src={company.logo} alt="Logo do cabeçalho" />}
                  <section>
                    <b>{company.legalName}</b>
                    <p>Relatório de conferência · {company.cnpj || 'CNPJ não informado'}</p>
                  </section>
                </div>
              </div>
            </>
          )}
          {tab === 'rules' && (
            <>
              <h2>Parâmetros de apuração</h2>
              <p className="muted">
                Os valores abaixo são configuráveis. Revise-os conforme as escalas e a convenção
                coletiva aplicável.
              </p>
              <fieldset disabled={!isAdmin}>
                <div className="form-grid">
                  {[
                    ['minPunchMinutes', 'Intervalo mínimo entre marcações (min)'],
                    ['toleranceMinutes', 'Tolerância de horário (min)'],
                    ['nightReducedMinutes', 'Minutos da hora noturna reduzida'],
                    ['monthlyDivisor', 'Divisor mensal salarial'],
                    ['defaultStartDay', 'Dia inicial sugerido do fechamento'],
                    ['defaultEndDay', 'Dia final sugerido do fechamento'],
                  ].map(([k, l]) => (
                    <Field key={k} label={l}>
                      <input
                        type="number"
                        min="1"
                        step={k === 'nightReducedMinutes' ? '.1' : '1'}
                        value={(company as any)[k]}
                        onChange={(e) => set(k, Number(e.target.value))}
                      />
                    </Field>
                  ))}
                  <Field label="Início do período noturno">
                    <input
                      type="time"
                      value={company.nightStart}
                      onChange={(e) => set('nightStart', e.target.value)}
                    />
                  </Field>
                  <Field label="Fim do período noturno">
                    <input
                      type="time"
                      value={company.nightEnd}
                      onChange={(e) => set('nightEnd', e.target.value)}
                    />
                  </Field>
                  <Field label="Prorrogação da jornada noturna" full>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={company.nightExtension}
                        onChange={(e) => set('nightExtension', e.target.checked)}
                      />
                      Ativar prévia de prorrogação (requer homologação específica)
                    </label>
                  </Field>
                </div>
              </fieldset>
              <Notice tone="orange">
                As regras de VA e VT são independentes e ficam em Departamentos. Escalas, quantidade
                de marcações e valores individuais ficam no cadastro do funcionário. O descanso
                dominical precisa de calendário individual revisado.
              </Notice>
            </>
          )}
          {tab === 'calendar' && (
            <>
              <h2>Calendário e feriados</h2>
              <p className="muted">
                Datas sem trabalho previsto. Exceções individuais podem ser lançadas em Funcionários
                → Contrato & jornada.
              </p>
              {isAdmin && (
                <div className="button-row">
                  <input
                    type="date"
                    aria-label="Data do feriado"
                    value={holiday}
                    onChange={(e) => setHoliday(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    disabled={!holiday}
                    onClick={() => {
                      set('holidays', [...new Set([...company.holidays, holiday])].sort());
                      setHoliday('');
                    }}
                  >
                    <Plus size={16} />
                    Adicionar data
                  </Button>
                </div>
              )}
              <div className="holiday-list">
                {company.holidays.map((d) => (
                  <div key={d}>
                    <CalendarDays size={19} />
                    <b>{d.split('-').reverse().join('/')}</b>
                    <span>Feriado / dia não trabalhado</span>
                    {isAdmin && (
                      <button
                        className="icon-btn"
                        title="Remover feriado"
                        onClick={() =>
                          set(
                            'holidays',
                            company.holidays.filter((x) => x !== d),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {!company.holidays.length && (
                  <Notice>
                    Nenhum feriado cadastrado. Adicione as datas nacionais, estaduais, municipais e
                    as previstas na convenção.
                  </Notice>
                )}
              </div>
            </>
          )}
          {tab === 'users' && (
            <>
              <div className="card-heading">
                <div>
                  <h2>Usuários e permissões</h2>
                  <p>Controle quem consulta, opera e administra.</p>
                </div>
                {isAdmin && (
                  <Button
                    onClick={() => {
                      setEdit({ name: '', email: '', role: 'rh', active: true, password: '' });
                      setError('');
                    }}
                  >
                    <Plus size={16} />
                    Novo usuário
                  </Button>
                )}
              </div>
              <div className="permission-cards">
                {[
                  ['admin', 'Administrador', 'Configura regras, empresa, cadastros e acessos.'],
                  ['rh', 'DHO / RH', 'Gerencia funcionários, ocorrências e conferências.'],
                  ['consulta', 'Consulta', 'Visualiza dados, cálculos e relatórios.'],
                ].map(([r, l, t]) => (
                  <div key={r}>
                    <ShieldCheck size={20} />
                    <b>{l}</b>
                    <p>{t}</p>
                  </div>
                ))}
              </div>
              {!isAdmin ? (
                <Notice>Somente administradores gerenciam usuários.</Notice>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Perfil</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <b>{u.name}</b>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            {u.role === 'admin'
                              ? 'Administrador'
                              : u.role === 'rh'
                                ? 'DHO / RH'
                                : 'Consulta'}
                          </td>
                          <td>
                            <Badge tone={u.active ? 'green' : 'gray'}>
                              {u.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>
                          <td>
                            <button
                              className="icon-btn"
                              title="Editar usuário"
                              onClick={() => {
                                setEdit({ ...u, active: !!u.active, password: '' });
                                setError('');
                              }}
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {tab === 'history' && (
            <>
              <h2>Histórico de alterações</h2>
              <p className="muted">
                Últimos 200 eventos registrados no servidor. Senhas e tokens não aparecem no
                histórico.
              </p>
              <div className="history-list">
                {history.map((h) => (
                  <div key={h.id}>
                    <span className="history-dot" />
                    <b>
                      {h.actor || 'Sistema'} <Badge tone="gray">{h.action}</Badge>
                    </b>
                    <p>
                      {h.entity} · {h.entity_id}
                    </p>
                    <small>{new Date(h.created_at).toLocaleString('pt-BR')}</small>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'smtp' && (
            <>
              <h2>E-mail e recuperação de senha</h2>
              <p className="muted">Configure a conta SMTP usada para enviar links de redefinição. A senha é criptografada e nunca volta para esta tela.</p>
              {!isAdmin ? <Notice>Somente administradores podem configurar o SMTP.</Notice> : <fieldset disabled={busy}>
                <div className="form-grid">
                  <Field label="Servidor SMTP *"><input required value={smtp.host || ''} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.exemplo.com" /></Field>
                  <Field label="Porta *"><input type="number" min="1" max="65535" value={smtp.port || 465} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} /></Field>
                  <Field label="Usuário SMTP *"><input value={smtp.username || ''} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} /></Field>
                  <Field label={smtp.passwordConfigured ? 'Nova senha SMTP (opcional)' : 'Senha SMTP *'}><input type="password" autoComplete="new-password" value={smtp.password || ''} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} /></Field>
                  <Field label="Nome do remetente *"><input value={smtp.fromName || ''} onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })} /></Field>
                  <Field label="E-mail do remetente *"><input type="email" value={smtp.fromEmail || ''} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })} /></Field>
                  <Field label="Conexão segura"><label className="checkbox"><input type="checkbox" checked={!!smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} /> Usar TLS direto (normalmente porta 465)</label></Field>
                </div>
                <div className="button-row">
                  <Button busy={busy} onClick={async () => { setBusy(true); try { const saved = await api('/settings/smtp', 'PUT', smtp); setSmtp({ ...smtp, ...saved, password: '' }); notify('Configuração SMTP salva.', 'green'); } catch (e) { notify((e as Error).message, 'red'); } finally { setBusy(false); } }}><Save size={16}/> Salvar SMTP</Button>
                  <Button variant="secondary" busy={busy} onClick={async () => { setBusy(true); try { const result = await api('/settings/smtp/test', 'POST'); notify(result.message, 'green'); } catch (e) { notify((e as Error).message, 'red'); } finally { setBusy(false); } }}><ShieldCheck size={16}/> Testar conexão</Button>
                </div>
              </fieldset>}
            </>
          )}
        </Card>
      </div>
      {edit && (
        <Modal
          title={edit.id ? 'Editar acesso' : 'Novo usuário'}
          description="Senhas protegidas por hash. Alterações de acesso revogam sessões ativas."
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const payload = { ...edit };
                if (!payload.password) delete payload.password;
                await api(
                  '/users' + (edit.id ? '/' + edit.id : ''),
                  edit.id ? 'PUT' : 'POST',
                  payload,
                );
                setUsers(await api('/users'));
                setEdit(null);
                notify('Acesso salvo com sucesso.');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Nome">
                <input
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </Field>
              <Field label="E-mail">
                <input
                  required
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
              </Field>
              <Field label="Perfil">
                <select
                  value={edit.role}
                  onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                >
                  <option value="admin">Administrador</option>
                  <option value="rh">DHO / RH</option>
                  <option value="consulta">Consulta</option>
                </select>
              </Field>
              <Field label="Situação">
                <select
                  value={edit.active ? '1' : '0'}
                  onChange={(e) => setEdit({ ...edit, active: e.target.value === '1' })}
                >
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </Field>
              <Field
                full
                label={edit.id ? 'Nova senha (opcional)' : 'Senha inicial *'}
                hint="Mínimo 12 caracteres. Comunique o acesso por canal seguro."
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required={!edit.id}
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                />
              </Field>
            </div>
            {error && <Notice tone="red">{error}</Notice>}
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setEdit(null)}>
                Cancelar
              </Button>
              <Button busy={busy}>Salvar acesso</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
