import { useState } from 'react';
import { Building2, RefreshCw, Plus } from 'lucide-react';
import { useDho } from '../context';
import { Card, PageTitle, Button, Badge, Modal, Field, Notice } from '../components/ui';
import { api } from '../lib/api';

const regimeLabel = (v: string) => v === 'CLT' ? 'CLT' : v === 'PJ' ? 'PJ' : v === 'AMBOS' ? 'CLT e PJ' : 'Não identificado';
const regime = (row: any) => {
  const value = String(row.contractType || row.contractTypeName || row.regime || row.type || '').toLowerCase();
  if (/pj|prestador|jurídica|juridica/.test(value)) return 'PJ';
  if (/clt|empregado/.test(value)) return 'CLT';
  return 'NAO_IDENTIFICADO';
};

export default function Units() {
  const { data, isAdmin, reload, notify } = useDho();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [editing, setEditing] = useState<any>(null);
  const importSolides = async () => {
    setBusy(true); setError('');
    try {
      const result = await api('/integration/solides/preview', 'POST', { entity: 'departments' });
      if (!result.available) throw Error(result.message);
      let imported = 0;
      for (const row of result.rows || []) {
        const name = row.name || row.description || row.departmentName || row.workplaceName || row.locationName || row.id;
        if (!name || data.units.some((u) => u.name.toLowerCase() === String(name).toLowerCase())) continue;
        await api('/units', 'POST', { name: String(name), description: row.description || 'Importada da Sólides', contractType: regime(row), source: 'Sólides' });
        imported++;
      }
      await reload(); notify(`${imported} unidade(s) importada(s) da Sólides.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <>
    <PageTitle eyebrow="PESSOAS & ORGANIZAÇÃO" title="Unidades" description="Locais e unidades organizacionais importados da Sólides, com separação de regime." actions={<><Button variant="secondary" busy={busy} onClick={importSolides}><RefreshCw size={16}/> Importar da Sólides</Button>{isAdmin && <Button onClick={() => setEditing({ name:'', description:'', contractType:'NAO_IDENTIFICADO', source:'Manual' })}><Plus size={16}/> Nova unidade</Button>}</>} />
    {error && <Notice tone="red">{error}</Notice>}
    <div className="department-grid">{data.units.map((unit) => <Card className="department-card" key={unit.id}><div className="department-card-top"><div><Building2 size={24}/></div><Badge tone="green">{regimeLabel(unit.contractType)}</Badge></div><h2>{unit.name}</h2><p>{unit.description || 'Sem descrição'}</p><div className="department-info"><span>Origem: <b>{unit.source}</b></span></div>{isAdmin && <button className="card-bottom-link" onClick={() => setEditing({...unit})}>Configurar unidade</button>}</Card>)}</div>
    {!data.units.length && <Card><p>Nenhuma unidade cadastrada. Use “Importar da Sólides” para buscar os locais disponíveis.</p></Card>}
    {editing && <Modal title={editing.id ? 'Editar unidade' : 'Nova unidade'} description="Identifique o regime sem misturar CLT e PJ."><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await api('/units' + (editing.id ? '/' + editing.id : ''), editing.id ? 'PUT' : 'POST', editing); await reload(); setEditing(null); notify('Unidade salva.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><Field label="Nome"><input required value={editing.name} onChange={e => setEditing({...editing,name:e.target.value})}/></Field><Field label="Descrição"><input value={editing.description} onChange={e => setEditing({...editing,description:e.target.value})}/></Field><Field label="Regime"><select value={editing.contractType} onChange={e => setEditing({...editing,contractType:e.target.value})}><option value="NAO_IDENTIFICADO">Não identificado</option><option value="CLT">CLT</option><option value="PJ">PJ</option><option value="AMBOS">CLT e PJ</option></select></Field><div className="modal-footer"><Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancelar</Button><Button busy={busy}>Salvar unidade</Button></div></form></Modal>}
  </>;
}
