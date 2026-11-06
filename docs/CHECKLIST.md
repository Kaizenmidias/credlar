# Checklist de implementação

Marcar `[x]` somente com código e evidência de verificação. Itens com `[ ]` continuam pendentes, mesmo que uma interface antecipada exista. Este arquivo é o acompanhamento oficial da implementação do DPControl; ele não representa liberação de todas as fases em produção.

## Fase 1 — Fundação

- [x] F1-01 Substituir página estática por React/TypeScript e roteamento dos 12 módulos.
- [x] F1-02 Definir API Node, adaptador SQLite local/MySQL produção e tabelas iniciais.
- [x] F1-03 Login com scrypt, sessão HttpOnly, expiração, logout e RBAC admin/rh/consulta.
- [x] F1-04 Cadastro de usuários por administrador, ativação/inativação e revogação de sessões.
- [x] F1-05 Funcionários: todos os campos essenciais, CPF validado, matrícula única, busca, filtros, edição e detalhe.
- [x] F1-06 Departamentos: Sede/Sala de vendas, responsáveis, regras distintas e parâmetros dominicais configuráveis.
- [x] F1-07 Dashboard com dados do servidor, filtros, indicadores, pendências e distribuição.
- [x] F1-08 Empresa responsável: razão social, nome, logo, dados de contato e cabeçalho documental.
- [x] F1-09 Histórico básico de ações e controle otimista de edição de funcionários/departamentos.
- [x] F1-10 Dados fictícios locais, build, testes API e regras de prévia.
- [x] F1-11 Recuperação real por e-mail: SMTP configurável no front, senha criptografada, token hash descartável com expiração de 30 minutos, revogação de sessões e testes.
- [x] F1-12 Migrações versionadas, registro idempotente em `schema_migrations` e aplicação verificada no MySQL de produção.
- [x] F1-13a Dashboard: série temporal agrupada dinamicamente no intervalo selecionado, sem datas fixas.
- [ ] F1-13b Dashboard: faltantes/suspeitos separados e quantidade de pessoas distintas com pendências.
- [ ] F1-14 Acessibilidade/contraste/zoom 200% homologados e agregações no servidor. Paginação configurável 10/25/50/100/500 já disponível nas tabelas principais.
- [x] F1-15 Deploy seguro da API/banco MySQL e revisão do fluxo inicial sem seed fictício.

## Fase 2 — Integração e auditoria

- [x] F2-01 Tela de integração, fontes oficiais e estado sem conexão falsa.
- [x] F2-02 CSV/XLSX normalizado: prévia, modelo, confirmação, relatório por linha e importação básica.
- [x] F2-03 Auditoria indicativa: quantidade por indivíduo, ausência, duplicidade, proximidade e comparação de entrada.
- [x] F2-04 Vermelho/amarelo/verde com texto; detalhe, observação, pendente, descarte, conferido na Sólides, histórico.
- [x] F2-05 Ocorrências manuais e normalizadas com tipo, período, origem e conferência.
- [x] F2-06 Marcações originais imutáveis e nenhuma escrita na API Sólides.
- [x] F2-07 Token autorizado, Swagger vigente e payloads reais da conta analisados.
- [x] F2-08 Criptografia AES-GCM de token, chave fora do banco, endpoint só admin e segredo nunca retornado.
- [x] F2-09 Conexão verdadeira, permissões e paginação testadas com a conta do cliente.
- [x] F2-09a Campo administrativo para salvar token pelo front com criptografia AES-256-GCM; teste externo aguarda token novo.
- [x] F2-10 Importar funcionários, departamentos, unidades, cargos, escalas, pontos e ajustes/justificativas disponibilizados pela conta, preservando payload bruto.
- [ ] F2-11 Job persistente com progresso, histórico, retries 429/5xx, status e cancelamento implementados. Ainda faltam retomada por checkpoint e transação por lote.
- [x] F2-12 IDs externos, deduplicação e invalidação automática de revisões quando a origem do ponto muda.
- [ ] F2-13 Mapear exportações nativas Sólides (não confundir com modelo normalizado).
- [ ] F2-14 Escalas com horários detalhados para 2/4/6+ batidas; comparação de cada intervalo e jornada prevista/real.
- [ ] F2-15 Ocorrências: anexos fora do webroot, validação por assinatura real, limite e download autenticado implementados. Ainda faltam antivírus e política de retenção documental.

