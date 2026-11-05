import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  PlugZap,
  ScanLine,
  ClipboardList,
  Utensils,
  Bus,
  Moon,
  CalendarCheck,
  FileBarChart2,
  Settings,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  PanelLeft,
  ShieldCheck,
  ArrowRight,
  LoaderCircle,
  BookOpen,
  CheckCircle2,
  CalendarDays,
  HelpCircle,
} from 'lucide-react';
import { api, initials } from './lib/api';
import { Dho } from './context';
import type { Data, Filters, User } from './types';
import { Button, Modal, Field, Notice } from './components/ui';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Integration from './pages/Integration';
import Audit from './pages/Audit';
import Occurrences from './pages/Occurrences';
import Benefits from './pages/Benefits';
import Closing from './pages/Closing';
import Reports from './pages/Reports';
import Configuration from './pages/Configuration';
import DesignSystem from './pages/DesignSystem';
const nav = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/funcionarios', 'Funcionários', Users],
  ['/departamentos', 'Departamentos', Building2],
  ['/integracao', 'Integração Sólides', PlugZap],
  ['/auditoria', 'Auditoria de ponto', ScanLine],
  ['/ocorrencias', 'Ocorrências', ClipboardList],
  ['/vale-alimentacao', 'Vale-alimentação', Utensils],
  ['/vale-transporte', 'Vale-transporte', Bus],
  ['/adicional-noturno', 'Adicional noturno', Moon],
  ['/fechamento', 'Fechamento mensal', CalendarCheck],
  ['/relatorios', 'Relatórios', FileBarChart2],
  ['/configuracoes', 'Configurações', Settings],
] as const;
function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [forgot, setForgot] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  return (
    <div className="login-screen">
      <section className="login-story">
        <div className="login-brand">
          DHO<span>CONTROL</span>
        </div>
        <div>
          <span className="login-eyebrow">PESSOAS NO CENTRO. GESTÃO NO CONTROLE.</span>
          <h1>
            Mais tempo para
            <br />
            cuidar de quem
            <br />
            <em>faz acontecer.</em>
          </h1>
          <p>
            Uma visão integrada de pessoas, jornadas e benefícios.
            <br />
            Da primeira marcação ao fechamento mensal.
          </p>
          <div className="login-feature">
            <ShieldCheck /> Informação organizada, decisões com confiança.
          </div>
        </div>
        <small>Uma plataforma Credlar · Gestão Humana e Organizacional</small>
        <div className="orb one" />
        <div className="orb two" />
      </section>
      <section className="login-form">
        <div className="login-card">
          <img src="/logos/credlar.png" className="login-logo" alt="Credlar Vacation" />
          <span className="eyebrow">BEM-VINDO AO DHO CONTROL</span>
          <h2>{forgot ? 'Recuperar acesso' : 'Seu trabalho começa aqui.'}</h2>
          <p>
            {forgot
              ? 'Informe seu e-mail para consultar as orientações de recuperação.'
              : 'Entre com suas credenciais para acessar o painel.'}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const f = new FormData(e.currentTarget);
              try {
                if (forgot) {
                  const r = await api('/auth/forgot', 'POST', { email: f.get('email') });
                  setMessage(r.message);
                } else
                  onLogin(
                    await api('/auth/login', 'POST', {
                      email: f.get('email'),
                      password: f.get('password'),
                    }),
                  );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="E-mail de acesso">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="voce@empresa.com.br"
              />
            </Field>
            {!forgot && (
              <Field label="Senha">
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                />
              </Field>
            )}
            {error && <Notice tone="red">{error}</Notice>}
            {message && <Notice>{message}</Notice>}
            <Button busy={busy} type="submit">
              {forgot ? 'Solicitar orientação' : 'Entrar no sistema'}
              <ArrowRight size={17} />
            </Button>
          </form>
          <button
            className="text-button"
            onClick={() => {
              setForgot(!forgot);
              setMessage('');
              setError('');
            }}
          >
            {forgot ? 'Voltar para o login' : 'Esqueci minha senha'}
          </button>
          <div className="login-trust">
            <ShieldCheck size={15} />
            Acesso restrito · Sessão protegida
          </div>
          {['127.0.0.1', 'localhost'].includes(window.location.hostname) && (
            <small className="dev-access">
              Ambiente local de validação: admin@dho.local
              <br />
              Senha: DhoLocal!2026
            </small>
          )}
        </div>
      </section>
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [collapsed, setCollapsed] = useState(false),
    [toast, setToast] = useState<{ message: string; tone: string } | null>(null),
    [help, setHelp] = useState(false),
    [notices, setNotices] = useState(false),
    [globalSearch, setGlobalSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(() => {
    const competence = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
      .format(new Date())
      .slice(0, 7);
    const [year, month] = competence.split('-').map(Number);
    const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
    return {
      competence,
      start: `${previous}-21`,
      end: `${competence}-20`,
      department: '',
      employee: '',
    };
  });
  const navigate = useNavigate(),
    location = useLocation();
  const notify = (message: string, tone = 'green') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 5000);
  };
  const reload = async () => {
    const d = await api<Data>('/bootstrap');
    setData(d);
    setUser(d.user);
  };
  useEffect(() => {
    api<User>('/auth/me')
      .then(async (u) => {
        setUser(u);
        await reload();
      })
      .catch((e) => {
        if (!/Entre para continuar/.test(e.message)) setLoadError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    setGlobalSearch('');
    setNotices(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(
      () =>
        api('/auth/me').catch(() => {
          setUser(null);
          setData(null);
        }),
      60000,
    );
    return () => clearInterval(timer);
  }, [user]);
  if (loading)
    return (
      <div className="loading-screen">
        <LoaderCircle className="spin" />
        Carregando DHO CONTROL…
      </div>
    );
  if (!user)
    return (
      <>
        {loadError && <div className="global-error">{loadError}</div>}
        <Login
          onLogin={async (u) => {
            setUser(u);
            try {
              await reload();
            } catch (e) {
              notify((e as Error).message, 'red');
            }
          }}
        />
      </>
    );
  if (!data)
    return (
      <div className="loading-screen">
        <p>Não foi possível carregar os dados.</p>
        <Button onClick={() => reload().catch((e) => notify(e.message, 'red'))}>
          Tentar novamente
        </Button>
      </div>
    );
  const activeLabel = nav.find((n) => n[0] === location.pathname)?.[1] || 'Biblioteca visual';
  const pending = data.records.filter((r) => r.kind === 'occurrences' && r.status === 'Pendente');
  const canEdit = user.role !== 'consulta';
  return (
    <Dho.Provider
      value={{ data, filters, setFilters, reload, notify, canEdit, isAdmin: user.role === 'admin' }}
    >
      <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
        <aside className="sidebar">
          <Link to="/" className="brand">
            <div className="brand-symbol">
              <span />
              <span />
              <span />
            </div>
            <div>
              DHO<span>CONTROL</span>
              <small>BY CREDLAR</small>
            </div>
          </Link>
          <div className="workspace">
            <span className="workspace-icon">
              <Building2 size={18} />
            </span>
            <div>
              <strong>{data.company.tradeName}</strong>
              <small>Gestão de pessoas</small>
            </div>
            <ChevronDown size={14} />
          </div>
          <nav aria-label="Menu principal">
            {nav.map(([path, label, Icon], i) => (
              <div key={path}>
                {(i === 0 || i === 3 || i === 6 || i === 10) && (
                  <span className="nav-section">
                    {i === 0
                      ? 'PRINCIPAL'
                      : i === 3
                        ? 'JORNADA & PONTO'
                        : i === 6
                          ? 'BENEFÍCIOS & FECHAMENTO'
                          : 'ADMINISTRAÇÃO'}
                  </span>
                )}
                <NavLink to={path} end title={label}>
                  <Icon size={19} />
                  <span>{label}</span>
                  {path === '/ocorrencias' && pending.length > 0 && <b>{pending.length}</b>}
                </NavLink>
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button onClick={() => setHelp(true)}>
              <HelpCircle size={18} />
              <span>Central de ajuda</span>
              <ArrowRight size={15} />
            </button>
            <div className="sidebar-company">
              <img src="/logos/credlar.png" alt="Credlar Vacation" />
              <small>Humanizando a gestão.</small>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <button
              className="icon-btn"
              title="Recolher menu"
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeft size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>
              <b>{activeLabel}</b>
            </span>
            <div className="global-search">
              <Search size={17} />
              <input
                aria-label="Buscar funcionário em todo o sistema"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Buscar no sistema..."
              />
              <kbd>⌕</kbd>
              {globalSearch && (
                <div className="search-results">
                  {data.employees
                    .filter((e) =>
                      (e.name + e.registration).toLowerCase().includes(globalSearch.toLowerCase()),
                    )
                    .slice(0, 5)
                    .map((e) => (
                      <button
                        key={e.id}
                        onClick={() => {
                          navigate('/funcionarios?busca=' + encodeURIComponent(e.name));
                          setGlobalSearch('');
                        }}
                      >
                        <Users size={16} />
                        {e.name}
                        <small>{e.registration}</small>
                      </button>
                    ))}
                  {!data.employees.some((e) =>
                    (e.name + e.registration).toLowerCase().includes(globalSearch.toLowerCase()),
                  ) && <p>Nenhum funcionário encontrado.</p>}
                </div>
              )}
            </div>
            <div className="top-actions">
              <span className="secure-label">
                <span />
                Ambiente {data.demo ? 'de validação' : 'interno'}
              </span>
              <button
                className="icon-btn notification-btn"
                aria-label="Notificações"
                onClick={() => setNotices(!notices)}
              >
                <Bell size={20} />
                {pending.length > 0 && <i />}
              </button>
              <div className="user-avatar">{initials(user.name)}</div>
              <div className="user-label">
                <strong>{user.name}</strong>
                <small>
                  {user.role === 'admin'
                    ? 'Administrador'
                    : user.role === 'rh'
                      ? 'DHO / RH'
                      : 'Consulta'}
                </small>
              </div>
              <button
                className="icon-btn"
                title="Sair"
                onClick={async () => {
                  await api('/auth/logout', 'POST');
                  setUser(null);
                  setData(null);
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
            {notices && (
              <div className="notifications">
                <h3>
                  Central de pendências <span>{pending.length}</span>
                </h3>
                {pending.length ? (
                  pending.map((o) => (
                    <button key={o.id} onClick={() => navigate('/ocorrencias')}>
                      <span className="notif-icon">
                        <ClipboardList size={16} />
                      </span>
                      <div>
                        <b>{o.type} a conferir</b>
                        <small>{data.employees.find((e) => e.id === o.employeeId)?.name}</small>
                      </div>
                      <ArrowRight size={16} />
                    </button>
                  ))
                ) : (
                  <p>Nenhuma ocorrência pendente.</p>
                )}
              </div>
            )}
          </header>
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/funcionarios" element={<Employees />} />
              <Route path="/departamentos" element={<Departments />} />
              <Route path="/integracao" element={<Integration />} />
              <Route path="/auditoria" element={<Audit />} />
              <Route path="/ocorrencias" element={<Occurrences />} />
              <Route path="/vale-alimentacao" element={<Benefits type="va" />} />
              <Route path="/vale-transporte" element={<Benefits type="vt" />} />
              <Route path="/adicional-noturno" element={<Benefits type="night" />} />
              <Route path="/fechamento" element={<Closing />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="/configuracoes" element={<Configuration />} />
              <Route path="/design-system" element={<DesignSystem />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>Página não encontrada</h1>
                    <Link to="/">Voltar ao dashboard</Link>
                  </div>
                }
              />
            </Routes>
          </main>
          <footer className="app-footer">
            <span>
              © 2026 DHO CONTROL <span>·</span> Uma plataforma Credlar
            </span>
            <span>
              <span className="status-dot" /> API conectada <span>·</span>
              <Link to="/design-system">Design System v1.0</Link>
            </span>
          </footer>
        </div>
      </div>
      {toast && (
        <div role="status" className={`toast ${toast.tone}`}>
          <CheckCircle2 size={19} />
          {toast.message}
        </div>
      )}
      {help && (
        <Modal title="Central de ajuda" onClose={() => setHelp(false)}>
          <div className="help-content">
            <BookOpen size={36} />
            <h3>Do cadastro ao fechamento.</h3>
            <p>
              1. Cadastre departamentos e revise suas regras.
              <br />
              2. Cadastre ou importe os funcionários.
              <br />
              3. Importe marcações e registre ocorrências.
              <br />
              4. Confira os alertas e as memórias de cálculo.
              <br />
              5. Exporte a conferência com a identidade da empresa.
            </p>
            <Notice>
              Dados fictícios no ambiente de validação. O guia técnico, o checklist e os contratos
              estão na pasta <b>docs/</b> do projeto.
            </Notice>
            <Button
              onClick={() => {
                setHelp(false);
                navigate('/design-system');
              }}
            >
              Explorar o Design System
              <ArrowRight size={16} />
            </Button>
          </div>
        </Modal>
      )}
    </Dho.Provider>
  );
}
