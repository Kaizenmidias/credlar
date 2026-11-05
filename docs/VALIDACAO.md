# Verificação da entrega — 05/11/2026

## Automatizado

`npm run check`: suíte Node test runner + TypeScript strict + build Vite. Foram aprovados 18 testes, incluindo subtestes da API:

- Sessão obrigatória, cookie HttpOnly/SameSite, hash de senha e revogação por logout.
- Criação/atualização persistente e conflito de versão.
- CPF inválido e matrícula duplicada rejeitados.
- Importação de marcação repetida sem duplicação.
- Consulta sem permissão de escrita ou administração.
- Origem externa rejeitada e histórico sem senha.
- Bloqueio explícito de fechamento definitivo não homologado.
- VA/VT independentes, ocorrência pendente sem desconto, datas sobrepostas únicas.
- Calendário, admissão, folgas e dia adicional.
- Auditoria com quantidade individual e marcações próximas.
- Hora noturna reduzida atravessando meia-noite e exclusão de jornada incompleta.
- Rejeição de período invertido ou excessivo.

Após atualização das dependências, `npm install` registrou **0 vulnerabilidades conhecidas** no audit daquele momento. Isso não substitui revisão contínua de segurança.

## Navegador

Prévia local React + API real, banco SQLite persistente:

- Login concluído e dashboard renderizado com logos e dados fictícios.
- Formulário de funcionário navegado e cadastro `QA-LOCAL-01 / Validação RH` salvo pela interface; contagem passou de 12 para 13 no banco local de validação.
- Auditoria executada e tabela com dias regulares/alertas por quantidade e proximidade exibida.
- Exportação Excel de funcionários baixada: `Meridio-Broker-Funcionarios.xlsx`.
- Exportação PDF de funcionários baixada: `Meridio-Broker-Funcionarios.pdf`.
- Evidência visual: `docs/evidencias/dashboard.jpg`.

Os arquivos baixados contêm somente os registros fictícios de validação. Não foram enviados a terceiros.

## Não verificado / não concluído

- PostgreSQL real, Docker/compose e migração de dados.
- API Sólides da conta do cliente, autenticação, permissões, limites e payloads.
- Backup/restauração, SMTP, anexos privados e operação com dados reais.
- Homologação de legislação/CCT, escala de 6 slots e prorrogação noturna.
- Fechamento definitivo, reabertura, snapshot e exportação histórica oficial.
- Todos os 11 relatórios em multipágina e todos os leitores PDF/Excel.
- WCAG completa, zoom 200%, testes em todos os navegadores e dispositivos.

O build foi gerado para produção, mas a nova aplicação não foi implantada na VPS nesta entrega. O site estático anterior permanece no domínio até o deploy completo de API/banco. O checklist é a fonte para distinguir base implementada de liberação operacional.
