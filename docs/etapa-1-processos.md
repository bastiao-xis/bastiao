# Bastião – Casa do Xis Gaúcho · Etapa 1: Definição de Processos

Nov 6, 2026 · @Rafael

> **Atualizado pela [Versão Mestre da Arquitetura](https://claude.ai/artifact/W39S4h6a9wBWfdSkd2Wyxn).** Em caso de conflito, vale a Versão Mestre. A loja será em Florianópolis ou São José (SC): onde este documento cita SEFAZ-RS ou emissor próprio, leia emissor PAF-NFC-e credenciado na SEF/SC. O consumo no local é chamado por senha, o app exige login e o site libera cardápio e sacola, pedindo login só ao confirmar o pedido.

## Visão geral do ecossistema

São quatro canais de venda (Totem, App de celular, Site de pedidos online e iFood) mais o KDS da cozinha e o POS, todos ligados a um ERP central. O cliente é o mesmo em todos os canais, identificado pelo celular ou pelo CPF.

&#91;embedded content: ecossistema Bastião · 8 componentes ligados ao ERP\]

O totem e o app mandam os pedidos para o ERP, que os repassa para a cozinha só depois do pagamento aprovado. O ERP também emite a nota e dispara os pushes de hábito.

## Referências de mercado

O Bastião vai juntar os três melhores padrões que essas redes já validaram: a identificação por CPF que gera sugestões (McDonald's), a fidelidade que vale no app e no totem (Burger King) e a chamada pelo nome com a cozinha em telas (Jeronimo).

| Rede | O que ela faz | O que o Bastião adota |
| --- | --- | --- |
| [McDonald's](https://www.meioemensagem.com.br/marketing/tecnologia-o-novo-sabor-do-mcdonalds) | No totem, o cliente informa o CPF e libera o histórico de pedidos para receber sugestões de lanches | Identificação por celular ou CPF logo no início, com o card "O de sempre?" |
| [Burger King](https://www.cnnbrasil.com.br/economia/macroeconomia/burger-king-cria-programa-de-fidelidade-e-promete-descontos-e-produtos-gratis/) | O Clube BK dá 1 ponto por real gasto, tanto no app quanto nos totens e no balcão. O [app](https://apps.apple.com/BR/app/id1295116265) faz pedido antecipado, pagamento e push | Um cadastro único que vale em todos os canais, pedido antecipado no app e push |
| [Jeronimo](https://www.gazetadopovo.com.br/economia/nova-economia/jeronimo-hamburgueria-do-grupo-durski-abre-4-unidade-e-lanca-app-para-fazer-pedidos-cf1uncj57cdjnigpijl7b608n) | O app faz e paga o pedido, permite escolher comer no local ou levar e chama o cliente pelo nome. A cozinha usa [telas com cada passo do preparo](https://viva.com.br/tecnologia/totens-de-autoatendimento-se-espalham-por-restaurantes-e-bares.html) | Escolha local/levar, chamada pelo nome e pipeline de cozinha em telas |

Também vale copiar o padrão de mercado de pedir o nome e o CPF na nota direto no totem ([exemplo de configuração](https://manual.cplug.com.br/books/autoatendimento-v2/page/guia-completo-de-utiliza%C3%A7%C3%A3o---totem-de-autoatendimento-v2/export/pdf)) e o de só mandar o pedido para a cozinha depois do pagamento aprovado.

## Processo do Totem

O pedido no totem tem 9 telas. O cliente se identifica logo no começo, para o sistema já oferecer "O de sempre", e o pedido só vai para a cozinha depois que o POS aprovar o pagamento.

1. **Tela de descanso.** Mostra o vídeo ou banner do Bastião com a chamada "Toque para pedir".
2. **Onde vai comer?** O cliente escolhe entre "Comer aqui" e "Levar". A escolha define a embalagem e aparece no card da cozinha.
3. **Identificação.** O cliente informa celular ou CPF num teclado numérico grande, com o botão "Pular" visível.
   1. Se for reconhecido, aparece "Bah, Joaquim! Bom te ver de novo" e o card **O de sempre?**, que monta a sacola com um toque e ainda deixa editar.
   2. Se for novo, ele digita o nome e aceita os termos (LGPD). O cadastro fica criado ali mesmo.
4. **Cardápio.** As categorias são Xis, Combos, Batatas, Bebidas e Sobremesas, com os destaques no topo.
5. **Personalização do item.** O cliente pode tirar ingredientes, colocar adicionais pagos e escrever uma observação curta.
6. **Upsell.** O Bastião faz as ofertas do roteiro oficial (veja "Upsells e order bumps"), cada uma no máximo uma vez por pedido.
7. **Sacola.** O cliente revisa, edita ou remove itens. O total fica sempre visível.
8. **Fechamento.** O CPF na nota vem pré-preenchido se o cliente já se identificou. O nome para a chamada é confirmado e ele escolhe Pix, crédito ou débito.
9. **Confirmação.** O totem mostra a senha e o nome, imprime o ticket e envia o pedido para a cozinha. Depois, volta para a tela de descanso.

| Campo | Obrigatório? | Validação | Para que serve |
| --- | --- | --- | --- |
| Celular | Não, mas incentivado | DDD + 9 dígitos | Chave do cliente, histórico e vínculo com o app |
| CPF | Não | Dígitos verificadores; aparece mascarado na tela | CPF na NFC-e e chave alternativa do cliente |
| Nome | Sim | De 2 a 20 caracteres | Chamada do pedido no painel e no balcão |
| Comer aqui / Levar | Sim | Escolha única | Embalagem e card da cozinha |

**Tela de identificação (faltou nos mockups).** Ela entra logo depois de "Comer aqui / Levar" e antes das categorias, com o Bastião perguntando "Bah, e quem é tu, vivente?". São três abas: **Celular**, **CPF** e **Só meu nome**. O botão "Pular, só vim matar a fome" fica sempre visível, e quem pular informa só o nome no fechamento. No app, essa etapa é o login.

**Regras do totem**

- Se o cliente ficar 60 s parado, o totem pergunta "Ainda tá aí, tchê?". Sem resposta em 15 s, ele reinicia e apaga todos os dados digitados.
- Os dados pessoais nunca ficam na tela depois que o pedido termina. O totem não tem login nem senha: a identificação por celular ou CPF é opcional e serve só para o histórico, o Pila de Volta e a nota.
- Um item esgotado no ERP some do cardápio na hora. Se ele estava no "O de sempre", o totem avisa e sugere outro.
- O totem terá um modo de acessibilidade, com o conteúdo na metade de baixo da tela e fonte maior.

## Pedido híbrido: "Algum desses é pra levar?"

Num pedido "Comer aqui", o cliente pode marcar alguns itens para levar, sem falar com atendente. Exemplo: o pai come com o filho na loja e leva um xis para a esposa. Os itens de levar podem ser feitos na hora ou só na saída, para chegar quentinhos em casa.

1. Ao abrir a sacola de um pedido "Comer aqui" com 2 ou mais xis, aparece o card do Bastião: **"Tchê, me diz uma coisa: algum desses é pra levar pra casa?"**, com os botões "TEM SIM, VOU LANCHAR EM CASA" e "NÃO, VOU MATAR A BROCA AQUI MESMO".
2. Se o cliente responder que sim, cada item da sacola ganha uma chave **Aqui | Levar**, que começa em Aqui. Vale também para batata e bebida.
3. Para os itens de levar, o totem pergunta: **"Faço agora ou na tua saída?"**
   1. **Agora:** o item sai junto com o resto, já embalado.
   2. **Na saída:** o item fica em espera no KDS. O cliente libera pelo QR Code do ticket ou pelo app ("Tô saindo, pode fazer!") ou avisa no balcão. A cozinha prepara com prioridade.
4. Os itens de levar vão em embalagem com lacre e etiqueta: "LEVAR – Joaquim #042".
5. Continua sendo um pedido só, com um pagamento e uma NFC-e.

**No KDS:** o card se divide em dois blocos, AQUI (bandeja) e LEVAR (embalagem). Os itens "na saída" ficam cinza, com a etiqueta "aguardando liberação", até o cliente liberar. Se ninguém liberar em 45 min, o balcão recebe um alerta.

No app, a pergunta aparece do mesmo jeito em pedidos "Comer aqui". Em pedidos "Levar" e delivery, ela não aparece.

## Upsells e order bumps: o roteiro do Bastião

São cinco intervenções, todas com o mascote e a linguagem bacuda gaúcha do cardápio oficial. Elas seguem a ordem abaixo, aparecem no máximo uma vez por pedido e nunca colocam nada na sacola sem o cliente aceitar.

| # | Quando aparece | Fala do Bastião | Botão "sim" | Botão "não" |
| --- | --- | --- | --- | --- |
| 01 Refri | Escolheu um xis sem bebida | **BAH, TCHÊ!** Deixa de ser chinelão e mete uma refri aí nesse teu pedido! | BEM CAPAZ! COLOCA ESSE REFRI AÍ! | BAH, DESSA VEZ VOU CHINELIAR. |
| 04 Upgrade refri | Escolheu Coca-Cola 350 ml | **VAI ECONOMIZAR NA SEDE?** Troca tua Coca de 350 ml pela de 600 ml por mais R$ {dif} | BOTA A DE 600! | A DE 350 TÁ BUENO. |
| 02 Batata | Tem bebida, mas não tem batata | **BAH!** Vai te fazer com as batata agora? | BAITA IDEIA! BOTA UMA BATATA! | HOJE VOU PASSAR AS BATATA. |
| 03 Upgrade batata | Escolheu batata P ou M | P: **BAH, VAI DE MÉDIA!** · M: **BAH! VAI DE GRANDE?** Por mais R$ {dif}, aumenta tua batata! | BOTA A GRANDE! | DEIXA A MÉDIA MESMO. |
| 05 Pedido pequeno | Vai fechar com só 1 xis, sem nada junto | Bastião com a mão no rosto: **BAH, SÓ ISSO?** Pega teu lanche e te some daqui, vivente! | CALMA, BASTIÃO! VOU DAR UMA OLHADA. | HOJE É SÓ ISSO MESMO! |

**Regras**

- O valor `{dif}` é calculado na hora, pela diferença cadastrada no ERP. Se o preço não estiver cadastrado, a oferta não aparece. Nunca se mostra "R$ X".
- A oferta 04 não aparece se a bebida já for 600 ml ou 2 L. A 03 não aparece se a batata já for grande. A 05 não aparece se o pedido tiver um combo completo.
- Se o cliente recusar, o Bastião não insiste. O carrinho atualiza na hora, e cada oferta pode ser ligada ou desligada no ERP.
- O ERP registra impressões, aceites, recusas e o faturamento extra de cada oferta.
- No totem, as telas de oferta têm um X para fechar e contam como inatividade, com o mesmo timeout de 60 s.

**Ajustes em relação aos mockups**

- Falta a tela de identificação. Ela está descrita no Processo do Totem.
- Oferta 05: fica "BAH, SÓ ISSO? PEGA TEU LANCHE E TE SOME DAQUI, VIVENTE!", como no cardápio oficial. O "pelado" dos mockups não entra.
- O carrinho do totem não tem "Taxa de entrega", que só aparece no delivery do app.
- A frase "Tá me tirando pra mais ou menos?", que aparece embaixo dos botões, pode ficar como alívio cômico.

## Processo do App de celular

O app usa o mesmo cadastro do totem, com o celular como chave. Por isso, quem já pediu no totem abre o app com o histórico e o "O de sempre" prontos.

1. **Cadastro.** O app exige conta. Na primeira abertura, o cliente escolhe entre Criar conta e Entrar. O cadastro pede nome e celular; e-mail, CPF e aniversário são opcionais. O aceite dos termos é obrigatório, e o histórico e os avisos têm aceites separados. O login é pelo celular, com um código por WhatsApp ou SMS e sem senha, ou então com Google ou Apple. Em seguida, o app pede permissão de localização (ou o CEP) e indica o Bastião mais próximo, que o cliente pode trocar depois.
2. **Home.** O card **Pede o de sempre** fica no topo, seguido das promoções do app e do cardápio.
3. **Pedido.** O cardápio, a personalização e o upsell funcionam igual ao totem.
4. **Retirada.** O cliente escolhe "Comer aqui" ou "Levar" e o horário: "Agora" ou agendado, por exemplo 12:30.
5. **Pagamento.** O app aceita Pix ou cartão online, pelo gateway. A outra opção é "Pagar no balcão", no POS, e nesse caso o pedido só vai para a cozinha quando o cliente paga.
6. **Acompanhamento.** O app mostra o status em tempo real (Recebido → Em preparo → Pronto) e manda um push quando o pedido fica pronto.
7. **Histórico.** O cliente pode repetir qualquer pedido antigo com um toque.

**Decidido:** o app cobra online desde a fase 1, pelo gateway da mesma adquirente do POS do totem. Assim, os dois canais ficam numa conta só, com uma conciliação e um extrato. O pedido só entra na cozinha com o pagamento aprovado.

## Processo do Site de pedidos online

O site é o cardápio do Bastião no navegador, no estilo iFood, sem precisar instalar nada e sem comissão de marketplace. Ele usa o mesmo cadastro, cardápio, preços, ofertas e Pila de Volta do app, e os pedidos caem no mesmo ERP e KDS.

**Recomendação:** construir o app e o site como um produto só (app web instalável, ou PWA, mais as versões das lojas de aplicativo). Assim, cada tela é feita uma vez e funciona no celular, no computador e no app.

1. **Entrada.** O cliente chega pelo link do Instagram, do WhatsApp ou do Google ("Pedir online"), ou pelo QR Code na embalagem e na loja.
2. **Topo da loja (como no iFood).** O navegador pede a localização (ou o cliente digita o CEP) e o site escolhe o Bastião mais próximo. O topo mostra essa unidade, se está aberta ou fechada, o tempo estimado de entrega e de retirada, a taxa a partir do endereço, o pedido mínimo e a busca. Com a loja fechada, o cliente pode agendar o pedido para o próximo horário.
3. **Cardápio.** As categorias ficam fixas no topo enquanto rola a página, com os mesmos cards animados do totem e o Entreveiro em destaque. No computador, a sacola fica numa coluna lateral.
4. **Produto, personalização e ofertas do Bastião.** Funcionam como no totem e no app, com o mesmo roteiro de upsell.
5. **Entrega ou retirada.** No delivery, o cliente busca pelo CEP e o site calcula a faixa e a taxa. Na retirada, ele escolhe "Agora" ou um horário.
6. **Identificação no fechamento.** O cardápio é aberto a todos, mas para fechar o pedido o cliente precisa entrar ou criar uma conta (a mesma do app), com o celular e um código por WhatsApp ou SMS. Se já tiver cadastro, aparecem o "O de sempre", o endereço salvo e o saldo do Pila de Volta. O CPF na nota é opcional.
7. **Pagamento online.** Pix ou cartão pelo checkout do Mercado Pago. O pedido só vai para a cozinha com o pagamento aprovado.
8. **Acompanhamento.** Uma página mostra o status em tempo real (Recebido → Em preparo → Saiu pra entrega ou Pronto pra retirar). O cliente também recebe os avisos por WhatsApp ou SMS, se autorizar.

**Regras do site**

- **Aviso de hábito ("Tchê, não vai te alimentar?"):** no site, o aviso vai por WhatsApp ou SMS com um link que abre a sacola pronta, sempre com autorização do cliente. Notificação do navegador é pouco confiável no iPhone, então o push de verdade fica com o app.
- **SEO e compartilhamento:** páginas do cardápio indexáveis no Google, com foto e preço ao compartilhar no WhatsApp, e o link "Pedir online" no perfil do Google da loja.
- **Promoções exclusivas do canal próprio** (app e site), para tirar pedidos do iFood: por exemplo, cashback maior ou frete grátis numa faixa. Os valores são configurados no ERP.
- **Pausa do delivery:** se a cozinha lotar, o ERP pausa o delivery no site, no app e no iFood ao mesmo tempo.

## Pagamento via POS

O totem conversa direto com a maquininha (POS integrado ou TEF). A regra de ouro: o pedido só vira ticket e entra na cozinha quando o pagamento estiver **Aprovado**.

- **Pix:** um QR Code dinâmico do Mercado Pago aparece na tela do totem. A confirmação chega automática, sem o cliente mostrar comprovante. Sugestão: o QR expira em 3 minutos.
- **Crédito e débito:** o totem manda o valor para o POS e o cliente aproxima ou insere o cartão. Parcelamento não entra.

| Estado | O que o cliente vê | O que o sistema faz |
| --- | --- | --- |
| Aguardando | "Aproxime o cartão" ou o QR Pix | Envia o valor ao POS e reserva o pedido |
| Aprovado | "Pago! Sua senha é 042" | Emite a NFC-e (com CPF, se informado), imprime o ticket e manda para a cozinha |
| Recusado | "Não passou, tchê. Tenta outra forma?" | Volta para a escolha do método e mantém a sacola |
| Tempo esgotado | "O pagamento expirou" | Cancela a cobrança pendente e oferece tentar de novo |
| Cancelado pelo cliente | Volta para a sacola | Cancela no POS e não gera pedido |

**Regras**

- Estornos só acontecem no ERP, por um gerente, e ficam registrados com o motivo.
- No fechamento do caixa, o ERP confere as vendas com o extrato da adquirente.
- Se o POS cair, o totem mostra "Pagamento só no balcão" e o pedido fica pendente até o caixa receber.

**Adquirente: Mercado Pago (decidido)**

A escolha foi pelo Mercado Pago, que é mais fácil de implementar. O totem e o app usam a mesma conta:

- **Cartão no totem:** uma Point Smart em modo autoatendimento (SELF\_SERVICE) fica ao lado do totem. O pedido é criado pela Orders API e o resultado volta por notificação.
- **Pix no totem:** o QR Code dinâmico do Mercado Pago aparece na tela do totem, porque a Point Smart só aceita cartão e aproximação. A confirmação também chega por notificação.
- **App:** o checkout do Mercado Pago cobra Pix e cartão online.
- **Integração:** já começar pela Orders API, que está substituindo a API antiga da Point.

A comparação abaixo fica de registro.

|  | Stone (Connect + Pagar.me) | Mercado Pago (Point + Orders API) |
| --- | --- | --- |
| Totem → maquininha | O pedido é criado pela API, a maquininha cobra e o resultado volta em tempo real por webhook ([doc](https://connect-stone.stone.com.br/reference)) | Tem um modo de autoatendimento (SELF\_SERVICE) feito para totem ([doc](https://www.mercadopago.com.ar/developers/pt/docs/mp-point-v2/overview)) |
| Pix na maquininha | Sim, com Conta Stone e Pix habilitado ([FAQ](https://connect-stone.stone.com.br/page/faq)) | Na Point Smart, só cartão e aproximação ([doc](https://mercadopago.com.br/developers/pt/docs/mp-point/integration-configuration/integrate-with-pdv/introduction)). O Pix sai por QR Code na tela do totem |
| App (online) | Gateway Pagar.me, na mesma conta | Checkout do Mercado Pago, na mesma conta |
| Estorno | Pela maquininha ou pelo portal, sem rota de API | Pelo painel ou pela API |
| Ponto de atenção | O Connect não tem ambiente de teste. A homologação é feita com o gerente de conta | A API antiga da Point está sendo trocada pela Orders API, então já é bom começar pela nova |

## Pipeline da cozinha (KDS)

A cozinha trabalha numa tela em colunas, no estilo kanban. Cada pedido pago vira um card que anda da esquerda para a direita com um toque ou com a bump bar.

1. **Novo.** O card entra com um alerta sonoro. A ordem é por hora de pagamento, e os pedidos agendados do app entram antes, de acordo com o tempo de preparo.
2. **Em preparo.** A chapa pega o xis e a fritura pega a batata. Cada estação vê só os itens dela.
3. **Montagem e embalagem.** O pedido é montado em bandeja (comer aqui) ou em embalagem (levar).
4. **Pronto.** O nome e a senha aparecem no painel de chamada (TV). Se o pedido veio do app, o cliente recebe um push "Teu xis tá pronto!".
5. **Entregue.** O balcão confirma a entrega e o card sai da tela.

**O que o card mostra:** senha, nome, canal (Totem ou App), Comer aqui ou Levar, os itens e o tempo desde o pagamento. As modificações ("SEM cebola", "+ bacon") aparecem em destaque.

**Metas definidas**

| Indicador | Meta ideal | Limite máximo |
| --- | --- | --- |
| Tempo de preparo (do pagamento ao Pronto) | 8 a 12 min | 15 min |
| Comandas visíveis por tela (chapa) | 6 a 8 | 10 |
| Disparo da fritura | 5 min depois que o xis entra em preparo | Ajustar conforme a fritadeira |

**Cores do card:** verde até 8 min, amarelo de 8 a 12 min, laranja de 12 a 15 min e vermelho acima de 15 min, com alerta para o gerente.

**As duas telas da cozinha**

- **Tela 1, Chapa:** mostra só os xis, com as modificações em destaque. Exibe até 8 comandas. Da 9ª à 10ª, os cards ficam compactos. Acima de 10, a tela mostra "+N na fila" e alerta o gerente, sem esconder pedido atrasado.
- **Tela 2, Fritura e expedição:** a batata aparece aqui só 5 min depois que o xis do mesmo pedido entrou em preparo, para os dois ficarem prontos juntos. Batata avulsa, sem xis, entra na hora. Esta tela também faz a montagem (bandeja ou embalagem) e marca o pedido como Pronto.
- Pedidos do iFood e do delivery próprio entram na mesma fila, com uma etiqueta de canal e o horário da coleta.

Os tempos e limites ficam no ERP e podem ser ajustados. Cancelar um pedido que já está em preparo exige senha de gerente.

## ERP

O ERP é a fonte única da verdade. Cardápio, preços, estoque e clientes moram nele, e o totem, o app e o KDS só consomem esses dados.

| Módulo | O que faz | Quem usa |
| --- | --- | --- |
| Cardápio e preços | Cadastra produtos, combos, adicionais, fotos e horários, e publica tudo no totem e no app | Gerente |
| Estoque e ficha técnica | Dá baixa nos insumos a cada item vendido, alerta o mínimo e marca o item como esgotado | Gerente, cozinha |
| Pedidos e caixa | Faz abertura e fechamento, sangria, estornos e conferência com a adquirente | Caixa, gerente |
| Fiscal | Emite a NFC-e com CPF na nota | Automático, com o contador |
| Clientes (CRM) | Guarda cadastro, histórico, consentimentos, "O de sempre" e hábitos | Automático, gerente |
| Campanhas e push | Cuida das regras de inteligência, dos textos, dos limites de envio e das métricas | Gerente, marketing |
| Relatórios | Mostra vendas por hora e por canal, ticket médio, tempo de preparo e itens mais vendidos | Dono, gerente |
| Usuários e dispositivos | Controla perfis (caixa, cozinha, gerente) e o status online dos totens, POS e telas | Gerente |

O ERP também tem um módulo **Financeiro**: DRE gerencial por unidade e canal, CMV teórico × real, markup e preço sugerido, margem de contribuição, curvas ABC de produtos e de insumos, engenharia de cardápio, contas a pagar e a receber, fluxo de caixa e conciliação com o Mercado Pago e o iFood. O cardápio (textos, fotos, vídeos, preços e disponibilidade) é todo gerido pelo painel web do ERP e publicado nos canais com um clique. Os detalhes estão no documento [Etapa 3: Arquitetura e Fornecedores](https://claude.ai/artifact/QoVnMT1mVnFvjrL4Xq1LPg).

**Regras de negócio**

- O preço é o mesmo no totem, no app e no balcão. O iFood pode ter tabela própria, por causa da comissão. Promoções exclusivas do app ficam marcadas como "só no app".
- Mudou no ERP, aparece no totem, no app e no site em até 1 minuto. Cada unidade tem seu endereço, área de entrega, horário, cardápio e preços, e os pedidos vão para o KDS da unidade escolhida.
- Toda ação sensível (estorno, cancelamento, mudança de preço) registra quem fez e quando.

## Delivery: iFood e próprio

O delivery começa na fase inicial por dois caminhos. Os dois caem direto no ERP e no KDS, sem ninguém redigitar pedido.

- **iFood:** a integração é pela [Merchant API](https://developer.ifood.com.br/pt-BR/docs/guides/), que recebe, confirma e acompanha os pedidos (módulos Order e Events). O cardápio do iFood é alimentado pelo ERP, com preço e disponibilidade por canal. Para homologar é preciso uma conta com CNPJ ([guia](https://developer.ifood.com.br/en-US/docs/guides/getting-started)).
- **Delivery próprio (app e site):** o cliente informa o endereço e o app calcula a taxa por bairro ou raio (configurável no ERP) e mostra o tempo estimado. O status ganha a etapa "Saiu pra entrega". Na entrega, dá para usar entregador próprio ou chamar entregadores do iFood pelo Sob Demanda (módulo Shipping), que serve para pedidos captados fora do iFood.
- **Regras:** cada produto tem disponibilidade por canal (loja, retirada e delivery). Pedidos de delivery pulam a pergunta "Algum desses é pra levar?" e sempre saem embalados.

**Delivery próprio: valores de exemplo, para desenhar o processo (não são os definitivos)**

| Faixa a partir da loja | Taxa (exemplo) | Tempo estimado (exemplo) |
| --- | --- | --- |
| Até 2 km | R$ 5,00 | 30 a 40 min |
| De 2 a 4 km | R$ 8,00 | 35 a 45 min |
| De 4 a 6 km | R$ 11,00 | 40 a 55 min |
| Acima de 6 km | Não atende ("Bah, aí é longe, tchê!") | — |

- **Pedido mínimo (exemplo):** R$ 30,00, sem contar a taxa.
- **Entrega:** entregador próprio por padrão. Se houver mais de 3 pedidos esperando entregador, o ERP sugere chamar o iFood Sob Demanda.
- **No ERP:** as faixas, as taxas, o pedido mínimo e o horário do delivery são configuráveis. O delivery pode ser pausado com um clique ("cozinha lotada").
- **Endereço:** o cliente busca pelo CEP, o endereço fica salvo no cadastro e o app calcula a faixa pela distância até a loja.

## Fidelidade: cashback "Pila de Volta"

Recomendo cashback em vez de pontos. O cliente entende na hora ("voltou R$ 3,20 pra ti") e o saldo vira um gancho natural para o push. O nome sugerido é **Pila de Volta**.

- Uma porcentagem de cada pedido pago volta como saldo. A porcentagem, a validade e o resgate mínimo são configuráveis no ERP.
- O saldo é creditado quando o pedido fica Pronto ou Entregue e cai se o pedido for estornado.
- Vale no totem (identificado por celular ou CPF) e no app. Pedidos do iFood não geram cashback.
- O cliente usa o saldo como desconto no fechamento ("Usar R$ 6,40 de Pila de Volta?"). O desconto sai na NFC-e, e o tratamento fiscal precisa ser validado com o contador.
- Push de saldo vencendo: "Tchê, teus R$ 6,40 de Pila de Volta vencem domingo!"

## Fiscal: NFC-e com emissor próprio

O próprio sistema vai emitir a NFC-e. Para isso, a empresa precisa de quatro coisas antes de vender: inscrição estadual ativa, certificado digital e-CNPJ (o A1 é o recomendado para automação), o CSC gerado na SEFAZ-RS (menu "Manutenção de CSC") e um emissor que gere o XML, assine, transmita e monte o QR Code ([requisitos](https://universidade.teknisa.com/wp-content/uploads/2026/07/RETAIL_ALTERACAO_SAT_PARA_NFCE_RETALTSATNFCE01_2-1.pdf), [CSC no RS](https://ajuda.alterdata.com.br/shopbase/como-gerar-codigo-csc-token-por-estado-86698373.html)).

- **Contador é indispensável, mesmo com emissor próprio.** É ele quem define o regime tributário e a tributação de cada produto (NCM, CFOP, CST ou CSOSN). Sem isso, a nota sai errada ou é rejeitada. O contador já está contratado e valida a tributação de cada item antes da homologação.
- **Credenciamento no RS:** as fontes divergem. Algumas dizem que precisa de credenciamento prévio, outras que quem já emite NF-e está habilitado. É bom confirmar com a SEFAZ-RS ou com o contador.
- **Contingência:** se a SEFAZ ou a internet cair, o sistema emite em contingência offline e transmite depois. O pedido nunca para por causa da nota.
- **Opção para reduzir risco:** manter o sistema próprio, mas usar uma API de emissão terceirizada para a comunicação com a SEFAZ, em vez de implementar os webservices do zero.

## Inteligência de pedidos e push

O sistema descobre o hábito de cada cliente (dia da semana + horário) e o pedido favorito desse hábito. Dez minutos antes do horário de costume, manda o push "Tchê, não vai te alimentar? Tá na hora." Quem toca no push abre o app com a sacola pronta para pagar ou editar.

**Como o hábito é detectado (regra inicial)**

- O cliente pediu no **mesmo dia da semana**, numa **janela de ±30 min**, em pelo menos **3 das últimas 6 semanas**.
- O horário do hábito é a mediana dos horários desses pedidos, por exemplo 12:30.
- O pedido favorito é a combinação de itens e modificações que mais se repete **dentro desse hábito**, e não o item mais pedido no geral.
- A regra é recalculada toda noite. Se o cliente parar de pedir, o hábito expira sozinho.

**Exemplo: Joaquim, toda quarta às 12:30**

1. O histórico mostra 5 quartas seguidas entre 12:22 e 12:41, sempre com o Combo Xis Salada + Coca Lata, SEM tomate.
2. O sistema agenda o push para quarta, 12:20 (12:30 menos 10 min).
3. Às 12:20, ele confere as condições: loja aberta, Joaquim ainda não pediu hoje, itens disponíveis e push autorizado. Se alguma falhar, não envia.
4. O push chega: **"Tchê, não vai te alimentar? Tá na hora."**
5. Joaquim toca e o app abre direto na sacola com o Combo Xis Salada (SEM tomate) + Coca Lata, o total e a retirada sugerida para as 12:30.
6. Ele toca em **Pagar** ou em **Editar pedido** para trocar itens, tamanho, retirada ou local/levar.
7. O pedido entra na cozinha no horário certo para ficar pronto às 12:30.

**Limites para não virar chato**

- No máximo 1 push de hábito por dia e 3 por semana, por cliente.
- Se o cliente ignorar 3 pushes seguidos, a frequência cai pela metade. Se ignorar 6, para e só volta quando ele pedir de novo.
- Nada é enviado em feriados nem com a loja fechada, e a mensagem respeita a escolha de push do cliente.

**Textos sugeridos (eles mudam, para não cansar)**

- "Tchê, não vai te alimentar? Tá na hora."
- "Bah, {Nome}! Quarta sem xis não é quarta."
- "O de sempre tá te esperando, vivente. É só um toque."

**No totem:** não tem push. Quando o cliente se identifica, o card "O de sempre?" aparece no topo, com o favorito do dia e do horário.

**Métricas no ERP:** taxa de abertura do push, conversão de push em pedido, edições na sacola sugerida e descadastros.

## Cardápio oficial v1.0

O catálogo segue o Cardápio Digital Oficial v1.0: 9 categorias, 20 xis, 7 combos, batatas, bebidas da linha Coca-Cola, sucos e adicionais. **Nenhum preço é inventado.** Todo valor vem do ERP, e um produto sem preço não aparece para o cliente.

Todo xis parte da mesma composição-base: pão de xis, maionese, bife bovino, queijo, ovo, milho, ervilha, tomate e alface. Tirar ingrediente não dá desconto. Colocar adicional cobra o valor cadastrado.

| Categoria | Produtos | Observações |
| --- | --- | --- |
| Xis Tradicionais | Salada (o de bife bovino), Calabresa, Frango, Lombo, Coração, Bacon | Tamanhos Tradicional e Piá |
| Xis Acebolados | Carne Acebolada, Calabresa Acebolada, Bacon Acebolado | A cebola é um ingrediente próprio, com ficha técnica |
| Xis Mix | Carne + Bacon, Calabresa + Bacon, Lombo + Bacon, **Entreveiro** ("A cambada toda dentro de um xis!") | Ficha própria, com as proteínas divididas. O Entreveiro é o produto assinatura, com destaque visual e foto exclusiva |
| Xis Especiais | Xis Entrecot, Xis Picanha, Xis Filé | Carnes premium, que substituem o bife da composição-base |
| Xis Piá | Piá Salada, Piá Carne, Piá Calabresa, Piá Frango | "Esse é para o teu guri!" Outros sabores podem ser habilitados no ERP |
| Batatas | Pequena, Média, Grande | Cheddar, bacon e Batata Bastião só depois de ter ficha técnica |
| Bebidas | Refrigerantes da linha Coca-Cola (Coca-Cola, Fanta, Sprite e Schweppes), Guaraná Antarctica, todos em versão normal e zero; água com e sem gás; suco de laranja e de maracujá | Cada marca e volume é um SKU. Normal ou zero é uma variação. Cerveja e post-mix estão em avaliação |
| Adicionais | Bacon, bife, calabresa, frango, lombo, coração, queijo, ovo, cebola acebolada, maionese, molho da casa | Cada um com preço, quantidade mínima e máxima e limite de estoque |

| Combo | Itens | Chamada |
| --- | --- | --- |
| Combo Piá | Xis Piá + batata P + Coca 350 ml ou suco | Esse é para o teu guri! |
| Combo Bagual | Xis Tradicional + batata P + Coca 350 ml | Pra matar a fome sem frescura! |
| Combo Bastião | Xis Tradicional + batata M + Coca 600 ml | Um baita xis. Um baita combo! |
| Combo Sem Frescura | Xis Tradicional ou Especial + batata G + Coca 600 ml + maionese especial | Aqui o papo é recheio! |
| Combo de Dois | 2 Xis Tradicionais + batata G + Coca 2 L | Pra dividir. Se quiser. |
| A Cambada | 3 Xis Tradicionais + 2 batatas G + Coca 2 L | Chama a cambada que o Bastião resolve! |
| Baita Família | 4 Xis Tradicionais + 2 batatas G + Coca 2 L | Pra ninguém sair passando vontade! |

**Regras de combo:** o cliente pode escolher sabores diferentes dentro do mesmo combo, e o sistema cobra a diferença de preço entre eles. Não se cadastra um combo para cada combinação. O desconto do combo respeita a margem mínima definida no ERP.

**Imagens animadas dos produtos (especificação para a produção)**

Todos os itens aparecem animados no totem e no app. O protótipo simula o efeito com desenhos, mas na produção cada produto vai ganhar um vídeo curto em loop, filmado ou renderizado em 3D.

| Produto | O que o vídeo mostra | Formato |
| --- | --- | --- |
| Xis (todos) | Cortado ao meio mostrando o recheio, com vapor subindo e meio giro (mais ou menos 180°) | Loop de 4 a 6 s, fundo transparente |
| Bebidas | Suando, com gotas escorrendo e fumaça gelada em volta | Loop de 4 a 6 s, fundo transparente |
| Batatas | Embalagem do Bastião com vapor subindo | Loop de 4 a 6 s, fundo transparente |
| Combos | Os itens juntos, com o mesmo efeito de cada um | Loop de 4 a 6 s |

- **Arquivos:** WebM com transparência e um MP4 de reserva, com até 1,5 MB cada, mais uma imagem PNG estática para quando a animação estiver desligada.
- **Padrão de captura:** mesma luz, mesmo ângulo (levemente de cima) e mesmo prato giratório para todos os produtos, para o cardápio ficar uniforme.
- **No ERP:** cada produto tem um campo para o vídeo e outro para a imagem estática.
- **Desempenho:** no cardápio, só os itens visíveis na tela ficam animados.

## LGPD e consentimento

Celular, CPF e histórico são dados pessoais. Por isso, o cliente dá três aceites separados, e cada um pode ser revogado no app ou no balcão.

- **CPF na nota:** serve só para a NFC-e e não depende de aceite de marketing.
- **Histórico e sugestões:** libera o "O de sempre" e a detecção de hábitos.
- **Push e ofertas:** libera os pushes de hábito e as promoções.

No totem, o CPF aparece mascarado (\*\*\*.456.789-\*\*) e um aviso curto leva à política de privacidade. O cliente pode pedir a exclusão dos dados pelo app. Vale validar os textos com um advogado antes de lançar.

## Roadmap por etapas

A ordem vai do núcleo para as pontas. Primeiro vem o ERP com o cardápio e o KDS, porque o totem e o app dependem deles. A inteligência fica por último, porque precisa de histórico real.

1. **Processos** (este documento): validar e fechar as decisões abaixo.
2. **Design**: identidade visual a partir do logo, guia de componentes e protótipos do totem, do app e do KDS.
3. **Arquitetura e fornecedores**: POS/TEF, NFC-e, serviço de push, hospedagem e banco de dados.
4. **ERP núcleo + KDS**: cardápio, pedidos, caixa, NFC-e, as duas telas da cozinha e a integração com o iFood.
5. **Totem + POS**: o fluxo completo de autoatendimento, com pagamento.
6. **App de celular**: cadastro, pedido, pagamento online, acompanhamento e delivery próprio, no app e no site de pedidos online (mesma base, no estilo iFood).
7. **Inteligência e push**: hábitos, "O de sempre", a campanha do "Tchê" e o cashback Pila de Volta.
8. **Piloto na loja**: rodar, medir e ajustar.

**Decisões tomadas**

| Tema | Decisão |
| --- | --- |
| Equipamentos | 1 totem e 2 telas na cozinha (Chapa; Fritura e expedição) |
| Pagamento no app | Online desde a fase 1. Adquirente: Mercado Pago (Point Smart no totem e checkout no app) |
| Delivery | iFood (integrado) e próprio, já na fase inicial |
| Fidelidade | Pontos ou cashback. A recomendação é o cashback Pila de Volta |
| Cardápio | Cardápio Digital Oficial v1.0, com preços só pelo ERP. Especiais: Entrecot, Picanha e Filé. O Entreveiro fica no Mix |
| NFC-e | Emissor próprio |
| KDS | Preparo de 8 a 12 min (máx. 15), 6 a 8 comandas por tela (máx. 10), fritura 5 min depois do xis |
| Diferencial | Pedido híbrido "Algum desses é pra levar?" |

**Decisões pendentes**

- [x] Oferta 05 (pedido pequeno): "vivente" (cardápio) ou "pelado" (mockups)?
- [ ] Preencher preços, fotos e fichas técnicas na aba Preços e fichas
- [ ] Delivery próprio: trocar os valores de exemplo pelos definitivos
- [ ] Confirmar com o contador o credenciamento da NFC-e na SEFAZ-RS
- [ ] Definir o domínio do site de pedidos online (ex.: pedir.bastiao.com.br)
