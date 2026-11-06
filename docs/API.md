# Contratos da API

Base `/api`, mesma origem HTTPS. JSON camelCase. Header `X-DHO-Request: 1` obrigatório em mutações. Autenticação por cookie HttpOnly. Nenhum token de sessão disponível ao JavaScript. Erros `{ "message": "texto acionável" }`. 401 sem sessão, 403 sem permissão, 409 duplicidade/conflito de versão, 422 dados inválidos. As respostas atuais de bootstrap são envelope completo; paginação server-side é evolução obrigatória.

## Implementado

| Método / caminho          | Permissão        | Request / resposta                                                                |
| ------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| GET /health               | Público          | status, database, environment; sem segredo                                        |
| GET /ready                | Público          | readiness do processo e conectividade com o banco                                 |
| POST /auth/login          | Público limitado | `{email,password}` → usuário + cookie 8h                                          |
| GET /auth/me              | Autenticado      | `{id,name,email,role,demo}`                                                       |
| POST /auth/logout         | Autenticado      | revoga token atual e apaga cookie                                                 |
| POST /auth/forgot         | Público limitado | `{email}` → orientação genérica; não envia e-mail                                 |
| GET /bootstrap            | Todos os perfis  | `{company,employees,departments,records,user,demo}`                               |
| POST /employees           | admin/rh         | Employee sem id/version → criado + id/version                                     |
| PUT /employees/:id        | admin/rh         | Employee com version → nova versão ou 409                                         |
| POST /departments         | admin            | Department sem id/version                                                         |
| PUT /departments/:id      | admin            | Department + version                                                              |
| PUT /company              | admin            | Company; logo PNG/JPEG base64 até limite                                          |
| GET /users                | admin            | usuários sem hash de senha                                                        |
| POST /users               | admin            | `{name,email,role,active,password}`; senha 12+                                    |
| PUT /users/:id            | admin            | mesmos dados, senha opcional; revoga todas as sessões do alvo                     |
| GET /history              | Todos            | últimos 200 eventos básicos                                                       |
| POST /records/punches     | admin/rh         | `{employeeId,date,times,source}`; idempotência por hash                           |
| POST /records/occurrences | admin/rh         | `{employeeId,type,startDate,endDate,note,status,source,id?}`                      |
| POST /records/reviews     | admin/rh         | `{key,employeeId,date,status,note,id?}`; histórico/autor/data gerados no servidor |
| POST /records/closings    | admin/rh         | 422: definitivo ainda não disponível                                              |
| POST /integration/test    | admin            | 422: conector ainda não homologado; não recebe/grava token                        |

Employee/Department/Company estão tipados em `src/types.ts`; schemas autoritativos em `server/index.mjs`. Nunca trocar validação do servidor apenas por required no HTML. Gênero informa cadastro; dias de benefício não derivam de um número fixo por gênero.

### Exemplo de funcionário

```json
{
  "name": "Pessoa de teste",
  "registration": "CR0100",
  "cpf": "",
  "gender": "Não informado",
  "departmentId": "sede",
  "jobTitle": "Analista",
  "email": "",
  "admissionDate": "2026-11-01",
  "terminationDate": "",
  "salary": 3500,
  "weeklyHours": 44,
  "scheduleName": "5x2 administrativo",
  "weekdays": [1, 2, 3, 4, 5],
  "startTime": "08:00",
  "breakStart": "12:00",
  "breakEnd": "13:00",
  "endTime": "17:00",
  "expectedPunches": 4,
  "vaDaily": 32,
  "vtFare": 5.5,
  "vtTrips": 2,
  "nightPercent": 20,
  "status": "Ativo",
  "extraDays": [],
  "excludedDays": []
}
```

Datas civis ISO sem fuso; instantes de auditoria ISO UTC. Registros de ponto atuais são horários locais ligados à data; preservar horário absoluto/zona na migração do conector.

## Planejado — não chamar até implementar e testar

| Contrato próprio sugerido                               | Responsabilidade                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| POST /auth/reset                                        | token de uso único + senha, sem enumeração                              |
| GET /settings/smtp                                      | admin; configuração sem retornar a senha                                |
| PUT /settings/smtp                                      | admin; salva host/porta/remetente e senha criptografada                  |
| POST /settings/smtp/test                                | admin; valida conexão/autenticação SMTP                                  |
| GET /integration/jobs                                  | admin; histórico e progresso das sincronizações                          |
| POST /integration/jobs/:id/cancel                      | admin; solicita cancelamento cooperativo                                 |
| GET /documents?occurrenceId=                           | autenticado; lista metadados sem expor caminho privado                   |
| POST /documents                                         | admin/rh; PDF/PNG/JPEG, assinatura real e limite de 5 MB                 |
| GET /documents/:id/download                            | autenticado; download autorizado                                         |
| DELETE /documents/:id                                  | admin/rh; remove metadado e arquivo privado                              |
| GET /operations/backups                                | admin; inventário de backups criptografados                              |
| GET /employees?page&pageSize&search&departmentId&status | listagem paginada, total e ordenação                                    |
| GET /dashboard?start&end&departmentId                   | agregados e séries reais                                                |
| PUT /integrations/solides/credentials                   | criptografar token, aceitar apenas admin, nunca retorná-lo              |
| POST /integrations/solides/test                         | teste real com timeout/allowlist e resposta sanitizada                  |
| POST /imports                                           | recurso, período e fonte → 202 jobId                                    |
| GET /imports/:id                                        | progresso, inseridos, atualizados, ignorados, erros, cursor             |
| POST /audit/runs                                        | período + escopo → jobId / versão do motor                              |
| GET /audit/runs/:id/results                             | resultados paginados + severidades                                      |
| POST /audit/results/:id/reviews                         | status/justificativa → revisão vinculada ao hash da origem              |
| POST /occurrences/:id/documents                         | multipart, MIME real, arquivo privado                                   |
| GET /documents/:id/content                              | autorização, stream sem URL pública                                     |
| POST /calculations/preview                              | período, versão das regras e escopo → memória autoritativa              |
| POST /calculation-overrides                             | justificativa, valor/dias, aprovador                                    |
| POST /closings                                          | criar rascunho de competência com período livre                         |
| POST /closings/:id/finalize                             | expectedVersion + ciência de pendências → snapshot transacional         |
| POST /closings/:id/reopen                               | justificativa + expectedVersion → nova versão                           |
| POST /reports                                           | tipo, filtros, formato, closingVersionId opcional → arquivo privado/job |

Os caminhos desta tabela são **API interna proposta**, não endpoints da Sólides. Sua implementação deve ter teste de permissão por operação, validação, idempotência quando aplicável e documentação OpenAPI versionada.
