# DPControl · Gestão de Departamento Pessoal

Aplicação própria para DHO/RH, refeita com React + TypeScript, API Node.js e banco no servidor. A empresa responsável pelos registros é configurada separadamente e identifica todos os relatórios PDF e Excel.

## Entrega atual

Os 12 módulos têm navegação e fluxos de interface. A base funcional da Fase 1 inclui login, sessão, perfis, funcionários, departamentos, empresa, calendário, regras e histórico. Importações normalizadas, conferências, cálculos e relatórios antecipam os próximos módulos em ambiente de validação. Integração externa, anexos privados, recuperação por e-mail e fechamento definitivo **não estão homologados ou concluídos**. Não usar as prévias como folha oficial.

## Iniciar localmente

Node 22.13+ e npm.

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. API: http://127.0.0.1:3001/api/health.

Somente no ambiente local de validação: `admin@dho.local` / `DhoLocal!2026`. São criados 12 funcionários fictícios, 2 departamentos e registros de outubro/novembro de 2026. O SQLite fica em `var/dho.db`, ignorado pelo Git. Não há dados pessoais reais no seed. `SEED_DEMO=false` impede dados de exemplo; nesse caso configure ADMIN_EMAIL e ADMIN_PASSWORD. Uma base existente não é sobrescrita pelo seed.

```sh
npm run check
npm run build
npm start
```

`npm start` serve o build e a API na porta 3001. Não abre a aplicação automaticamente. No desenvolvimento utilize a URL do Vite, pois a proteção de origem está configurada para ela. Ajuste APP_ORIGIN se mudar a origem.

## Produção

PostgreSQL é obrigatório em produção. Use [guia de operação](docs/OPERACAO.md), `.env.example`, `Dockerfile` e `compose.yaml`. O build não contém credenciais. Produção exige APP_ORIGIN HTTPS, DATABASE_URL e administrador inicial explícito. O contêiner não cria funcionários fictícios.

O deploy anterior continua no domínio existente; esta nova arquitetura não o substitui automaticamente. Não execute o deploy da versão estática anterior: agora existe API e banco persistente.

## Documentação para continuar a implementação

- [Arquitetura e limites por módulo](docs/ARQUITETURA.md)
- [Checklist rastreável e critérios de aceite](docs/CHECKLIST.md)
- [Design System](docs/DESIGN_SYSTEM.md) · galeria em `/design-system`
- [Contratos de API](docs/API.md)
- [Plano de tarefas para modelos econômicos](docs/IMPLEMENTACAO.md)
- [Integração Sólides e fontes oficiais](docs/SOLIDES.md)
- [Operação, ambientes e backups](docs/OPERACAO.md)
- [Registro de verificação](docs/VALIDACAO.md)

## Estrutura

```text
src/components/     Componentes reutilizáveis e filtros
src/pages/          Uma tela por domínio funcional
src/domain/         Motor puro de prévia, compartilhável com a API
src/lib/            HTTP, exportações, cálculos e formatação
server/             API, validação, sessão, persistência e seed
tests/              Testes funcionais da API e do motor
docs/               Arquitetura, design e backlog
public/logos/       Ativos da Credlar e Merídio
Referências/        Originais fornecidos pelo usuário
```
