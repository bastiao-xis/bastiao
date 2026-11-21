# Bastião · Versão Mestre da Arquitetura

Nov 8, 2026 · @Rafael

## Decisões fechadas

Este documento junta a [Etapa 1: Processos](https://claude.ai/artifact/UpqbwxF68Mdw6xAyBgzhYq) e a [Etapa 3: Arquitetura](https://claude.ai/artifact/QoVnMT1mVnFvjrL4Xq1LPg), corrige as divergências entre elas e vira a referência oficial para o Claude Code. **Quando houver conflito, vale o que está aqui.** Os requisitos marcados com RQ são obrigatórios.

| Tema | Decisão |
| --- | --- |
| Local da primeira loja | Florianópolis ou São José, em Santa Catarina. A regra fiscal é a de SC (corrige as menções à SEFAZ-RS nas etapas anteriores) |
| Backend e ERP | NestJS modular, PostgreSQL + Prisma, Redis + BullMQ + Socket.IO, tudo em TypeScript num monorepo (pnpm + Turborepo) |
| App | React Native + Expo, **login obrigatório** antes do cardápio |
| Site | Next.js instalável (PWA). **Cardápio e sacola livres**, com login só ao confirmar o pedido |
| Totem | React + Vite em modo quiosque, **sem login**, com identificação opcional por celular ou CPF |
| Cozinha e painel | React + Vite + WebSocket, com duas telas (Chapa; Fritura e expedição) e uma TV |
| Painel do ERP | Next.js, com cardápio, preços, estoque, financeiro e relatórios |
| Compartilhado entre os canais | Regras de preço, combos, ofertas e cashback, tipos de dados, contratos da API e identidade visual. **As telas não são compartilhadas** entre o app e o site |
| Consumo no local | Chamada por **senha** no painel e no balcão, sem número de mesa |
| Pagamentos | Mercado Pago, **condicionado à prova técnica do totem**. Cielo Conecta como plano B, atrás de uma camada de pagamento que não depende do fornecedor |
| Fiscal | Emissor de NFC-e (PAF-NFC-e) **credenciado na SEF/SC**, integrado ao ERP por API. O ERP não assina nem transmite a nota |
| Marketplace | iFood Merchant API, por um adaptador que converte o pedido do iFood num pedido interno |
| Infraestrutura | AWS ou Google Cloud, região São Paulo |

## Arquitetura-alvo

A espinha dorsal da Etapa 3 continua: uma API central e um banco só. O que muda é que pagamento e fiscal agora ficam atrás de camadas próprias, e o pedido ganha regras de segurança.

&#91;embedded content: arquitetura-alvo do Bastião · versão mestre\]

App, site, totem e iFood são portas de entrada para o mesmo negócio. As telas são próprias de cada canal, mas as regras de preço, combos, ofertas e cashback são as mesmas em todos.

## Canais, login e modalidades de pedido

Cada pedido tem um **canal** (por onde entrou) e uma **modalidade** (como chega ao cliente). As duas informações são separadas, e as três modalidades não se misturam na experiência.

| Canal | Login | Modalidades | Pagamento |
| --- | --- | --- | --- |
| Totem | Não tem. Identificação opcional por celular ou CPF | Consumo no local ou retirada | Cartão na maquininha ou Pix na tela |
| App | Obrigatório, antes do cardápio (código por WhatsApp ou SMS, Google ou Apple) | Delivery, retirada ou consumo no local | Pix ou cartão online |
| Site | Só ao confirmar o pedido. Cardápio e sacola são livres | Delivery, retirada ou consumo no local | Pix ou cartão online |
| Balcão (caixa) | Login da equipe | Consumo no local ou retirada | Maquininha ou dinheiro |
| iFood | Do iFood | A que vier do iFood | Conforme o status informado pelo iFood |

**As três modalidades (`fulfillment_type`)**

- **DINE\_IN, consumo no local:** o cliente é chamado pela senha e pelo nome no painel. Sem número de mesa. É a única modalidade que permite o pedido híbrido (itens marcados como "levar").
- **PICKUP, retirada no balcão:** tudo vai embalado, com horário "agora" ou agendado.
- **DELIVERY, entrega:** exige endereço dentro da área de uma unidade e passa pelo módulo de entregadores.

**RQ-01 · Entrega checada antes da sacola.** No site e no app, o endereço (ou a localização) é pedido no início. O sistema informa logo se aquele endereço é atendido, por qual unidade, a taxa e o prazo. O cliente nunca monta uma sacola para só descobrir no fechamento que não há entrega.

**RQ-02 · Sacola do site preservada no login.** O cliente monta a sacola sem conta. Ao confirmar o pedido, ele entra ou cria a conta, e a sacola continua intacta, com o Pila de Volta e o histórico aplicados a partir daí.

## Status do pedido e do pagamento

O andamento do pedido e a situação do pagamento são dois campos diferentes. Assim, o painel nunca confunde "pago" com "entregue", nem "confirmado" com "pago".

| Andamento (`order_status`) | Pagamento (`payment_status`) | O que significa |
| --- | --- | --- |
| `AWAITING_PAYMENT` | `PENDING` | Pedido criado, estoque reservado, esperando a cobrança |
| `CONFIRMED` | `PAID` | Pagamento validado; o pedido entra na fila da cozinha |
| `PREPARING` | `PAID` | Em produção na Chapa ou na Fritura |
| `READY` | `PAID` | Pronto: senha no painel (local), aviso de retirada, ou esperando o entregador |
| `OUT_FOR_DELIVERY` | `PAID` | Com o entregador (só no delivery) |
| `DELIVERED` | `PAID` | Entregue ao cliente |
| `CANCELED` | `FAILED`, `CANCELED` ou `REFUNDED` | Cancelado antes do pagamento, recusado, ou cancelado e estornado |

**RQ-03 · Transições controladas.** O pedido só anda numa ordem permitida. Cada mudança grava um evento com hora, autor (cliente, equipe, sistema ou integração) e motivo, formando o histórico completo do pedido.

**RQ-04 · Produção só com pagamento válido.** O pedido só vai para a cozinha com `payment_status = PAID` confirmado pelo provedor (webhook ou consulta). A única exceção é o pagamento externo formalmente previsto, como o pedido do iFood com status de pagamento válido ou o pagamento em dinheiro no balcão registrado pela equipe.

**RQ-05 · Itens do pedido híbrido.** No consumo no local, cada item tem seu próprio estado de produção: preparar agora, preparar na saída (aguardando liberação) e pronto. O pedido só vira `DELIVERED` quando todos os itens foram entregues.

## Requisitos de pedido, estoque e pagamento

Estas regras protegem o caixa e o estoque nas situações que mais dão problema em operação real: internet caindo no meio do pagamento, aviso de pagamento repetido e dois clientes disputando o último item.

| Requisito | Regra |
| --- | --- |
| **RQ-06 · Preço no servidor** | O ERP recalcula o preço de toda sacola. O valor enviado pela tela nunca é aceito como verdade |
| **RQ-07 · Reserva temporária de estoque** | Ao criar o pedido, o estoque fica reservado por um prazo configurável (padrão: 15 min) |
| **RQ-08 · Expiração** | Se o pagamento não se concluir no prazo, o pedido vira `CANCELED` / `CANCELED` e a reserva é liberada automaticamente |
| **RQ-09 · Último item** | A reserva é atômica no banco: se dois clientes tentarem o último item, só um consegue, e o outro recebe a mensagem de esgotado antes de pagar |
| **RQ-10 · Idempotência** | Toda criação de pedido e de cobrança leva uma chave única. Repetir a mesma chamada ou receber o mesmo webhook duas vezes nunca gera dois pedidos nem duas cobranças |
| **RQ-11 · Tentativas de pagamento** | Cada tentativa (cartão recusado, Pix expirado, troca de forma) é um registro próprio (`payment_attempt_id`), ligado ao mesmo pedido |
| **RQ-12 · Recuperação após queda** | Se a tela perder a conexão durante o pagamento, ao voltar ela consulta o ERP e continua de onde parou. Nunca cobra de novo sem antes conferir |
| **RQ-13 · Conciliação ativa** | Uma rotina consulta o provedor a cada poucos minutos e corrige pedidos cujo pagamento foi aprovado, mas cujo aviso não chegou. O pedido nunca fica parado como pendente se já foi pago |
| **RQ-14 · Estorno** | Estorno só por gerente, com motivo, pela camada de pagamento. Ele atualiza o pedido, o Pila de Volta (que é descontado), o estoque (se o item não foi produzido) e o financeiro |
| **RQ-15 · Histórico de eventos** | Todo pedido guarda a linha do tempo completa: criação, tentativas de pagamento, aprovação, nota, cozinha, entrega, cancelamento e estorno |

## Pagamentos

O Mercado Pago segue como provedor principal, porque atende totem, app e site numa conta só. A documentação oficial descreve a integração da Point com [totens de autoatendimento no modo SELF\_SERVICE](https://www.mercadopago.com.ar/developers/pt/docs/mp-point-v2/overview), mas essa página está no portal da Argentina. Por isso, a compra do totem e da maquininha só acontece depois de uma prova técnica no Brasil.

**RQ-16 · Camada de pagamento independente.** O backend tem uma interface `PaymentProvider` (criar cobrança, consultar, cancelar, estornar, receber aviso) e um adaptador por fornecedor. Trocar o Mercado Pago pela Cielo não pode exigir mudança em pedidos, cozinha ou financeiro.

**Prova técnica do Mercado Pago (Fase 0)**

| Teste | Passa quando |
| --- | --- |
| Point Smart em modo SELF\_SERVICE no Brasil | O terminal aceita o modo e fica restrito a pagamentos, com senha |
| Ordem criada pela API e paga no terminal sem operador | O aviso de aprovado chega ao ERP em segundos |
| Tempo de expiração | A ordem não expira antes de o cliente pagar. No SELF\_SERVICE, [o padrão é 15 segundos](https://www.mercadopago.com.ar/developers/pt/docs/mp-point-v2/payment-processing), então o prazo precisa ser configurado na criação |
| Pix | QR dinâmico na tela do totem, com confirmação automática |
| Cancelamento e estorno | Cancela uma ordem antes do pagamento e estorna uma ordem paga pela API |
| Vale-refeição e vale-alimentação | Confirmar quais bandeiras funcionam no terminal |
| App e site | Pix e cartão pelo checkout, com cartão salvo e aviso de aprovado |

**Plano B: Cielo.** Se o Mercado Pago não confirmar o totem sem operador no Brasil, a alternativa é o [Cielo Conecta](https://blog.cielo.com.br/produtos-e-servicos/cielo-conecta/?amp=1) com PINPad no totem, mais a API E-commerce da Cielo para o app e o site. São dois produtos, com contratação e homologação próprias, encaixados atrás da mesma camada de pagamento (RQ-16).

## Fiscal em Santa Catarina

Em SC, o programa que emite a NFC-e (PAF-NFC-e) [só pode ser fornecido por empresa desenvolvedora credenciada na SEF/SC](https://legislacao.sef.sc.gov.br/html/atos_diat/2026/atodiat_26_054.htm) (Ato DIAT nº 54/2026, de 11/09/2026). O mesmo ato diz que usar um serviço de mensageria não tira as obrigações da desenvolvedora. Além disso, [o credenciamento do lojista para emitir NFC-e é concedido pela desenvolvedora do emissor](https://www.sef.sc.gov.br/servicos/servico/136/NFC-e_Nota_Fiscal_de_Consumidor_Eletr%C3%B4nica). Por isso, **o Bastião não vai desenvolver um emissor próprio**: vai contratar um PAF-NFC-e já credenciado em SC que ofereça integração por API.

| Quem | Faz o quê |
| --- | --- |
| ERP Bastião | Monta os dados da venda (itens, descontos, cashback, forma de pagamento, CPF), envia ao emissor, guarda chave, XML, status e DANFE, controla a fila, os reenvios e os cancelamentos |
| Emissor credenciado em SC | Assina, transmite à SEF/SC, cuida da contingência oficial e mantém o programa homologado |
| Contador | Define a tributação de cada produto (NCM, CFOP, CST ou CSOSN) e valida o tratamento de descontos e cashback |

**RQ-17 · Camada fiscal independente.** Como nos pagamentos, o ERP fala com o emissor por uma interface `FiscalProvider`. Trocar de fornecedor fiscal não mexe no restante do sistema.

**RQ-18 · A nota não trava a venda.** A emissão roda em fila, depois do pagamento aprovado. Se o emissor ou a SEF/SC caírem, o pedido segue para a cozinha, e a nota sai em contingência ou é reenviada, com alerta ao gerente.

**O fornecedor fiscal escolhido precisa confirmar:** credenciamento vigente na SEF/SC; emissão para venda no balcão, no totem e no delivery próprio; tratamento de desconto de combo e de cashback; e integração por API com retorno por webhook.

## iFood

São dois projetos diferentes. O **site próprio** é a loja do Bastião, sem comissão, com experiência parecida com a do iFood. A **integração com o iFood** recebe os pedidos feitos no marketplace e publica o cardápio lá, pela [Merchant API](https://developer.ifood.com.br/pt-BR/docs/guides/). O iFood não tem banco de dados paralelo: tudo entra no ERP central e cai no mesmo KDS.

**RQ-19 · Adaptador do iFood.** Cada pedido recebido vira um pedido interno com `sales_channel = IFOOD`, preservando:

- O ID original do iFood (`external_order_id`).
- Os produtos e as modificações, mapeados para os códigos do cardápio do ERP.
- O horário de coleta e a modalidade de entrega.
- A forma e o status do pagamento **exatamente como o iFood informar**. Nenhum pedido externo é tratado como pago por padrão.
- As taxas e comissões, para o financeiro e a conciliação.
- O status de cancelamento e os motivos.

**RQ-20 · Não perder pedido.** O adaptador consome os eventos do iFood, confirma o recebimento de cada um e trata novas tentativas e eventos repetidos sem duplicar pedidos.

**RQ-21 · Cardápio e disponibilidade.** O cardápio, os preços por canal e os itens esgotados são enviados do ERP ao iFood. A pausa do delivery vale para o iFood, o app e o site ao mesmo tempo.

**Homologação:** a [documentação do iFood](https://developer.ifood.com.br/en-US/docs/guides/getting-started) pede conta profissional com CNPJ e homologação do aplicativo completo antes de liberar a produção. A revisão externa citou também uma exigência de CNAE de tecnologia, que não consegui confirmar. Se o CNPJ da lancheria não for aceito, a integração terá de ser registrada por uma empresa desenvolvedora parceira. O cadastro começa na Fase 0. Se o iFood for obrigatório na inauguração, a homologação vira condição para abrir a loja.

## Delivery e entregadores

O módulo Delivery passa a cuidar também dos entregadores próprios, que era uma lacuna. O entregador usa uma tela simples no celular (web, sem app de loja), e o cliente acompanha cada etapa.

1. **Pedido pronto.** Com o pedido em `READY` e modalidade DELIVERY, a expedição atribui um entregador, ou o sistema sugere o próximo livre.
2. **Saída.** O entregador confirma a coleta no celular, o pedido vira `OUT_FOR_DELIVERY` e o cliente recebe o aviso "Saiu pra entrega".
3. **Rota.** O cliente vê a previsão de chegada. A posição do entregador só é compartilhada enquanto ele está com o pedido.
4. **Entrega.** O entregador confirma com um código de 4 dígitos que o cliente vê no app ou no site, e o pedido vira `DELIVERED`.
5. **Problema na entrega.** Cliente ausente, endereço errado ou acidente abrem uma ocorrência para o gerente, que decide entre reentregar, cancelar ou estornar.

| Configuração no ERP | Exemplo (a definir) |
| --- | --- |
| Faixas de distância e taxa por faixa | Até 2 km, 2 a 4 km, 4 a 6 km |
| Pedido mínimo | Por unidade |
| Entregadores | Cadastro, turno, status (livre, em rota, pausa) e acerto por entrega |
| Reserva | Chamar o iFood Sob Demanda quando faltar entregador |
| Pausa | Pausa do delivery em todos os canais com um clique |

**RQ-22 · Precisa de ajuda?** O acompanhamento do pedido tem um botão "Precisa de ajuda?" com motivos fixos: atraso, item faltando, pedido errado, cancelamento e reembolso. Cada chamado fica registrado no pedido e abre a conversa no WhatsApp da loja. O gerente resolve pelo ERP, com reenvio, crédito em Pila de Volta ou estorno.

## Cozinha: KDS e pedido híbrido

O modelo de duas telas, as metas (preparo de 8 a 12 min, no máximo 15) e o limite de 6 a 8 comandas por tela (máximo 10) continuam. Mudam dois pontos.

**RQ-23 · Disparo da fritura configurável.** O atraso da batata deixa de ser fixo em 5 minutos. Ele é configurado no ERP por produto e tamanho (pequena, média e grande podem ter tempos diferentes) e por estação. Os 5 minutos são só o valor inicial. Com o tempo, o sistema sugere ajustes a partir do tempo médio real de preparo.

**RQ-24 · Produção e entrega por item no pedido híbrido.** Cada item de um pedido no local tem estado próprio:

| Estado do item | Na cozinha |
| --- | --- |
| Preparar agora | Entra na fila normal |
| Aguardando liberação | Fica cinza na coluna "Aguardando liberação" até o cliente liberar pelo QR do ticket, pelo app ou no balcão |
| Preparar na saída | Depois de liberado, entra com prioridade |
| Entregue junto | Sai com o resto do pedido, embalado separado |
| Entregue | Item conferido e entregue |

**Chamada por senha:** no consumo no local e na retirada, o painel mostra senha e nome. O ticket do totem e o app mostram a mesma senha.

**Ordem de desenvolvimento:** o pedido híbrido continua no produto, mas entra **depois** que o fluxo básico (pedido, pagamento, cozinha, painel) estiver estável, e passa por teste num turno simulado antes da inauguração.

## Conta, LGPD e lojas de aplicativo

Continua valendo o que foi definido na Etapa 3: consentimentos separados, CPF e celular criptografados e mascarados, chaves fora do código, perfis de acesso, auditoria e backup com teste de restauração. Entram três requisitos novos.

**RQ-25 · Exclusão de conta no app e na web.** A Apple e o Google exigem que, se o app permite criar conta, ele também permita excluí-la. O Google pede ainda um link na web. O Bastião terá:

- No app e no site: Perfil → "Excluir minha conta e meus dados", com confirmação.
- Uma página pública, como `[domínio]/privacidade/excluir-conta`, que funciona sem o app.
- Na exclusão, os dados pessoais são apagados ou anonimizados. Ficam só as notas fiscais e os registros que a lei manda guardar, e o saldo do Pila de Volta é zerado, com aviso antes.

**RQ-26 · Login obrigatório no app, com cuidado na revisão da Apple.** O app exige conta antes do cardápio, como decidido. Para reduzir o risco de recusa na revisão, a tela de boas-vindas explica o que a conta oferece (pedido salvo, "o de sempre", Pila de Volta e acompanhamento), e o login com Apple fica disponível ao lado do Google. Se a Apple recusar, o plano B é liberar o cardápio antes do login, como no site.

**RQ-27 · Segurança reforçada para a equipe.** Quem pode estornar, mudar preço, ver dados de clientes ou mexer no financeiro entra com dois fatores (senha mais código no celular), e a sessão expira por inatividade.

## Campos obrigatórios no banco de dados

As entidades da Etapa 3 continuam. O pedido ganha estes campos, que impedem o sistema de confundir um pedido confirmado com um pedido pago, ou uma venda do totem com uma do iFood.

| Campo | Valores | Para quê |
| --- | --- | --- |
| `store_id` | ID da unidade | Separa estoque, cozinha, preços e DRE por loja |
| `sales_channel` | `TOTEM`, `APP`, `SITE`, `POS`, `IFOOD` | Canal de entrada, para relatórios, preços e comissões |
| `fulfillment_type` | `DINE_IN`, `PICKUP`, `DELIVERY` | Modalidade, que define embalagem, chamada e entrega |
| `order_status` | Ver a seção de status | Andamento da produção e da entrega |
| `payment_status` | `PENDING`, `PAID`, `FAILED`, `CANCELED`, `REFUNDED` | Situação financeira, separada do andamento |
| `external_order_id` | ID do iFood | Liga o pedido interno ao do marketplace |
| `payment_attempt_id` | Uma por tentativa | Histórico de recusas, trocas de forma e aprovação |
| `stock_reservation_id` | Reserva temporária | Libera o estoque quando o pagamento expira |
| `delivery_id` | Entrega | Entregador, saída, rota e confirmação |
| `fiscal_document_id` | NFC-e | Chave, XML, status e contingência |
| `idempotency_key` | Chave única | Impede pedido e cobrança em dobro |
| `ticket_number` | Senha do dia, por unidade | Chamada no painel e no balcão |

No item do pedido entram `item_fulfillment` (AQUI ou LEVAR) e `item_production_status` (os estados do RQ-24).

## Roadmap corrigido e prioridades

O roadmap ganha uma Fase 0 de credenciamentos e provas técnicas, que corre em paralelo desde o primeiro dia. Ele resolve a divergência sobre o iFood: a integração é desenvolvida na Fase 7, mas o cadastro e a homologação começam na Fase 0. Se o iFood for obrigatório na abertura, ele vira condição de inauguração.

| Fase | Entrega | Pronto quando |
| --- | --- | --- |
| 0 · Credenciamentos e provas | Prova do Mercado Pago, escolha do emissor fiscal de SC, cadastro no iFood, contas das lojas de aplicativo | Pagamento no totem comprovado, emissor contratado e iFood em homologação |
| 1 · Fundação | Monorepo, banco, ambientes, testes e publicação automática | Uma mudança vai sozinha para o ambiente de teste |
| 2 · ERP: cardápio, preços e estoque | Unidades, cardápio oficial, fichas técnicas, mídia, preços por canal, markup | Cardápio publicado de forma centralizada |
| 3 · Pedidos e KDS | Pedidos com RQ-03 a RQ-15, duas telas da cozinha, painel por senha | Pedido do balcão chega à cozinha e ao painel |
| 4 · Pagamentos e fiscal | Camadas `PaymentProvider` e `FiscalProvider`, Mercado Pago e emissor de SC | Cartão, Pix, estorno e NFC-e homologados |
| 5 · Totem | Jornada completa do protótipo, impressora e acessibilidade | Venda real no totem com nota |
| 6 · Site e app | Conta, unidade, sacola, entrega e retirada, entregadores, ajuda, exclusão de conta | App nas lojas e site no ar, com pedidos na cozinha |
| 7 · iFood | Adaptador, eventos, cardápio e conciliação | Homologação aprovada |
| 8 · Fidelidade, inteligência e marketing | Pila de Volta, "o de sempre", aviso de hábito, pedido híbrido avançado | Cashback e avisos funcionando com clientes de teste |
| 9 · Piloto | Turnos simulados e vendas reais, DRE e curvas ABC com dados reais | Uma semana de operação sem incidente grave |

**P0 · Bloqueios, a resolver antes do desenvolvimento de produção**

- [ ] Confirmar com o Mercado Pago o totem sem operador (SELF\_SERVICE) no Brasil
- [ ] Escolher e contratar o emissor PAF-NFC-e credenciado na SEF/SC
- [ ] Confirmar com o iFood quem pode registrar a integração (CNPJ da loja ou desenvolvedora parceira)
- [x] Fechar a tecnologia: React Native + Expo no app e Next.js no site
- [x] Separar consumo no local, retirada e delivery como modalidades distintas

**P1 · Antes de inaugurar**

- [ ] Reserva temporária de estoque com liberação após expiração
- [ ] Histórico de eventos e conciliação financeira
- [ ] Atribuição e acompanhamento de entregadores
- [ ] Exclusão de conta no app e na web
- [ ] Teste de cadastro, pedido híbrido e acessibilidade do totem
- [ ] Homologação de todas as formas de pagamento, incluindo estornos
- [ ] Emissão fiscal e contingência validadas em SC

**P2 · Evolução, depois que a operação estabilizar:** campanhas por comportamento, vídeos animados de todos os produtos, inteligência de cardápio, otimização de rotas e previsão de demanda. O "o de sempre" e o aviso de hábito ficam na Fase 8, porque precisam de histórico real.

## Perguntas para os fornecedores

Estas perguntas destravam a Fase 0. Vale mandar por escrito e guardar as respostas junto deste documento.

**Mercado Pago (comercial e suporte de integrações)**

1. A Point Smart 1 ou 2 pode operar no Brasil num totem de autoatendimento, sem operador, no modo SELF\_SERVICE com a Orders API?
2. Qual prazo de expiração dá para configurar na ordem do modo SELF\_SERVICE?
3. Existe homologação específica para totem? Quanto tempo leva?
4. O Pix pode ser cobrado pelo próprio terminal integrado, ou só por QR na tela do totem?
5. Quais bandeiras de vale-refeição e vale-alimentação o terminal aceita?
6. Quais são as taxas de débito, crédito à vista e Pix, o prazo de recebimento e o custo de antecipação?

**Emissor de NFC-e credenciado em SC**

1. Qual é o número do credenciamento vigente na SEF/SC e a validade do laudo do programa?
2. A integração por API serve para vendas do totem, do balcão, do app e do delivery próprio, para várias unidades?
3. Como trata desconto de combo e uso de cashback na nota?
4. Como funciona a contingência e o retorno (webhook ou consulta)?
5. Quais são o preço por nota ou por mês, o suporte e o prazo de implantação?

**iFood (portal do desenvolvedor)**

1. O CNPJ da lancheria pode registrar o aplicativo de integração, ou é preciso uma empresa desenvolvedora?
2. Quais critérios de homologação se aplicam a um sistema próprio com pedidos, cardápio e eventos?
3. Quanto tempo leva a homologação?

**Cielo (só se o Mercado Pago não confirmar o totem)**

1. O Cielo Conecta, com PINPad, atende um totem sem operador?
2. A API E-commerce cobre Pix e cartão no app e no site com a mesma conta?
3. Quais são as taxas e o prazo de homologação de cada produto?
