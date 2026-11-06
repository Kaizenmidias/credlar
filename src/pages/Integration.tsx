import { useState } from 'react';
import {
  PlugZap,
  ExternalLink,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  Download,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useDho } from '../context';
import { Card, PageTitle, Button, Badge, Notice, Field, Modal } from '../components/ui';
import { api } from '../lib/api';
const templates = {
  punches: 'registration;date;times\nCR0001;2026-11-03;08:00,12:00,13:00,17:00',
  occurrences:
    'registration;type;startDate;endDate;note\nCR0001;Atestado;2026-11-03;2026-11-03;Conferir na origem',
  employees:
    'name;registration;departmentId;jobTitle;admissionDate;salary\nPessoa de exemplo;CR1000;sede;Analista;2026-11-01;3500',
};
const datasetCatalog = [
  ['employees','Funcionários'],['account','Conta e empresa'],['companies','Empresas e filiais'],['costCenters','Centros de custo'],['workplaces','Unidades e locais'],['jobRoles','Cargos'],['employeeFunctions','Funções'],['managers','Gestores'],['workSchedules','Jornadas e escalas'],['punchRules','Regras de ponto'],['holidays','Calendários e feriados'],['adjustmentReasons','Motivos de ajuste'],['adjustments','Ajustes e justificativas'],
] as const;
const fieldNames: Record<string,string> = { id:'Identificador', name:'Nome', description:'Descrição', code:'Código', email:'E-mail', cpf:'CPF', active:'Ativo', status:'Situação', registration:'Matrícula', admissionDate:'Data de admissão', birthDate:'Data de nascimento', externalCode:'Código externo', employerCode:'Código da empresa' };
const readableLabel = (key: string) => fieldNames[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const readableValue = (value: any) => value == null || value === '' ? 'Não informado' : typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : typeof value === 'object' ? JSON.stringify(value) : String(value);
export default function Integration() {
  const { data, isAdmin, canEdit, reload, notify } = useDho();
  const [kind, setKind] = useState<keyof typeof templates>('punches'),
    [importing, setImporting] = useState(false),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [summary, setSummary] = useState(''),
    [token, setToken] = useState(''),
    [savingToken, setSavingToken] = useState(false),
    [apiEntity, setApiEntity] = useState('employees'),
    [apiRows, setApiRows] = useState<any[]>([]),
    [apiBusy, setApiBusy] = useState(false),
    [apiImporting, setApiImporting] = useState(false),
    [syncingAll, setSyncingAll] = useState(false),
    [syncResult, setSyncResult] = useState<any>(null),
    [dataView, setDataView] = useState<any>(null),
    [dataViewBusy, setDataViewBusy] = useState(false);
  const previewApi = async () => {
    setApiBusy(true); setApiRows([]); setError('');
    try {
      const result = await api('/integration/solides/preview', 'POST', { entity: apiEntity });
      if (!result.available) throw Error(result.message);
      setApiRows(result.rows || []);
      setSummary(`${result.count} registros encontrados na operação ${result.operation.path}. Confira a prévia antes de importar.`);
    } catch (e) { setError((e as Error).message); }
    finally { setApiBusy(false); }
  };
  const confirmApiImport = async () => {
    if (apiEntity !== 'employees') { notify('A prévia foi concluída. O mapeamento deste tipo será habilitado após a homologação do contrato.', 'orange'); return; }
    setApiImporting(true); let imported = 0; let skipped = 0;
    try {
      for (const row of apiRows) {
        const name = row.name || row.fullName || row.nome || row.employeeName;
        const registration = String(row.registration || row.registrationNumber || row.matricula || row.id || '').trim();
        if (!name || !registration || data.employees.some((e) => e.registration === registration)) { skipped++; continue; }
        await api('/employees', 'POST', { name, registration, cpf: row.cpf || '', gender: row.gender || 'Não informado', departmentId: row.departmentId || '', jobTitle: row.jobTitle || row.role || 'Revisar cargo', admissionDate: String(row.admissionDate || '').slice(0, 10), terminationDate: '', salary: Number(row.salary || 0), email: row.email || '', weeklyHours: 44, scheduleName: 'Revisar escala importada', weekdays: [1,2,3,4,5], startTime: '08:00', breakStart: '12:00', breakEnd: '13:00', endTime: '17:00', expectedPunches: 4, vaDaily: 0, vtFare: 0, vtTrips: 2, nightPercent: 20, status: 'Ativo', extraDays: [], excludedDays: [] });
        imported++;
      }
      await reload(); setSummary(`${imported} funcionários importados · ${skipped} ignorados por duplicidade ou dados incompletos.`); notify('Importação da Sólides concluída.', 'green');
    } catch (e) { setError((e as Error).message); }
    finally { setApiImporting(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + templates[kind]], { type: 'text/csv;charset=utf-8;' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `modelo-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const read = async (file: File) => {
    setError('');
    setRows([]);
    if (file.size > 2 * 1024 * 1024) {
      setError('Arquivo limitado a 2 MB.');
      return;
    }
    try {
      let lines: (string | number)[][];
      if (file.name.endsWith('.xlsx')) {
        const { default: ExcelJS } = await import('exceljs');
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        lines = [];
        wb.worksheets[0].eachRow((row) =>
          lines.push(
            (row.values as any[])
              .slice(1)
              .map((v) => (typeof v === 'object' ? v?.text || '' : (v ?? ''))),
          ),
        );
      } else {
        lines = (await file.text())
          .replace(/^\uFEFF/, '')
          .trim()
          .split(/\r?\n/)
          .map((l) => l.split(';'));
      }
      const headers = lines.shift()!.map(String);
      if (!headers.includes('registration'))
        throw Error('Cabeçalho registration obrigatório. Utilize o modelo normalizado.');
      setRows(
        lines
          .filter((l) => l.some(Boolean))
          .map((l) => Object.fromEntries(headers.map((h, i) => [h, String(l[i] ?? '')]))),
      );
      if (lines.length > 500) throw Error('Importe até 500 linhas por lote.');
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  };
  const commit = async () => {
    setBusy(true);
    let imported = 0,
      skipped = 0;
    const errors: string[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      try {
        const emp = data.employees.find((e) => e.registration === row.registration);
        if (kind === 'employees') {
          if (emp) {
            skipped++;
            continue;
          }
          const draft = {
            name: row.name,
            registration: row.registration,
            cpf: '',
            gender: 'Não informado',
            departmentId: row.departmentId,
            jobTitle: row.jobTitle,
            admissionDate: row.admissionDate,
            terminationDate: '',
            salary: Number(row.salary),
            email: '',
            weeklyHours: 44,
            scheduleName: 'Revisar escala importada',
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
          await api('/employees', 'POST', draft);
        } else {
          if (!emp) throw Error('Matrícula não encontrada');
          const body =
            kind === 'punches'
              ? {
                  employeeId: emp.id,
                  date: row.date,
                  times: row.times.split(',').map((t: string) => t.trim()),
                  source: 'Arquivo normalizado',
                }
              : {
                  employeeId: emp.id,
                  type: row.type,
                  startDate: row.startDate,
                  endDate: row.endDate,
                  note: row.note || '',
                  source: 'Arquivo normalizado',
                  status: 'Pendente',
                };
          if (
            kind === 'occurrences' &&
            data.records.some(
              (r) =>
                r.kind === 'occurrences' &&
                r.employeeId === emp.id &&
                r.type === row.type &&
                r.startDate === row.startDate &&
                r.endDate === row.endDate,
            )
          ) {
            skipped++;
            continue;
          }
          const result = await api(`/records/${kind}`, 'POST', body);
          if (result.duplicate) {
            skipped++;
            continue;
          }
        }
        imported++;
      } catch (e) {
        errors.push(`Linha ${index + 2}: ${(e as Error).message}`);
      }
    }
    await reload();
    setSummary(
      `${imported} importados · ${skipped} duplicados ignorados · ${errors.length} com erro.`,
    );
    setError(errors.join('\n'));
    setRows([]);
    setBusy(false);
    notify('Importação processada. Confira o resultado.');
  };
  return (
    <>
      <PageTitle
        eyebrow="JORNADA & PONTO"
        title="Integração Sólides"
        description="Conecte as informações da jornada, com rastreabilidade desde a origem."
      />
      <div className="integration-hero card">
        <div className="solides-logo">
          s<span>ó</span>lides<small> + DPControl</small>
        </div>
        <div>
          <Badge tone="orange">Aguardando homologação</Badge>
          <h2>Uma origem. Uma visão organizada.</h2>
          <p>Importação em modo de leitura. As marcações originais permanecem na Sólides.</p>
        </div>
        <a
          href="https://docs.tangerino.com.br/"
          target="_blank"
          rel="noreferrer"
          className="btn secondary"
        >
          Documentação oficial
          <ExternalLink size={15} />
        </a>
      </div>
      <div className="two-columns">
        <Card className="padded">
          <div className="section-icon blue">
            <PlugZap size={24} />
          </div>
          <h2>Conexão via API</h2>
          <p className="muted">
            A API oficial do Sólides DP usa token no cabeçalho Authorization. O contrato da conta
            precisa ser validado antes da ativação.
          </p>
          <Field
            label="Token de integração"
            hint="O token será criptografado no servidor. Ele nunca será devolvido para a tela."
          >
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={!isAdmin}
              placeholder="Informe somente após habilitação na Sólides"
            />
          </Field>
          <div className="button-row">
            <Button
              disabled={!isAdmin || !token.trim()}
              busy={savingToken}
              onClick={async () => {
                setSavingToken(true);
                try {
                  await api('/integration/credentials', 'PUT', { token: token.trim(), baseUrl: 'https://employer.tangerino.com.br' });
                  setToken('');
                  notify('Token salvo com segurança no servidor.', 'green');
                } catch (e) { notify((e as Error).message, 'red'); }
                finally { setSavingToken(false); }
              }}
            >Salvar token</Button>
            <Button
              variant="secondary"
              disabled={!isAdmin}
              onClick={async () => {
                try {
                  const result = await api('/integration/test', 'POST');
                  notify(result.ok
                    ? `Sólides conectada${result.activeEmployeeCount == null ? '' : ` · ${result.activeEmployeeCount} colaboradores ativos`}.`
                    : result.message || 'A Sólides não aceitou a conexão.', result.ok ? 'green' : 'orange');
                } catch (e) {
                  notify((e as Error).message, 'orange');
                }
                setToken('');
              }}
            >
              <RefreshCw size={16} />
              Verificar disponibilidade
            </Button>
          </div>
          <Notice>
            O token fica criptografado no servidor. A sincronização é somente de leitura e não altera nenhum registro na Sólides.
          </Notice>
          <div className="button-row" style={{ marginTop: 16 }}>
            <Button disabled={!isAdmin} busy={syncingAll} onClick={async () => {
              setSyncingAll(true); setError(''); setSyncResult(null);
              try {
                const result = await api('/integration/solides/sync-all', 'POST');
                setSyncResult(result); await reload();
                notify(`Sincronização concluída: ${result.employeesCreated} novos e ${result.employeesUpdated} atualizados.`, 'green');
              } catch (e) { setError((e as Error).message); notify((e as Error).message, 'red'); }
              finally { setSyncingAll(false); }
            }}><RefreshCw size={16}/> Sincronizar todos os dados disponíveis</Button>
          </div>
          {syncResult && <div style={{ marginTop: 16 }}><Notice tone="green">{syncResult.stored} registros preservados integralmente · {syncResult.employeesCreated} funcionários criados · {syncResult.employeesUpdated} atualizados.</Notice><div className="capability-grid" style={{ marginTop: 12 }}>{syncResult.datasets.map((item: any) => <div key={item.key}><ShieldCheck size={18}/><b>{item.label}</b><Badge tone={item.status === 'ok' ? 'green' : 'orange'}>{item.status === 'ok' ? `${item.count} registros` : `Sem permissão${item.statusCode ? ` · HTTP ${item.statusCode}` : ''}`}</Badge></div>)}</div></div>}
          <div className="button-row" style={{ marginTop: 16 }}>
            <select value={apiEntity} onChange={(e) => setApiEntity(e.target.value)} disabled={!isAdmin || apiBusy}>
              <option value="employees">Funcionários</option><option value="departments">Departamentos</option><option value="schedules">Escalas</option><option value="punches">Marcações</option><option value="adjustments">Ajustes</option><option value="occurrences">Ocorrências, férias e afastamentos</option>
            </select>
            <Button variant="secondary" disabled={!isAdmin} busy={apiBusy} onClick={previewApi}><RefreshCw size={16} /> Importar da Sólides</Button>
          </div>
          {summary && apiRows.length > 0 && <Notice tone="green">{summary}</Notice>}
          {apiRows.length > 0 && <div className="table-wrap" style={{ marginTop: 14 }}><table><thead><tr>{Object.keys(apiRows[0]).slice(0, 7).map((k) => <th key={k}>{k}</th>)}</tr></thead><tbody>{apiRows.slice(0, 5).map((row, i) => <tr key={i}>{Object.values(row).slice(0, 7).map((v: any, j) => <td key={j}>{String(v ?? '')}</td>)}</tr>)}</tbody></table><Button busy={apiImporting} onClick={confirmApiImport} disabled={!canEdit}>Confirmar importação de {apiRows.length} registros</Button></div>}
        </Card>
        <Card className="padded">
          <div className="section-icon purple">
            <FileSpreadsheet size={24} />
          </div>
          <h2>Importação por arquivo</h2>
          <p className="muted">
            Use CSV ou Excel no modelo normalizado. Visualize os dados antes de confirmar o lote.
          </p>
          <div className="import-entities">
            {['Funcionários', 'Marcações', 'Ocorrências'].map((x, i) => (
              <span key={x}>
                <CheckCircle2 size={16} />
                {x}
              </span>
            ))}
          </div>
          <p className="muted">
            Departamentos e escalas podem ser cadastrados manualmente. Mapeamento de exports nativos
            da Sólides previsto para a Fase 2.
          </p>
          <Button
            disabled={!canEdit}
            onClick={() => {
              setImporting(true);
              setSummary('');
              setError('');
            }}
          >
            <Upload size={16} />
            Importar arquivo
            <ArrowRight size={16} />
          </Button>
        </Card>
      </div>
      <Card className="padded">
        <h2>Dados incluídos na sincronização completa</h2>
        <div className="capability-grid">
          {[
            'Funcionários',
            'Empresas e filiais',
            'Departamentos, unidades e locais',
            'Cargos, funções e gestores',
            'Centros de custo',
            'Jornadas e escalas',
            'Regras de ponto',
            'Ajustes e justificativas',
            'Calendários e feriados',
            'Dados da conta responsável',
          ].map((t) => (
            <div key={t}>
              <ShieldCheck size={20} />
              <b>{t}</b>
              <Badge tone="green">Sincronização ativa</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="padded">
        <h2>Dados trazidos da Sólides</h2>
        <p className="muted">Consulte cada conjunto já armazenado. Os nomes técnicos são apresentados em linguagem de negócio e a resposta original continua preservada no servidor.</p>
        <div className="capability-grid">{datasetCatalog.map(([key,label]) => <button type="button" className="card-bottom-link" key={key} onClick={async () => { setDataViewBusy(true); try { setDataView(await api(`/integration/solides/data?kind=${key}&page=1&size=20`)); } catch (e) { notify((e as Error).message,'red'); } finally { setDataViewBusy(false); } }}>{label}<ArrowRight size={15}/></button>)}</div>
      </Card>
      {dataView && <Modal wide title={datasetCatalog.find(([key]) => key === dataView.kind)?.[1] || 'Dados da Sólides'} description={`${dataView.total} registros sincronizados · página ${dataView.page} de ${Math.max(1,dataView.pages)}`} onClose={() => setDataView(null)}><div className="table-wrap"><table><tbody>{dataView.rows.map((record: any, index: number) => <tr key={record.externalId || index}><td><b>{record.externalId || index + 1}</b></td><td><div className="detail-grid">{Object.entries(record.payload || {}).map(([key,value]) => <div key={key}><small>{readableLabel(key)}</small><strong>{readableValue(value)}</strong></div>)}</div></td></tr>)}</tbody></table></div><div className="modal-footer"><Button variant="secondary" disabled={dataView.page <= 1 || dataViewBusy} onClick={async () => setDataView(await api(`/integration/solides/data?kind=${dataView.kind}&page=${dataView.page-1}&size=20`))}>Anterior</Button><Button variant="secondary" disabled={dataView.page >= dataView.pages || dataViewBusy} onClick={async () => setDataView(await api(`/integration/solides/data?kind=${dataView.kind}&page=${dataView.page+1}&size=20`))}>Próxima</Button><Button onClick={() => setDataView(null)}>Fechar</Button></div></Modal>}
      {importing && (
        <Modal
          title="Importar dados"
          description="Arquivos normalizados · CSV separado por ; ou Excel .xlsx"
          wide
          onClose={() => {
            if (!busy) setImporting(false);
          }}
        >
          <Field label="Tipo de dados">
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as any);
                setRows([]);
                setError('');
              }}
            >
              <option value="punches">Marcações de ponto</option>
              <option value="occurrences">Ocorrências</option>
              <option value="employees">Funcionários</option>
            </select>
          </Field>
          <div className="upload-area">
            <Upload size={25} />
            <b>Selecione um arquivo para validar</b>
            <small>Até 2 MB · 500 registros por lote</small>
            <input
              type="file"
              accept=".csv,.xlsx"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
            />
          </div>
          <Button variant="secondary" onClick={download}>
            <Download size={15} />
            Baixar modelo CSV
          </Button>
          {kind === 'employees' && (
            <Notice>
              O modelo importa dados básicos. Escala, benefícios e gênero devem ser revisados
              individualmente após a importação.
            </Notice>
          )}
          {!!rows.length && (
            <>
              <h3>Prévia · {rows.length} registros</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {Object.keys(rows[0]).map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        {Object.values(r).map((v: any, j) => (
                          <td key={j}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {summary && <Notice tone="green">{summary}</Notice>}
          {error && (
            <Notice tone="red">
              <span style={{ whiteSpace: 'pre-wrap' }}>{error}</span>
            </Notice>
          )}
          <div className="modal-footer">
            <Button variant="secondary" disabled={busy} onClick={() => setImporting(false)}>
              Fechar
            </Button>
            <Button busy={busy} disabled={!rows.length} onClick={commit}>
              Confirmar importação
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
