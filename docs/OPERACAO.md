# Ambientes e operação

## Desenvolvimento

Node 22.13+, npm ci, npm run dev. Vite na porta 5173 faz proxy de /api para 3001. SQLite persistente em var/dho.db, seed fictício automático somente fora de produção. Pode substituir por PostgreSQL local via DATABASE_URL. Servidores vinculados a 127.0.0.1 por padrão. `.env.example` documenta as variáveis; use um `.env` local fora do Git.

## Produção proposta na VPS

Não sobrescrever outros serviços da VPS. A nova versão não é um simples arquivo estático; requer Node/API e PostgreSQL. Preparar backup do site anterior e plano de rollback antes da troca.

1. Usar release/checkouts dedicados, Node 22 LTS compatível com as dependências e PostgreSQL 16+.
2. Configurar segredos fora do checkout: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD inicial de 12+ caracteres, NODE_ENV=production, APP_ORIGIN=https://credlar.kaizenmidias.com, PORT=3001, HOST=127.0.0.1, SEED_DEMO=false.
3. Criar banco e usuário dedicado sem privilégios de superusuário. Migrations separadas do usuário runtime na evolução.
4. `npm ci`, `npm run check`, `npm run build`; iniciar npm start por systemd/container com usuário não-root.
5. Reverse proxy Nginx do virtual host existente para 127.0.0.1:3001. TLS válido e certificado preservado; não alterar outros virtual hosts. Configurar client_max_body_size 4m, timeouts e Cache-Control do build (não cachear /api).
6. Healthcheck GET /api/health; smoke login sem expor senha em argumentos/logs. Confirmar cookies Secure e que /api/bootstrap sem sessão retorna 401.
7. Só habilitar dados reais após itens operacionais do checklist. Seed fictício nunca em produção.

O compose fornecido é base de infraestrutura. Defina as variáveis exigidas antes de executar; PostgreSQL não tem porta pública. O app expõe somente localhost:3001 para o proxy HTTPS. Não há pipeline de deploy automático nesta entrega.

## Backup

Rotina alvo: pg_dump custom diário, cifrado e enviado a destino externo autorizado, retenção diária/semanal/mensal acordada. Anexos e chave de criptografia precisam de estratégia independente. O banco sozinho não recupera segredos cifrados sem sua chave.

Validação obrigatória: restaurar dump em banco isolado, executar contagens e integridade de FKs, abrir um fechamento histórico e comparar o hash do snapshot. Registrar data, operador e resultado. Nunca declarar backup confiável só porque o comando de dump saiu com código zero. Nenhuma rotina externa foi instalada nesta entrega.

SQLite de desenvolvimento: parar API e copiar var/dho.db (ou usar SQLite backup API). Não copiar só o arquivo principal enquanto há WAL aberto. Não enviar dados reais ou dump ao Git.

## Rollback e disponibilidade

Builds versionados; link release/current ou imagem por commit; migrações compatíveis N/N-1. Validar health antes de trocar proxy. Preservar dump anterior a migração. Reverter código não reverte automaticamente banco; documentar downgrade/forward-fix por migração.

Segredos que já foram compartilhados em mensagens não devem ser reutilizados como senha de aplicação nem gravados na documentação.
