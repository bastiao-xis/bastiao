# Bastião · Etapa 3: Arquitetura e Fornecedores

Nov 7, 2026 · @Rafael

> **Atualizado pela [Versão Mestre da Arquitetura](https://claude.ai/artifact/W39S4h6a9wBWfdSkd2Wyxn).** Em caso de conflito, vale a Versão Mestre. Correções principais: a loja fica em SC, então a NFC-e sai por um emissor credenciado na SEF/SC (e não por emissor próprio nem pela SEFAZ-RS); o Mercado Pago depende de prova técnica do totem; e entram a Fase 0 de credenciamentos, os status separados de pedido e pagamento e o módulo de entregadores.

## Resumo

O Bastião vai rodar sobre **uma API central (o ERP)** com um banco de dados só. Totem, app, site, cozinha e painel são telas que conversam com essa API. Tudo fica num repositório único em TypeScript, para o Claude Code construir e manter módulo por módulo. Para os serviços críticos e regulados (pagamento, nota fiscal, entrega de mensagens), a recomendação é usar fornecedores especializados por API, em vez de reinventar.

| Tema | Decisão recomendada |
| --- | --- |
| Organização do código | Repositório único (monorepo) em TypeScript, com o código de regras compartilhado entre todos os canais |
| Backend (ERP e API) | Node.js com NestJS, PostgreSQL e Redis para filas e tempo real |
| Totem, KDS e painel | Aplicações web rodando em tela cheia (modo quiosque), atualizadas sem reinstalar |
| App de celular | React Native com Expo, publicado na App Store e no Google Play |
| Site de pedidos | Next.js, otimizado para o Google, com as mesmas regras e a mesma conta do app |
| Pagamentos | Mercado Pago: Point Smart no totem (Orders API) e checkout no app e no site |
| NFC-e | O sistema próprio monta a nota e envia por uma API de emissão, que fala com a SEFAZ-RS |
| Avisos | Push pelo Firebase (FCM) e WhatsApp e SMS por provedor oficial |
| Hospedagem | Nuvem com região em São Paulo, com banco gerenciado e backup diário |
| Lojas | Multiunidade desde o início: cada unidade com cardápio, preços, horário, área de entrega, KDS e DRE próprios |

## Visão da arquitetura

Só a API fala com o banco de dados e com os serviços externos. Os canais e a cozinha só conversam com a API, por isso uma regra mudada no ERP vale para todo mundo ao mesmo tempo.

&#91;embedded content: arquitetura do Bastião · canais, API, dados, cozinha e serviços externos\]

A cozinha e o painel recebem os pedidos ao vivo por WebSocket. Pagamento, NFC-e e mensagens passam por filas, então uma queda de um fornecedor não derruba a loja.

## Tecnologias recomendadas

A escolha prioriza uma linguagem só (TypeScript) de ponta a ponta. Assim, a mesma regra, como o cálculo de combo, de upsell ou de cashback, vale no totem, no app, no site e no ERP sem ser reescrita. São tecnologias maduras, com muita gente no mercado para manter o sistema e que o Claude Code domina bem.

| Camada | Tecnologia | Por quê |
| --- | --- | --- |
| Linguagem | TypeScript em tudo | Uma linguagem só e tipos compartilhados entre o backend e as telas |
| Monorepo | pnpm + Turborepo | Um repositório com pacotes compartilhados: regras, cliente da API e identidade visual |
| API e ERP | NestJS (Node.js) | Módulos organizados, filas, WebSocket e documentação automática da API |
| Banco de dados | PostgreSQL + Prisma | Relacional, ideal para pedidos, estoque e fiscal, com migrações versionadas |
| Filas e tempo real | Redis + BullMQ + Socket.IO | Agenda os avisos de hábito, reprocessa notas e integrações, e atualiza a cozinha ao vivo |
| Painel do ERP | Next.js (React) | Telas administrativas no navegador, sem instalar nada |
| Site de pedidos | Next.js (React) | Páginas rápidas e indexáveis no Google, com link compartilhável no WhatsApp |
| App de celular | React Native + Expo | Um código para iPhone e Android, com push nativo e atualização rápida |
| Totem, KDS e painel | React (Vite), em modo quiosque | Atualiza pela internet, funciona em qualquer tela touch ou TV e guarda o cardápio para quedas de rede |
| Agente local do totem | Pequeno programa Node.js | Imprime o ticket na térmica e informa ao ERP se o totem está vivo |
| Hospedagem | Nuvem com região em São Paulo (AWS ou Google Cloud) | Baixa latência e dados no Brasil, com banco gerenciado e backup |
| Monitoramento | Sentry + alertas de disponibilidade | Avisa de erro antes de o cliente reclamar |

O cardápio animado (os vídeos dos produtos) fica num armazenamento de arquivos com CDN, para carregar rápido no totem e no celular.

## Módulos do backend

O backend é um único serviço, dividido em módulos com fronteiras claras. Isso é mais simples de operar no início do que vários microsserviços, e dá para separar algum módulo no futuro se ele crescer.

| Módulo | Responsabilidade |
| --- | --- |
| Unidades | Lojas, endereço, horário, área e faixas de entrega, dispositivos de cada loja |
| Cardápio | Produtos, tamanhos, ingredientes removíveis, adicionais, combos e disponibilidade por canal e unidade |
| Preços | Tabela por unidade e por canal (iFood pode ser diferente), upgrades, margem mínima dos combos |
| Estoque e ficha técnica | Baixa dos insumos por item vendido, alerta de mínimo, item esgotado automático |
| Clientes e contas | Cadastro, login por código (WhatsApp ou SMS), Google e Apple, endereços, consentimentos LGPD |
| Pedidos | Sacola, cálculo de preço, pedido híbrido (aqui e levar), estados do pedido, cancelamento |
| Pagamentos | Mercado Pago: Point no totem, Pix e cartão no app e no site, estornos e conciliação |
| Fiscal | Montagem e envio da NFC-e, contingência, cancelamento, guarda dos XML |
| Cozinha (KDS) | Fila por estação, tempos e cores, disparo atrasado da fritura, liberação do "levar na saída", painel de chamada |
| Ofertas | Roteiro de upsell do Bastião, regras de exibição, registro de impressões e aceites |
| Inteligência | Cálculo noturno de hábitos e do "o de sempre", agendamento e envio dos avisos, limites de frequência |
| Fidelidade | Pila de Volta: crédito, uso, validade, extrato |
| Delivery | Faixas e taxas, pausa do delivery, iFood (Merchant API) e iFood Sob Demanda |
| Notificações | Push (FCM), WhatsApp, SMS e e-mail, com modelos de mensagem e preferências do cliente |
| Relatórios | Vendas por hora, canal e unidade, ticket médio, tempo de preparo, desempenho das ofertas e dos avisos. O módulo Financeiro cuida de DRE gerencial, CMV, markup, margem, curvas ABC, engenharia de cardápio, contas a pagar e a receber, fluxo de caixa e conciliação |
| Usuários e auditoria | Perfis (caixa, cozinha, gerente, dono), registro de quem fez o quê e quando |

## Gestão do cardápio no painel do ERP

Todo o conteúdo dos lanches é cadastrado uma vez só, no painel web do ERP, e publicado de lá para o totem, o app, o site e o iFood. Ninguém precisa mexer em código nem publicar o app de novo para trocar uma foto, um preço ou uma descrição.

1. **Cadastro do produto.** Nome, categoria, descrição curta e longa, chamada comercial (por exemplo, "Tu dá conta desse Entreveiro?"), tamanhos, ingredientes que dão para tirar, adicionais permitidos e informações de alérgenos.
2. **Ficha técnica.** Insumos e gramagens de cada tamanho. O sistema calcula o custo na hora e sugere o preço pelo markup (veja a seção de gestão financeira).
3. **Mídia.** Upload da foto estática e do vídeo animado (o xis girando com vapor, a bebida suando). O sistema confere o formato e o tamanho, gera versões leves e publica numa CDN.
4. **Preço e disponibilidade.** Preço por unidade e por canal (o iFood pode ter tabela própria), horários de venda e em que canais o item aparece.
5. **Pré-visualização.** Antes de publicar, o gerente vê como o item fica no totem, no app e no site.
6. **Publicação.** Um clique publica em todos os canais em até 1 minuto. No iFood, o cardápio é enviado pela API de catálogo. Toda versão fica no histórico e dá para desfazer.

**Regras:** um item sem preço, sem foto ou sem ficha técnica fica como rascunho e não aparece para o cliente. Alterar preço exige perfil de gerente e fica na auditoria. Itens esgotados saem dos canais sozinhos, a partir do estoque ou de um botão rápido no balcão.

## Gestão financeira e indicadores

O ERP também vai ter um módulo **Financeiro**, para mostrar se cada xis, cada canal e cada unidade dá lucro. Os números saem sozinhos das vendas, das fichas técnicas, das taxas do Mercado Pago e do iFood e das contas lançadas. É uma visão gerencial: a contabilidade oficial continua com o contador, que recebe as exportações.

| Recurso | O que mostra | De onde vêm os dados |
| --- | --- | --- |
| DRE gerencial | Receita, impostos, CMV, taxas e comissões, despesas fixas e resultado, por mês, unidade e canal | Vendas, NFC-e, fichas técnicas, Mercado Pago, iFood e contas a pagar |
| CMV teórico × real | Quanto deveria ter custado, pela ficha técnica, × o que custou de fato, pelo inventário. A diferença aponta desperdício ou desvio | Fichas técnicas, compras e contagem de estoque |
| Markup e precificação | Preço sugerido de cada item a partir do custo e da margem desejada, e alerta quando o preço atual fica abaixo do mínimo | Ficha técnica e percentuais configurados |
| Margem de contribuição | Quanto cada produto deixa depois de custo, imposto, taxa do cartão e comissão do iFood, por canal | Vendas, taxas e fichas técnicas |
| Curva ABC de produtos | Os itens que fazem 80% do faturamento (A), os intermediários (B) e a cauda (C), por faturamento e por margem | Vendas do período |
| Curva ABC de insumos | Os insumos que mais pesam no custo, para negociar com fornecedores e controlar o estoque | Compras e fichas técnicas |
| Engenharia de cardápio | Cada item numa matriz de popularidade × margem: estrela (manter e destacar), burro de carga (rever custo), quebra-cabeça (promover) e cão (repensar ou tirar) | Vendas e margem de contribuição |
| Contas a pagar e a receber | Fornecedores, aluguel, folha, impostos e repasses a receber do Mercado Pago e do iFood | Lançamentos e extratos |
| Fluxo de caixa | Saldo previsto por dia e por semana, incluindo os prazos de recebimento do cartão | Contas e repasses |
| Conciliação | Cada venda casada com o repasse do Mercado Pago ou do iFood, com as diferenças apontadas | APIs do Mercado Pago e do iFood |
| Ponto de equilíbrio | Quantos xis por dia pagam as despesas fixas do mês | DRE e margem média |
| Painel do dono | Faturamento do dia, ticket médio, vendas por canal e por hora, desempenho das ofertas do Bastião e dos avisos de hábito | Tudo acima |

**Cálculo do preço pelo markup divisor.** Os percentuais são configuráveis por canal, porque o iFood cobra comissão e o canal próprio não:

```latex
\text{Preço sugerido} = \frac{\text{Custo da ficha técnica}}{1 - (\%\,\text{impostos} + \%\,\text{taxas e comissões} + \%\,\text{despesas fixas} + \%\,\text{margem desejada})}
```

O regime tributário, que define o percentual de impostos, e a classificação das contas no DRE devem ser validados com o contador.

## Modelo de dados

As entidades seguem o catálogo do cardápio oficial: o produto é cadastrado uma vez, e as combinações de combo são regras, não produtos duplicados. O estoque é um só por insumo, consumido pela ficha técnica.

| Grupo | Entidades | Observações |
| --- | --- | --- |
| Lojas | Unidade, FaixaEntrega, Horário, Dispositivo | Dispositivo = totem, POS, tela do KDS ou TV do painel, cada um com status online |
| Cardápio | Categoria, Produto, Tamanho, Ingrediente, Receita (ficha técnica), Adicional | Um produto sem preço cadastrado não aparece para o cliente |
| Combos | Combo, GrupoDeEscolha, Opção | Ex.: "1 xis tradicional à escolha"; a diferença de preço é calculada na hora |
| Preços | TabelaPreço (unidade × canal), Upgrade | Canais: totem, app, site, iFood |
| Estoque | Insumo, Movimento, Fornecedor | Baixa automática a cada item pago |
| Clientes | Cliente, Consentimento, Endereço, Dispositivo do cliente (token de push) | CPF e celular guardados com criptografia |
| Pedidos | Pedido, ItemPedido, Modificação, Evento do pedido | Cada item tem modo AQUI ou LEVAR, e o LEVAR pode ser "agora" ou "na saída" |
| Pagamentos | Pagamento, Estorno | Guarda o ID da transação do Mercado Pago para a conciliação |
| Fiscal | NotaFiscal | Status, chave, XML e contingência |
| Cozinha | Comanda, Estação, EventoKDS | Tempos de cada etapa para os relatórios |
| Inteligência | Hábito, AvisoAgendado, AvisoEnviado | Dia, janela de horário, pedido favorito, resultado do aviso |
| Fidelidade | Carteira, Lançamento | Crédito, uso, validade e estorno |
| Ofertas | Oferta, Exibição | Mostrou, aceitou, recusou e quanto faturou |
| Acesso | Usuário, Perfil, Auditoria | Quem estornou, cancelou ou mudou um preço |

## Caminho de um pedido

Todo pedido segue o mesmo caminho, qualquer que seja o canal. Ele só chega à cozinha com o pagamento aprovado, e a nota nunca trava a venda. O exemplo abaixo é um pedido no totem.

1. **Monta a sacola.** O totem calcula o preço com as regras compartilhadas, mas o ERP recalcula tudo no servidor. Preço vindo da tela nunca é confiável.
2. **Cria o pedido.** O ERP grava o pedido como "aguardando pagamento" e reserva o estoque.
3. **Cobra.** No cartão, o ERP cria uma ordem na Orders API do Mercado Pago, endereçada à Point Smart ao lado do totem. No Pix, gera um QR Code dinâmico que aparece na tela.
4. **Confirma pelo webhook.** O Mercado Pago avisa o ERP que o pagamento foi aprovado. O ERP muda o pedido para "pago". O totem fica sabendo em tempo real e mostra a senha.
5. **Emite a NFC-e.** A nota sai por uma fila, em segundo plano. Se a SEFAZ estiver fora, entra em contingência e é transmitida depois.
6. **Cozinha.** A comanda vai ao vivo para a tela da Chapa. A batata entra na tela da Fritura 5 minutos depois que o xis começa. Itens "levar na saída" ficam em espera até o cliente liberar.
7. **Pronto.** A expedição confere os itens e marca o pedido como Pronto. O nome aparece no painel, e quem pediu pelo app ou pelo site recebe um aviso.
8. **Depois da venda.** O ERP credita o Pila de Volta, dá baixa no estoque pela ficha técnica e alimenta o histórico que calcula os hábitos.

Pedidos do iFood entram pelo passo 4, já pagos, com a etiqueta IFOOD e o horário de coleta.

## Integrações

São sete integrações externas. As três primeiras (pagamento, NFC-e e iFood) exigem homologação ou credenciais da empresa, e por isso ditam o calendário.

| Serviço | Para quê | Como | O que tu precisas providenciar |
| --- | --- | --- | --- |
| [Mercado Pago Point](https://www.mercadopago.com.ar/developers/pt/docs/mp-point-v2/overview) | Cartão no totem | Orders API, com a Point Smart em modo autoatendimento e o resultado por webhook | Conta Mercado Pago da empresa, Point Smart e credenciais de produção |
| Mercado Pago Checkout | Pix e cartão no app e no site; Pix na tela do totem | API de pagamentos, com QR dinâmico e cartão salvo | Mesma conta |
| API de emissão de NFC-e | Nota fiscal com CPF | O sistema monta a nota e envia por uma API especializada, que assina e conversa com a SEFAZ-RS | Inscrição estadual, certificado A1, CSC da SEFAZ-RS e tributação dos produtos feita pelo contador; escolher o fornecedor da API |
| [iFood Merchant API](https://developer.ifood.com.br/pt-BR/docs/guides/) | Receber pedidos do iFood e mandar o cardápio | Módulos Order e Events (pedidos) e Catalog (cardápio); Shipping para o Sob Demanda | Conta de desenvolvedor com CNPJ e homologação do aplicativo |
| Firebase Cloud Messaging | Push no app (o "Tchê, não vai te alimentar?") | Envio pelo backend, com link que abre a sacola pronta | Projeto no Firebase e contas de desenvolvedor da Apple e do Google |
| WhatsApp e SMS | Código de login, avisos do site, pedido pronto | WhatsApp Business Platform (API oficial da Meta) e um provedor de SMS | Número de WhatsApp da empresa verificado e modelos de mensagem aprovados |
| Mapas e CEP | Unidade mais próxima, faixa de entrega | API de geocodificação e distância (Google Maps Platform ou similar) e consulta de CEP | Conta na plataforma de mapas |

**Por que uma API para a NFC-e:** o sistema continua sendo o emissor (a nota sai com os dados e as regras do Bastião), mas a comunicação com a SEFAZ, a assinatura e as atualizações de layout ficam com quem vive disso. Isso reduz muito o risco de nota rejeitada e o tempo até a primeira venda.

**Regra para todas as integrações:** cada chamada externa passa por uma fila com novas tentativas, e cada webhook é verificado e pode chegar repetido sem duplicar nada.

## Tempo real e quedas de internet

A loja não pode parar porque a internet caiu. Por isso, cada tela sabe o que fazer quando perde a conexão, e a loja tem uma segunda internet (4G).

| Situação | O que acontece |
| --- | --- |
| Atualizações ao vivo | Totem, KDS, painel e acompanhamento do pedido recebem as mudanças por WebSocket, sem precisar recarregar |
| Internet principal cai | O roteador troca sozinho para o 4G de reserva, e as telas reconectam |
| Totem sem internet | Mostra "Pagamento só no balcão". O cardápio continua aparecendo porque fica guardado no aparelho |
| KDS sem internet | Mantém as comandas que já estavam na tela e marca as ações para sincronizar quando voltar. O caixa imprime as comandas novas como reserva |
| SEFAZ fora | NFC-e em contingência, transmitida automaticamente depois |
| Mercado Pago lento | O totem espera até o tempo limite e oferece trocar a forma de pagamento. Nunca cobra duas vezes |
| Atualização de versão | Totem, KDS e painel só atualizam fora do horário de pico ou quando ficam ociosos |

## Segurança e LGPD

O sistema nunca toca em dados de cartão: eles ficam com o Mercado Pago. O que o Bastião guarda de sensível (celular, CPF, endereço e hábitos) fica protegido e só é usado com o aceite do cliente.

- **Cartão:** o app e o site usam os componentes do Mercado Pago. O número do cartão não passa pelos nossos servidores.
- **Dados pessoais:** CPF e celular ficam criptografados no banco e aparecem mascarados nas telas da loja.
- **Consentimentos:** cada aceite (histórico, avisos, ofertas) é gravado com data e canal, e o cliente pode revogar no app ou no site.
- **Direitos do titular:** o cliente pode baixar e excluir seus dados pelo app. As notas fiscais ficam guardadas pelo prazo que a lei exige.
- **Acesso da equipe:** cada pessoa tem login próprio com perfil (caixa, cozinha, gerente, dono). Estorno, cancelamento e mudança de preço pedem permissão de gerente e ficam na auditoria.
- **Segredos:** chaves do Mercado Pago, do iFood e da NFC-e ficam num cofre da nuvem, nunca no código.
- **Backups:** banco com backup diário, guardado por 30 dias, e um teste de restauração por mês.
- **Totem:** em modo quiosque, sem acesso ao sistema operacional, e os dados da tela são apagados no fim de cada pedido.

Antes de lançar, vale um advogado revisar a política de privacidade e os termos de uso.

## Equipamentos da loja

A lista abaixo é para a primeira loja: 1 totem, 2 telas na cozinha e 1 TV de chamada. Os modelos e preços ainda precisam ser cotados. Como as telas são aplicações web, dá para trocar de marca sem reescrever o sistema.

| Item | Qtd. | Especificação mínima |
| --- | --- | --- |
| Totem de autoatendimento | 1 | Tela touch vertical de 21,5" a 32", Full HD, com computador embutido (Windows ou Android) e suporte para a Point Smart e a impressora |
| Mercado Pago Point Smart | 1 por totem + 1 no balcão | Fica ao lado do totem, em modo autoatendimento |
| Impressora térmica 80 mm | 1 no totem + 1 no balcão | USB ou rede, com guilhotina, para o ticket com a senha e o QR de "levar na saída" |
| Telas do KDS | 2 | Monitor de 21" a 24", ou TV de 32", com mini PC ou TV box, suporte de parede e proteção contra gordura e calor |
| Bump bar | 2 | Teclado numérico USB ou bump bar próprio, para avançar as comandas sem tocar na tela com a mão suja |
| TV do painel de chamada | 1 | TV de 43" ou mais, com TV box ou stick em modo quiosque |
| Computador ou tablet do balcão | 1 | Para o ERP, caixa e liberação dos pedidos "levar na saída" |
| Internet | 2 links | Fibra principal e 4G de reserva, com roteador que troca sozinho |
| Nobreak | 2 | Um para o totem e outro para o rack da internet e as telas da cozinha |

Antes de comprar, vale testar o protótipo HTML do totem na tela escolhida, para conferir o tamanho dos botões e a altura de leitura.

## Plano de construção com o Claude Code

O sistema é construído em 8 fases, cada uma com uma entrega que dá para testar. A ordem começa pelo ERP e pela cozinha, porque todos os canais dependem deles. Cada fase só começa quando a anterior passa no critério de "pronto".

**Estrutura do repositório**

```
bastiao/
  apps/
    api/        ERP e API (NestJS)
    admin/      painel do ERP (Next.js)
    site/       site de pedidos (Next.js)
    mobile/     app (Expo)
    totem/      totem (React, quiosque)
    kds/        telas da cozinha e painel de chamada
    agente/     agente local do totem (impressora)
  packages/
    regras/     preço, combos, ofertas, cashback, hábitos
    api-client/ cliente da API com tipos
    marca/      cores, fontes, poses do Bastião, componentes
  docs/         processos, arquitetura, cardápio oficial
  CLAUDE.md     regras do projeto para o Claude Code
```

O arquivo `CLAUDE.md` é o manual que o Claude Code lê em toda sessão. Ele resume as regras do negócio (nenhum preço inventado, pedido só vai para a cozinha pago, linguagem do Bastião, LGPD) e aponta para os documentos de processos e de arquitetura.

**Fases**

1. **Fundação.** Repositório, banco de dados, login da equipe, ambientes de teste e de produção, testes automáticos e publicação automática. *Pronto quando:* uma mudança no código vai sozinha para o ambiente de teste.
2. **ERP: cardápio, preços e estoque.** Unidades, cardápio oficial, combos, fichas técnicas, tabela de preços, upload de fotos e vídeos, publicação nos canais, custo de cada item e preço sugerido pelo markup. *Pronto quando:* o cardápio inteiro está cadastrado, e um item esgotado some na hora.
3. **Pedidos, cozinha e painel.** Pedido criado pelo balcão, as duas telas do KDS, o disparo da fritura, o "levar na saída" e a TV de chamada. *Pronto quando:* a equipe faz um turno simulado só com as telas.
4. **Totem com pagamento e nota.** O fluxo do protótipo, a Point Smart, o Pix na tela, a impressora e a NFC-e em homologação, mais o caixa, as contas a pagar e a receber e a conciliação do Mercado Pago. *Pronto quando:* uma venda real no cartão e no Pix sai com nota autorizada.
5. **App e site.** Conta, localização, unidade mais próxima, pedido, entrega e retirada, pagamento online e acompanhamento. *Pronto quando:* o app está publicado nas lojas e o site no ar, com pedidos chegando na cozinha.
6. **iFood.** Pedidos e cardápio integrados, pausa do delivery em todos os canais, repasses e comissões do iFood na conciliação. *Pronto quando:* a homologação do iFood é aprovada.
7. **Inteligência e Pila de Volta.** Cálculo dos hábitos, o aviso "Tchê, não vai te alimentar?", a sacola pronta e o cashback. *Pronto quando:* um cliente de teste recebe o aviso no horário certo e paga com um toque.
8. **Piloto na loja.** Operação real, com ajustes de tempo, de ofertas e de textos a partir dos relatórios. O DRE gerencial, as curvas ABC e a engenharia de cardápio passam a rodar com dados reais.

**Como trabalhar com o Claude Code em cada fase**

- Comece cada fase pedindo um plano ("planeje a fase 3 a partir dos documentos") e aprove o plano antes de ele programar.
- Peça testes automáticos junto com cada funcionalidade, principalmente em preço, combos, pagamento e fiscal.
- Use o modelo mais capaz e esforço alto nas fases 1, 3, 4 e 6, que têm arquitetura, dinheiro e homologação. Nas telas repetitivas, um modelo mais leve dá conta.
- Teste sempre no ambiente de teste do Mercado Pago, do iFood e da NFC-e antes de ir para a produção.

## Contas a providenciar e decisões pendentes

As contas abaixo demoram dias ou semanas para ficar prontas, e algumas exigem CNPJ. Vale começar já, em paralelo com a fase 1.

**Contas e cadastros (tu)**

- [x] Conta no GitHub para o repositório do código
- [x] Conta na nuvem (AWS ou Google Cloud) com faturamento da empresa
- [ ] Mercado Pago: conta da empresa, credenciais de desenvolvedor e Point Smart
- [ ] Certificado digital A1 (e-CNPJ), inscrição estadual ativa e CSC da SEFAZ-RS, com o contador
- [ ] Contador: tributação de cada produto (NCM, CFOP, CST ou CSOSN)
- [ ] Conta de desenvolvedor no iFood (perfil profissional, com CNPJ)
- [ ] Apple Developer Program e Google Play Console, no nome da empresa
- [x] Projeto no Firebase
- [ ] WhatsApp Business Platform: número verificado e empresa aprovada na Meta
- [ ] Conta na plataforma de mapas
- [ ] Domínio do site

**Decisões pendentes**

- [ ] Nuvem: AWS ou Google Cloud (as duas têm região em São Paulo)
- [ ] Fornecedor da API de emissão de NFC-e: cotar com o contador
- [ ] Provedor de SMS para o código de login, como reserva do WhatsApp
- [ ] Modelos do totem, das telas da cozinha e da TV, depois de testar o protótipo na tela
- [ ] Quantas unidades no lançamento e quais endereços
- [ ] Quem vai acompanhar o Claude Code no dia a dia: tu mesmo ou um desenvolvedor que revisa o código e cuida da publicação

Documentos relacionados: [Etapa 1: Definição de Processos](https://claude.ai/artifact/UpqbwxF68Mdw6xAyBgzhYq), [Protótipo do Totem](https://claude.ai/artifact/6odey6ZmT1ZBXMYmeaubTE) e [App, Site e Cozinha](https://claude.ai/artifact/89oePzCNo6bD36LKMtJ3TP).
