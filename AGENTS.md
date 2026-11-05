# DHO CONTROL — regras para continuidade

Leia `docs/ARQUITETURA.md`, `docs/DESIGN_SYSTEM.md`, `docs/API.md`, `docs/CHECKLIST.md` e a tarefa correspondente em `docs/IMPLEMENTACAO.md` antes de implementar.

- Preserve a identidade visual e reutilize `src/components/ui.tsx` e tokens em `src/styles.css`.
- Trabalhe por tarefa pequena e marque somente itens comprovados no checklist.
- Não recrie a aplicação estática antiga. React/TypeScript + API Node + PostgreSQL produção são as decisões vigentes.
- Validação e autorização sempre no servidor. Nunca guardar autenticação no localStorage.
- Sólides é somente leitura. Nenhum endpoint externo pode ser presumido; validar documentação e contrato real.
- VA e VT têm regras independentes. Nunca fixar dias por gênero. Escalas e ocorrências precisam de vigência e calendário.
- Prévia financeira não equivale a fechamento oficial. Motor oficial deve calcular no servidor com aritmética decimal e snapshot.
- Todo relatório usa logo e razão social da empresa responsável, não a marca da plataforma.
- Não escrever segredos, dumps ou dados reais em código, fixtures, documentos ou Git.
- Preserve alterações do usuário e os originais em `Referências/`.
- Execute `npm run check` e reporte evidências e limitações reais. A suíte atual usa SQLite isolado; não declarar PostgreSQL homologado sem executar nele.
- As tarefas e permissões dadas pelo usuário prevalecem. Não fazer deploy automaticamente apenas por terminar uma tarefa do backlog.
