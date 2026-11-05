# Sólides DP — investigação e contrato pendente

Consulta em 05/11/2026. Referências primárias:

- [Documentação oficial Sólides DP](https://docs.tangerino.com.br/): obtenção de token, autenticação, paginação, datas e módulos.
- [Como fazer integração com Sólides DP](https://ajuda.solides.com.br/hc/pt-br/articles/25327656951309-Como-fazer-integra%C3%A7%C3%A3o-com-a-S%C3%B3lides-DP): token em Empregador → Integrações e necessidade de suporte quando indisponível.
- [API Sólides Gestão](https://gestaoapidocs.solides.com.br/): produto diferente, não usar seu contrato como substituto automático do DP/Ponto.

A documentação do DP descreve `Authorization: Basic <token>`, listagens paginadas com page/size e alguns campos de data em milissegundos. Gestão usa outro esquema; não misturar autenticações. A documentação contém exemplos legados HTTP: não habilitar transmissão de token em HTTP; confirmar host/base HTTPS atual com o fornecedor e o Swagger da conta.

## Estado entregue

Não existe conector de API externo ativo. A tela informa esse estado e remete à documentação. Verificar disponibilidade retorna bloqueio informativo, sem chamada externa. Token digitado na interface fica somente em memória temporária e é descartado ao verificar; não é salvo no servidor. Importações funcionais usam **modelo normalizado do DHO**, não afirmam interpretar qualquer export nativo da Sólides.

## Diligência antes de codificar endpoints externos

1. Obter token autorizado e escopo/empresa vinculados.
2. Obter URLs HTTPS oficiais, Swagger/OpenAPI vigente e exemplos anonimizados.
3. Confirmar método, host, path, headers, campos, paginação e fuso por recurso.
4. Validar read-only para empregados, locais/departamentos, escalas, batidas e ajustes. Mapear férias/atestados/afastamentos a motivos oficiais confirmados, não a strings presumidas.
5. Confirmar limites por plano e resposta 429. Se não documentados, registrar como não confirmados, usar concorrência conservadora e respeitar Retry-After.
6. Testar import incremental/lastUpdate quando oficialmente disponível. Guardar cursor apenas após commit do lote, permitir reprocessamento idempotente.
7. Preservar IDs externos, payload hash, job e origem. Não escrever nem ajustar o ponto no provedor.

`server/integrations/solides` deverá conter adapter, DTO normalizer, secrets service e contract tests com fixtures sanitizadas. Bloquear host arbitrário para evitar SSRF. Separar callback do worker e credenciais da API pública. Secrets em AES-GCM com key ID/nonce/tag e chave fornecida pelo ambiente/secret manager.

## Matriz a completar na homologação

| Recurso                           | Disponível via API?   | Host/path HTTPS | Permissão | Paginação | Campo incremental | Formato/fuso         | Fallback             |
| --------------------------------- | --------------------- | --------------- | --------- | --------- | ----------------- | -------------------- | -------------------- |
| Funcionários                      | Validar               | Pendente        | Leitura   | Validar   | Validar           | Validar              | CSV/XLSX normalizado |
| Departamentos/locais              | Validar               | Pendente        | Leitura   | Validar   | Validar           | Validar              | Cadastro manual      |
| Escalas                           | Validar               | Pendente        | Leitura   | Validar   | Validar           | Slots/dias a validar | Cadastro individual  |
| Marcações                         | Validar               | Pendente        | Leitura   | Validar   | Validar           | UTC/local a validar  | CSV/XLSX normalizado |
| Ajustes / motivos                 | Validar               | Pendente        | Leitura   | Validar   | Validar           | Validar              | Ocorrência manual    |
| Férias / atestados / afastamentos | Validar representação | Pendente        | Leitura   | Validar   | Validar           | Motivos oficiais     | CSV/XLSX normalizado |

Não transformar paths propostos na API interna do DHO em endpoints presumidos da Sólides. Nenhuma disponibilidade foi atestada na conta do cliente sem credencial e resposta real.
