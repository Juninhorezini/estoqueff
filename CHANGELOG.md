# Changelog

## 2.0.1 - 2026-07-20

### Escopo
- Modulo afetado: `src/App.js`
- Modulo afetado: `src/App.test.js`
- Versoes afetadas: `2.0.0` e anteriores que ainda persistem `estoqueff_products` por snapshot completo

### Ajustes Tecnicos
- Refatorada a persistencia de produtos para escrita granular em `estoqueff_products/{productId}` durante cadastro, edicao e exclusao online.
- Adicionada migracao compatível do formato legado em array para mapa indexado por `id`, preservando leitura retrocompativel de array e objeto.
- Alterada a sincronizacao de movimentacoes para transacionar apenas o produto-alvo, reduzindo contenção entre usuarios e risco de sobrescrita concorrente.
- Refatorada a fila offline de movimentacoes para usar uma outbox unitaria em `estoqueff_outbox_movements`, mantendo migracao automatica da fila legada baseada em snapshot.
- Mantida a regra funcional simplificada para saldo: `entrada => soma`, `saida => subtrai`, `sem saldo => rejected`, sem movimentacao parcial.
- Ajustado o retry offline para continuar tentando ate concluir, com backoff limitado a `30s`.
- Substituidos IDs baseados apenas em `Date.now()` por IDs cliente mais robustos para produtos, usuarios e movimentacoes.
- Mantida compatibilidade offline existente com fallback local e restore de backup.

### Justificativas
- Evitar sobrescrita do saldo por operacoes de CRUD de produto que antes gravavam toda a colecao.
- Reduzir risco de race condition entre movimentacao concorrente e atualizacao de cadastro de produto.
- Melhorar compatibilidade com cenarios multiusuario e intermitencia de rede.
- Remover dependência da fila por snapshot completo de historico, simplificando a sincronizacao de movimentacoes pendentes.
- Garantir que pendencias offline nao sejam abandonadas apos varias falhas de rede.
- Preparar a base para armazenamento indexado por `productId`, mais adequado para RTDB.

### Validacao
- Testes executados: `npm test -- --watch=false --runInBand`
- Testes executados: `npm run build`
- Resultado: `15 passed, 15 total`
- Observacao: o ambiente de teste ainda emite aviso conhecido de `jspdf`/`canvas` no `jsdom`, sem falha da suite.
