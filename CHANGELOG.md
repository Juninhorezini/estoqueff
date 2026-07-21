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
- Substituidos IDs baseados apenas em `Date.now()` por IDs cliente mais robustos para produtos, usuarios e movimentacoes.
- Mantida compatibilidade offline existente com fallback local e restore de backup.

### Justificativas
- Evitar sobrescrita do saldo por operacoes de CRUD de produto que antes gravavam toda a colecao.
- Reduzir risco de race condition entre movimentacao concorrente e atualizacao de cadastro de produto.
- Melhorar compatibilidade com cenarios multiusuario e intermitencia de rede.
- Preparar a base para armazenamento indexado por `productId`, mais adequado para RTDB.

### Validacao
- Testes executados: `npm test -- --watch=false --runInBand`
- Resultado: `13 passed, 13 total`
- Observacao: o ambiente de teste ainda emite aviso conhecido de `jspdf`/`canvas` no `jsdom`, sem falha da suite.
