import { useState } from 'react';
import { Plus, Building2, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import { useDho } from '../context';
import { Card, PageTitle, Button, Modal, Field, Notice, Badge } from '../components/ui';
import { api } from '../lib/api';
import { occurrenceTypes } from '../domain/engine.mjs';
export default function Departments() {
  const { data, isAdmin, reload, notify } = useDho();
  const [edit, setEdit] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const set = (k: string, v: any) => setEdit({ ...edit, [k]: v });
  return (
    <>
      <PageTitle
        eyebrow="PESSOAS & ORGANIZAÇÃO"
        title="Departamentos"
        description="Equipes diferentes. Regras que respeitam cada realidade."
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setError('');
                setEdit({
                  name: '',
                  manager: '',
                  description: '',
                  color: '#3764eb',
                  weekdays: [1, 2, 3, 4, 5],
                  vaDeductions: ['Falta injustificada', 'Suspensão'],
                  vtDeductions: ['Falta injustificada', 'Atestado', 'Férias'],
                  sundayPolicy: 'Revisão por escala e convenção coletiva',
                  womenSundayRest: 2,
                });
              }}
            >
              <Plus size={17} />
              Novo departamento
            </Button>
          )
        }
      />
      <div className="department-grid">
        {data.departments.map((d) => (
          <Card key={d.id} className="department-card">
            <div className="department-card-top">
              <div style={{ background: d.color + '15', color: d.color }}>
                <Building2 size={25} />
              </div>
              <Badge tone="green">Ativo</Badge>
            </div>
            <h2>{d.name}</h2>
            <p>{d.description}</p>
            <div className="department-info">
              <span>
                <Users size={16} />
                {data.employees.filter((e) => e.departmentId === d.id).length} funcionários
              </span>
              <span>
                Responsável: <b>{d.manager || 'Não informado'}</b>
              </span>
            </div>
            <div className="rule-chips">
              <span>{d.weekdays.length} dias na escala-base</span>
              <span>VA e VT independentes</span>
            </div>
            <button
              className="card-bottom-link"
              onClick={() => {
                setError('');
                setEdit({ ...d });
              }}
            >
              {isAdmin ? 'Configurar departamento' : 'Consultar regras'}
              <ArrowRight size={17} />
            </button>
          </Card>
        ))}
      </div>
      <Notice>
        <ShieldCheck size={19} />
        <span>
          As escalas individuais prevalecem nos dias previstos. Regras dominicais e convenções
          coletivas devem ser revisadas pelo administrador antes da homologação.
        </span>
      </Notice>
      {edit && (
        <Modal
          title={edit.id ? 'Regras do departamento' : 'Novo departamento'}
          description="Regras versionadas com histórico de alterações."
          wide
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(
                  '/departments' + (edit.id ? '/' + edit.id : ''),
                  edit.id ? 'PUT' : 'POST',
                  edit,
                );
                await reload();
                setEdit(null);
                notify('Departamento salvo.');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={!isAdmin}>
              <div className="form-grid">
                <Field label="Nome *">
                  <input required value={edit.name} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field label="Responsável">
                  <input value={edit.manager} onChange={(e) => set('manager', e.target.value)} />
                </Field>
                <Field label="Descrição" full>
                  <textarea
                    value={edit.description}
                    onChange={(e) => set('description', e.target.value)}
                  />
                </Field>
                <Field label="Cor de identificação">
                  <input
                    type="color"
                    value={edit.color}
                    onChange={(e) => set('color', e.target.value)}
                  />
                </Field>
                <Field label="Domingos de descanso para mulheres (referência configurável)">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={edit.womenSundayRest}
                    onChange={(e) => set('womenSundayRest', Number(e.target.value))}
                  />
                </Field>
                <Field label="Dias-base sugeridos" full>
                  <div className="weekday-picker">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                      <button
                        type="button"
                        key={i}
                        className={edit.weekdays.includes(i) ? 'active' : ''}
                        onClick={() =>
                          set(
                            'weekdays',
                            edit.weekdays.includes(i)
                              ? edit.weekdays.filter((n: number) => n !== i)
                              : [...edit.weekdays, i],
                          )
                        }
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Política de descanso e domingos" full>
                  <textarea
                    value={edit.sundayPolicy}
                    onChange={(e) => set('sundayPolicy', e.target.value)}
                  />
                </Field>
              </div>
              <div className="rule-columns">
                {[
                  ['vaDeductions', 'Descontos no VA'],
                  ['vtDeductions', 'Descontos no VT'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <h3>{label}</h3>
                    {occurrenceTypes.map((t) => (
                      <label className="checkbox" key={t}>
                        <input
                          type="checkbox"
                          checked={edit[key].includes(t)}
                          onChange={(e) =>
                            set(
                              key,
                              e.target.checked
                                ? [...edit[key], t]
                                : edit[key].filter((s: string) => s !== t),
                            )
                          }
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </fieldset>
            {error && <Notice tone="red">{error}</Notice>}
            <div className="modal-footer">
              <Button variant="secondary" type="button" onClick={() => setEdit(null)}>
                Fechar
              </Button>
              {isAdmin && <Button busy={busy}>Salvar regras</Button>}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
