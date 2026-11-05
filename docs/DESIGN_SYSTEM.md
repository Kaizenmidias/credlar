# Design System · DHO CONTROL v1.0

Fonte executável: `src/styles.css`, componentes `src/components/ui.tsx`, galeria navegável `/design-system`. Inspiração de composição: [GXON](https://gxon.layoutdrop.com/demo/index.html). Layout e componentes próprios; nenhum código do template foi copiado.

## Princípios

1. Clareza antes de densidade. Ações descrevem o resultado: Salvar funcionário, Analisar pontos, Exportar prévia.
2. Dados, escala e competência sempre contextualizados.
3. Um botão primário por contexto. Secundário para consulta/voltar; ações destrutivas exigem justificativa e recuperação.
4. Estado nunca só por cor. Alerta é suspeita, conferência é decisão humana.
5. Marca da plataforma diferente da identidade documental da empresa.

## Tokens

| Token       | Valor   | Uso                              |
| ----------- | ------- | -------------------------------- |
| --navy      | #172b4d | Títulos e marca                  |
| --blue      | #3867ef | Navegação ativa e ação primária  |
| --blue-soft | #eef3ff | Seleção, informação, ícones      |
| --bg        | #f6f8fc | Fundo da área de trabalho        |
| --border    | #e9edf4 | Divisórias e cards               |
| --muted     | #8390a6 | Contexto secundário              |
| --green     | #249973 | Conferido / operação concluída   |
| --orange    | #d48b28 | Pendente / prévia / revisão      |
| --red       | #d75d68 | Atenção crítica / falha validada |
| --radius    | 12px    | Cards                            |
| --sidebar   | 248px   | Navegação desktop                |

Superfícies: branco. Informação #edf3ff; sucesso #ebf8f2; atenção #fff6e6; crítico #fff0f2; neutro #f0f3f8. Roxo #9066d8 é apenas categórico.

Fonte de sistema `Inter, Segoe UI, Arial, sans-serif`; sem carregamento remoto. Pesos 400/500/550/650/800. Título da página 27px, título de seção 15–17px, valor KPI 26px, texto-base 13px, tabela compacta 10–12px, rótulo auxiliar 9–11px, overline 8–10px com tracking. Evitar diminuir rótulos essenciais. Dados monetários alinhados à direita nas próximas tabelas extensas.

Escala de espaço: 4, 8, 12, 16, 20, 24, 32, 40, 48. Área principal 32px horizontal. Gap de cards 18–22px. Campos 39px; botões 37px; ícones interativos 30px (ampliar a 44px em dispositivos touch). Borda 1px, sombras leves em dropdown/modal, sem gradientes como decoração de cards.

## Layout

- Sidebar branca fixa, marca no topo, empresa responsável abaixo, módulos em quatro grupos, ajuda no rodapé.
- Topbar sticky 76px, breadcrumb, busca de funcionários, notificações, perfil, saída.
- PageTitle com overline, título, descrição e ação à direita.
- PeriodFilter compartilhado: competência, datas livres, departamento e funcionário opcional. Competência sugere o intervalo, mas não o impõe.
- Cards brancos, borda suave, radius 12. Tabelas sem excesso de linhas verticais.
- Desktop amplo: 4 KPIs, gráfico 2/3 + distribuição 1/3. Abaixo: pendências + chamada ao fechamento.
- 1250px: compactar espaçamento; 1000px: gráficos empilhados e KPIs 2 colunas; 700px: sidebar de ícones, formulários em 1 coluna, tabelas com scroll interno. Nunca ocultar colunas financeiras sem alternativa.

## Contrato dos componentes

| Componente   | Responsabilidade / estados                                                               |
| ------------ | ---------------------------------------------------------------------------------------- |
| Button       | Primário, secondary, ghost, small, disabled, busy com spinner e bloqueio de duplo clique |
| Badge        | Texto + ponto + tom semântico; nunca classificar suspeita como erro confirmado           |
| Card         | Superfície/layout; não deve ser botão sem semântica                                      |
| Field        | Label associado por wrapping, hint próximo, controle acessível                           |
| Modal        | role dialog, aria-modal, label, Escape, foco contido e restaurado                        |
| PageTitle    | Hierarquia consistente de página                                                         |
| Metric       | Rótulo, valor, ícone categórico e contexto                                               |
| SearchInput  | Pesquisa contextual nomeada por aria-label                                               |
| Pagination   | Contagem, página atual, anterior/próxima desabilitados nos limites                       |
| Notice       | Mensagem específica + ação ou consequência; green/orange/red/blue                        |
| Empty        | Contexto e ação útil, sem fabricar registros                                             |
| PeriodFilter | Estado comum à sessão atual da interface                                                 |

Novos componentes devem ser adicionados à galeria antes de reutilizados em módulos. Não criar estilos locais de botão/campo com paleta diferente. Use Lucide, stroke 1.6–2, ícones de 16–21px em controles e 24–28px em destaques; não usar emojis como ícones de navegação.

## Identidade e documentos

- `public/logos/credlar.png`: marca institucional da plataforma, tela de login e navegação.
- Logo do responsável: upload PNG/JPEG, até 1,5MB; preview antes de salvar; armazenada em banco nesta fase, storage privado na evolução.
- Merídio é cadastro inicial de exemplo. Não inferir razão social legal ou CNPJ a partir da imagem.
- PDF e Excel usam **company.legalName + company.logo**, competência, intervalo e data/hora. Exportações financeiras atuais indicam PRÉVIA. Snapshot da identidade por versão será obrigatório no fechamento definitivo.
- Nunca trocar silenciosamente a logo documental pela marca Credlar quando a empresa não estiver configurada; apresentar ausência explicitamente.

## Checklist visual para cada nova tarefa

- [ ] Mesma hierarquia e tokens, sem novos hex arbitrários.
- [ ] Desktop 1440px, compacto 1024px e mobile 390px revisados.
- [ ] Teclado, foco, labels, estado vazio, erro e carregamento.
- [ ] Perfil de consulta sem mutações; API também bloqueia.
- [ ] Tabelas com paginação/rolagem e ações nomeadas.
- [ ] Datas pt-BR para leitura, ISO para transporte; moeda BRL.
- [ ] Sem ação morta, sucesso simulado ou número fixo vendido como dado real.
- [ ] Alto contraste de texto essencial; executar auditoria WCAG antes da produção.
