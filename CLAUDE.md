# Bastião – Casa do Xis Gaúcho

Ecossistema de vendas de uma lancheria em Florianópolis/São José (SC): ERP central, KDS da cozinha, painel de chamada, totem de autoatendimento, site de pedidos e app. Integra Mercado Pago, emissor de NFC-e credenciado em SC e iFood.

## Documentos de referência (leia antes de planejar qualquer fase)

- `docs/versao-mestre.md`: **prevalece sobre todos os outros**. Decisões fechadas, requisitos RQ-01 a RQ-27, roadmap.
- `docs/etapa-1-processos.md`: jornadas do totem, app, site, KDS, ofertas do Bastião, pedido híbrido.
- `docs/etapa-3-arquitetura.md`: tecnologias, módulos, modelo de dados, financeiro.
- `docs/cardapio-oficial.md`: catálogo, combos, upsells e identidade verbal.

Se encontrar conflito ou lacuna nos documentos, **pare e pergunte**. Não invente regra de negócio.

## Stack

- TypeScript em tudo. Monorepo com pnpm + Turborepo.
- `apps/api`: NestJS, PostgreSQL + Prisma, Redis + BullMQ, Socket.IO.
- `apps/admin`: painel do ERP (Next.js).
- `apps/site`: site de pedidos (Next.js, PWA).
- `apps/mobile`: app (React Native + Expo).
- `apps/totem`: totem (React + Vite, modo quiosque).
- `apps/kds`: telas da cozinha e painel de chamada (React + Vite).
- `apps/agente`: agente local do totem (impressora térmica).
- `packages/regras`: preço, combos, ofertas, cashback, hábitos (usado por todos os canais).
- `packages/api-client`: cliente tipado da API.
- `packages/marca`: tokens de design, fontes, poses do Bastião.

## Regras invioláveis

1. **Nenhum preço inventado.** Preços vêm só do ERP. Produto sem preço, foto ou ficha técnica fica como rascunho e não aparece para o cliente. Nunca exibir "R$ X" ou valor fictício.
2. **Preço calculado no servidor.** O valor enviado por qualquer tela nunca é aceito como verdade (RQ-06).
3. **Pedido só vai para a cozinha com `payment_status = PAID`** confirmado pelo provedor, salvo exceções formais (iFood com pagamento válido, dinheiro no balcão) (RQ-04).
4. **`order_status` e `payment_status` são campos separados** (RQ-03).
5. **Idempotência** em criação de pedido, cobrança e webhooks: nada pode duplicar (RQ-10).
6. **Reserva de estoque temporária e atômica**, liberada quando o pagamento expira (RQ-07 a RQ-09).
7. **Pagamento e fiscal atrás de interfaces** `PaymentProvider` e `FiscalProvider`. Nenhum módulo fala direto com Mercado Pago, Cielo ou emissor fiscal (RQ-16, RQ-17).
8. **O sistema não emite nem assina NFC-e.** Envia os dados ao emissor credenciado na SEF/SC por API. A nota roda em fila e não trava a venda (RQ-18).
9. **Dados de cartão nunca passam pelos nossos servidores.**
10. **LGPD:** CPF e celular criptografados no banco e mascarados nas telas; consentimentos separados e registrados; exclusão de conta no app e por página web (RQ-25).
11. **Multiunidade:** todo dado operacional carrega `store_id`.
12. **Login:** totem sem login (identificação opcional); app com login obrigatório; site com cardápio e sacola livres e login só ao confirmar o pedido, sem perder a sacola (RQ-02).
13. **Textos da interface** seguem o roteiro e a identidade verbal do Bastião nos documentos. Não crie falas novas do Bastião sem pedir aprovação.
14. **Nunca commitar segredos.** Use `.env` local e mantenha um `.env.example` atualizado.

## Como trabalhar

- Antes de cada fase ou funcionalidade grande: apresente um plano curto (arquivos, migrações, testes) e **espere aprovação**.
- Entregas pequenas e testáveis. Um módulo por vez.
- Testes automáticos obrigatórios para preço, combos, ofertas, cashback, estados do pedido, pagamento e fiscal.
- Migrações sempre pelo Prisma, versionadas.
- Código, nomes de variáveis e commits em inglês. Textos de interface em português.
- Integrações sempre primeiro no ambiente de teste do fornecedor.
- Ao terminar uma tarefa: diga o que mudou, como testar e o que ficou pendente.

## Fase atual

Fase 1 · Fundação (ver roadmap na Versão Mestre). Em paralelo, a Fase 0 (credenciamentos e provas técnicas) está com o dono do projeto.

## Comandos

Requisitos: Node 22, pnpm 10, PostgreSQL 16 e Redis 7 (via `docker compose` ou instalados na máquina).

```bash
pnpm install                                  # instalar tudo
pnpm db:up                                    # subir Postgres e Redis (Docker)
cp apps/api/.env.example apps/api/.env        # e preencher as chaves (ver comentários no arquivo)
pnpm db:migrate                               # criar/aplicar migrações (prisma migrate dev)
pnpm db:seed                                  # unidade DEV-01 e usuário dono (só em dev)
pnpm dev                                      # rodar todos os apps
pnpm --filter @bastiao/api dev                # rodar só a API (porta 3000)
pnpm test                                     # todos os testes (e2e da API usam o banco bastiao_test)
pnpm lint && pnpm typecheck && pnpm build     # o mesmo que a CI roda
pnpm format                                   # Prettier
```

Portas locais: API 3000, admin 3001, site 3002, totem 5173, kds 5174.

Os testes e2e da API rodam `prisma migrate deploy` no banco de `DATABASE_URL` (padrão: `bastiao_test`) e apagam os dados dele a cada teste. Nunca aponte para um banco com dados reais.
