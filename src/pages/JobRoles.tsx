import { useEffect, useState } from 'react';
import { BriefcaseBusiness, RefreshCw } from 'lucide-react';
import { Card, PageTitle, Button, Badge, Notice, Pagination } from '../components/ui';
import { api } from '../lib/api';

type Role = { id: string | number; description?: string; name?: string; title?: string; cbo?: string; cboId?: string | number };
export default function JobRoles() {
  const [rows, setRows] = useState<Role[]>([]), [page, setPage] = useState(1), [busy, setBusy] = useState(true), [error, setError] = useState('');
  const load = async () => { setBusy(true); setError(''); try { const result = await api('/integration/solides/data?kind=jobRoles&page=1&size=100'); setRows((result.rows || []).map((item: any) => item.payload || item)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  useEffect(() => { load(); }, []);
  const sorted = [...rows].sort((a, b) => String(a.description || a.name || a.title || '').localeCompare(String(b.description || b.name || b.title || ''), 'pt-BR'));
  return <><PageTitle eyebrow="PESSOAS & ORGANIZAÇÃO" title="Cargos" description="Cargos e classificações profissionais conforme o cadastro da Sólides." actions={<Button variant="secondary" busy={busy} onClick={load}><RefreshCw size={16}/> Atualizar cargos</Button>} />
    {error && <Notice tone="red">{error}</Notice>}
    <div className="mini-stats"><span><b>{rows.length}</b> cargos sincronizados</span><span><i className="status-dot"/><b>Sólides</b> origem dos dados</span></div>
    <Card><div className="table-wrap"><table><thead><tr><th>Cargo</th><th>CBO</th><th>Identificação de origem</th></tr></thead><tbody>{sorted.slice((page - 1) * 12, page * 12).map((role, index) => <tr key={String(role.id || index)}><td><span className="person"><span className="avatar color-1"><BriefcaseBusiness size={16}/></span><span><b>{role.description || role.name || role.title || 'Cargo sem descrição'}</b><small>Cadastro da Sólides</small></span></span></td><td>{role.cbo || (role.cboId ? `CBO ${role.cboId}` : 'Não informado')}</td><td><Badge tone="blue">ID {role.id}</Badge></td></tr>)}{!sorted.length && !busy && <tr><td colSpan={3} className="empty-cell">Nenhum cargo sincronizado. Execute “Sincronizar todos os dados disponíveis” em Integração Sólides.</td></tr>}</tbody></table></div><Pagination page={page} total={sorted.length} size={12} onChange={setPage}/></Card></>;
}
