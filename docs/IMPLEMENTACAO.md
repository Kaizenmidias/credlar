# Execução por tarefas pequenas

Este guia permite a continuidade por modelos de menor custo sem redesenhar o sistema. Ler README, ARQUITETURA, DESIGN_SYSTEM e CHECKLIST antes de editar. Não reescrever módulos concluídos nem afirmar que uma interface torna um fluxo de produção completo.

## Instrução reutilizável

> Implemente somente a tarefa ID indicada abaixo no DHO CONTROL. Preserve o Design System, a API e os testes existentes. Leia docs/ARQUITETURA.md, docs/DESIGN_SYSTEM.md, docs/API.md e docs/CHECKLIST.md. Reutilize os componentes e a camada api. Implemente validação e permissão no servidor. Use dados fictícios nos testes. Execute npm run check, acrescente testes para o comportamento novo e atualize somente os checkboxes efetivamente comprovados. Relate arquivos alterados, resultado dos testes e pendências. Não invente endpoints da Sólides e não libere cálculos/fechamento oficial sem homologação. Não faça deploy nem altere dados reais como parte desta tarefa sem autorização correspondente.

## Sequência e escopo

| Tarefa                      | Dependências          | Arquivos / responsabilidade                       | Critério de aceite                                                                                                                           |
| --------------------------- | --------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 Migrações e PostgreSQL  | Base atual            | server/db, migrations, tests, compose             | Migração SQLite→PG preserva IDs e contagens; suíte roda em PG real; rollback documentado. Fecha F1-12.                                       |
| T02 Recuperação de senha    | T01                   | server/auth, Configuration/Login, testes          | SMTP configurável, resposta uniforme, token hash expirável uso único, revogação, testes sem e-mail externo. Fecha F1-11.                     |
| T03 API paginada/dashboard  | T01                   | server/employees/dashboard + api client/pages     | Filtros no servidor, paginação/ordenação, séries dinâmicas, totais e pessoas distintas, sem bootstrap de anos de ponto. F1-13/F1-14 parcial. |
| T04 Slots de escala         | T01                   | server/schedules + Employees/Departments + engine | 2/4/6+ slots com dias/virada de noite/vigência; comparar todos os intervalos sem adivinhar marcação faltante. F2-14.                         |
| T05 Segredo e teste Sólides | Token + Swagger       | server/integrations/solides + Integration         | AES-GCM, rotação, segredo nunca enviado no GET/log, teste GET oficialmente validado, timeout/allowlist. F2-07 a 09.                          |
| T06 Job de importação       | T01,T05               | server/imports, worker, Integration               | Transação/checkpoints, paginação, retry, dedup por ID externo, histórico e erro por linha, imports somente leitura. F2-10 a 12.              |
| T07 Mapeamento de arquivos  | Samples anonimizados  | server/imports/file + Integration                 | Detectar e mapear colunas nativas; datas/matrículas; preview/erro por linha; mesmo arquivo 2x não duplica. F2-13.                            |
| T08 Documentos privados     | T01                   | server/documents + Occurrences                    | Tipo real, limite, antivírus, storage fora do webroot, download autorizado, teste 403/IDOR, retenção. F2-15.                                 |
| T09 Auditoria versionada    | T04,T06               | server/audit + Audit                              | Resultado vinculado ao hash/versões; ressincronizar invalida conferência; histórico server-side; regra indica suspeita.                      |
| T10 Regras com vigência     | T01,T04 + RH          | server/rules + Departments/Configuration          | VA/VT independentes; dias reais, feriados, ocorrências; CCT configurável; domingos revistos por calendário. F3-06/07/08.                     |
| T11 VA e VT autoritativos   | T10                   | server/calculations + Benefits                    | Centavos/NUMERIC, descontos por tipo, sábados trabalhados, memória de datas, overrides com justificativa e log. F3-09 a 11.                  |
| T12 Noturno homologado      | T04,T10 + RH/contador | server/calculations/night + Benefits              | Interseções e pausas, hora reduzida, prorrogação conforme regra aprovada; vetores reais anonimizados assinados pelo RH. F3-12.               |
| T13 Fechamento transacional | T09,T11,T12           | server/closings + Closing                         | Snapshot imutável, validação servidor, pendências exibidas, ciência explícita, idempotência, bloqueio concorrente. F4-05 a 07.               |
| T14 Reabertura e relatórios | T13                   | server/closings/reports + Closing/Reports         | Justificativa, versão anterior preservada, relatórios por versão com logo/razão social do snapshot. F4-08/09.                                |
| T15 Operação e homologação  | Todas relevantes      | ops, CI, docs, testes de aceite                   | Backup cifrado e restaurado, HTTPS, admin real, LGPD/retencão validados, ensaio de fechamento e rollback.                                    |

Cada tarefa deve caber numa revisão focada. Se exceder, dividir em migração/serviço/teste/UI, sem marcar o item amplo como concluído antes de integrar tudo.

## Regras que não podem se perder

- Não fixar 22/25/26 dias para todos. Datas elegíveis são enumeradas pela escala efetiva e pelo vínculo.
- Gênero não fixa dias de benefício. Regras de descanso exigem aplicabilidade, calendário e aprovação humana.
- Não descontar duas vezes a mesma data por ocorrências sobrepostas.
- Não misturar VA com VT; a igualdade de um caso de teste não cria regra compartilhada.
- Não corrigir marcações na Sólides pelo DHO. Importações são leitura e revisões são locais.
- Não interpretar alerta como erro confirmado; nunca decidir sanção ou desconto automaticamente por suspeita de ponto.
- Não usar relógio/dados do navegador como fonte do fechamento oficial.
- Não guardar token no front, localStorage ou banco sem criptografia.
- Não embutir senha da VPS, banco, SMTP ou API em commit, imagem ou log.
- Não atualizar uma versão finalizada. Reabrir cria uma nova versão e preserva o relatório anterior.
- Toda nova exportação deve chamar o serviço comum de identidade; snapshot documental quando for oficial.

## Definição de pronto

Funcionalidade persistida e autorizada no servidor; estado vazio/erro/loading na interface; testes do comportamento e do perfil proibido; build aprovado; documentação/checklist atualizados; limitações declaradas e demonstração reproduzível com dados fictícios. Para cálculo: memória reproduzível + cenários de fronteira. Para import: segundo lote idêntico não duplica. Para fechamento: mesma versão pode ser exportada novamente sem recalcular histórico.