## Fase 3 — Cálculos

- [x] F3-01 Prévia VA por datas de escala, feriados, vínculo, dias extras e exclusões individuais; endpoint autenticado no servidor.
- [x] F3-02 Prévia VT independente de VA, tarifa e passagens por pessoa; endpoint autenticado no servidor.
- [x] F3-03 Descontos só de ocorrências conferidas e datas sobrepostas únicas; regra compartilhada pelo backend.
- [x] F3-04 Prévia noturna atravessando meia-noite, minutos reduzidos, percentual e memória; endpoint autenticado no servidor.
- [x] F3-05 Memória de cálculo individual e exportação identificada como prévia; telas VA/VT/noturno consumindo exclusivamente a API autenticada de prévia.
- [x] F3-05a Operações monetárias das prévias realizadas em centavos inteiros, incluindo totais individuais e gerais.
- [x] F3-05b Estrutura de regras versionadas por benefício, departamento e vigência, com bloqueio de sobreposição ativa.
- [ ] F3-06 Concluir migração dos valores contratuais de funcionário para colunas BIGINT/DECIMAL; cálculo em centavos e regras com vigência já estão no servidor.
- [ ] F3-07 Homologar cenários reais, CCT, calendários e políticas de VA/VT separadamente.
- [ ] F3-08 Gerar/verificar descanso dominical de acordo com escala, gênero quando juridicamente aplicável e revisão humana.
- [ ] F3-09 Sábados efetivamente trabalhados na Sede: comprovação pela origem, sem exigir apenas lançamento manual.
- [ ] F3-10 Mostrar descontos VA por faltas/atestados/suspensões/outros em colunas e drill-down.
- [ ] F3-11 Override manual de dias/valor com justificativa, aprovação e diff histórico.
- [ ] F3-12 Homologar hora noturna reduzida, prorrogação após pausa, jornadas longas e parâmetros setoriais.

## Fase 4 — Fechamento e documentos

- [x] F4-01 Intervalo livre por competência, departamento e funcionário opcional.
- [x] F4-02 Conferência consolidada de funcionários, ocorrências, auditoria e totais.
- [x] F4-03 11 relatórios PDF e Excel com logo e razão social configuradas.
- [x] F4-04 API bloqueia fechamento definitivo enquanto motor não homologado.
- [x] F4-05 Máquina inicial de estados `draft/finalized`, versão e bloqueio concorrente por estado; reabertura permanece no item F4-08.
- [x] F4-06 Snapshot imutável de conferência com identidade da empresa, período, funcionários, memórias, totais em centavos e pendências.
- [x] F4-07 Exibir pendências e exigir ciência explícita, justificativa e perfil administrador antes de finalizar; finalização continua condicionada à homologação por ambiente.
- [x] F4-08 Reabrir com justificativa obrigatória, criar nova versão em rascunho e preservar versão finalizada anterior.
- [ ] F4-09 Histórico de geração/acesso implementado. Ainda faltam geração oficial no servidor e vínculo obrigatório ao snapshot finalizado.
- [ ] F4-10 Homologação visual PDF multipágina e Excel no leitor utilizado pelo DHO.

## Operação e privacidade — antes de dados reais

- [x] Segredos e banco ignorados pelo Git; sem tokens de API no código.
- [x] SQL parametrizado, validação no servidor, origem/cabeçalho anti-CSRF e limite no login.
- [ ] Política de retenção, finalidade, responsável, direitos do titular e gestão de incidentes.
- [ ] Backups MySQL criptografados, privados e com retenção automática implementados. Restauração isolada ainda precisa ser ensaiada e registrada.
- [ ] Logs append-only com diffs mascarados; permissões por campo/dado médico.
- [x] Health/readiness e expurgo horário de sessões e tokens expirados.
- [ ] Monitoramento externo, alarmes e procedimento de rollback ensaiado.
- [ ] Teste de isolamento entre perfis, IDOR e limite de upload em ambiente de produção.
- [ ] Homologação final com RH/DHO e contabilidade.

## Informações a fornecer

Razão social legal e CNPJ do responsável; e-mail do administrador real; SMTP; token Sólides autorizado; contrato Swagger da conta; exemplos de exports anonimizados; escalas e slots por funcionário; datas/feriados; CCT aplicável; regras de VA e VT por ocorrência/departamento; divisor/hora noturna/prorrogação; regra de aprovação de pendências; destino e retenção de backups.
