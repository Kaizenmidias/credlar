import { useEffect, useState } from 'react';
import { BriefcaseBusiness, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Card, PageTitle, Button, Badge, Notice, Pagination, Modal, Field } from '../components/ui';
import { api } from '../lib/api';
import { useDho } from '../context';

type Role = { id: string; name: string; sourceId?: string; cbo?: string; data?: Record<string, unknown>; version: number };
const blank = { name: '', sourceId: '', cbo: '', data: {} };
export default function JobRoles() {
  const { isAdmin, notify } = useDho();
  const [rows, setRows] = useState<Role[]>([]), [page, setPage] = useState(1), [busy, setBusy] = useState(true), [error, setError] = useState(''), [editing, setEditing] = useState<any>(null);
  const load = async () => { setBusy(true); setError(''); try { setRows(await api('/job-roles')); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  useEffect(() => { load(); }, []);
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const save = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api(`/job-roles${editing.id ? `/${editing.id}` : ''}`, editing.id ? 'PUT' : 'POST', editing); setEditing(null); await load(); notify('Cargo salvo com sucesso.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const remove = async (role: Role) => { if (!window.confirm(`Remover o cargo “${role.name}”?`)) return; try { await api(`/job-roles/${role.id}`, 'DELETE'); await load(); notify('Cargo removido.'); } catch (e) { notify((e as Error).message, 'red'); } };
  return <><PageTitle eyebrow="PESSOAS & ORGANIZAÇÃO" title="Cargos" description="Cadastre e mantenha os cargos conforme a Sólides." actions={<><Button variant="secondary" busy={busy} onClick={load}><RefreshCw size={16}/> Atualizar</Button>{isAdmin && <Button onClick={() => setEditing({ ...blank })}><Plus size={16}/> Novo cargo</Button>}</>} />
    {error && <Notice tone="red">{error}</Notice>}<div className="mini-stats"><span><b>{rows.length}</b> cargos cadastrados</span><span><i className="status-dot"/> Sólides sincronizada</span></div>
    <Card><div className="table-wrap"><table><thead><tr><th>Cargo</th><th>CBO</th><th>Origem</th><th /></tr></thead><tbody>{sorted.slice((page - 1) * 12, page * 12).map((role) => <tr key={role.id}><td><span className="person"><span className="avatar color-1"><BriefcaseBusiness size={16}/></span><span><b>{role.name}</b><small>{role.sourceId ? `Código Sólides: ${role.sourceId}` : 'Cadastro manual'}</small></span></span></td><td>{role.cbo || 'Não informado'}</td><td><Badge tone={role.sourceId ? 'blue' : 'gray'}>{role.sourceId ? 'Sólides' : 'Manual'}</Badge></td><td>{isAdmin && <><button className="icon-btn" title="Editar cargo" onClick={() => setEditing({ ...role, data: role.data || {} })}><Pencil size={16}/></button><button className="icon-btn" title="Remover cargo" onClick={() => remove(role)}><Trash2 size={16}/></button></>}</td></tr>)}{!sorted.length && !busy && <tr><td colSpan={4} className="empty-cell">Nenhum cargo cadastrado.</td></tr>}</tbody></table></div><Pagination page={page} total={sorted.length} size={12} onChange={setPage}/></Card>
    {editing && <Modal title={editing.id ? 'Editar cargo' : 'Novo cargo'} description="O cargo será usado para filtrar e organizar os funcionários." onClose={() => setEditing(null)}><form onSubmit={save}><Field label="Nome do cargo"><input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}/></Field><Field label="Código CBO"><input value={editing.cbo || ''} onChange={(e) => setEditing({ ...editing, cbo: e.target.value })}/></Field><div className="modal-footer"><Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancelar</Button><Button busy={busy}>Salvar cargo</Button></div></form></Modal>}
  </>;
}
