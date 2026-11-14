---
version: 1
slug: 'src-features-landing-landing-page-tsx'
primary_target: 'src/features/landing/landing-page.tsx'
related_targets:
  [
    'src/features/auth',
    'src/components/layout',
    'src/features/bookings',
    'src/features/properties',
    'src/features/brokers',
  ]
---

# Hostly: redesign "Parede de azulejos" (#45)

Scope: the whole web app in one world. First surface: the public home page (`/`, Persuade). Then login/signup (Persuade-light), app layout and reservas/imóveis/intermediadores (Operate, code-led, inheriting this world). Audience and truth: PRODUCT.md. Pinned by the user: colors very close to today's blue family; the bookings calendar (month/week, stays per property, Google Calendar-like) stays; cards allowed; much more motion; the home page is the priority. Light and dark.

Chosen in the direction round (2026-11-03): the IMPECCABLE'S PICK card, "Parede de azulejos", over the rolled "Quadro de chaves". Build path: code-led (no image generation). Sketch: `.impeccable/mocks/decision/model-pick.html`.

## Direction contract

THESIS: o calendário é uma parede de azulejos do litoral catarinense: cada noite um ladrilho, cada reserva uma faixa pintada sobre eles, cada imóvel um esmalte. Recusa o SaaS de painel (hero dividido com captura + fileira de cards de recurso) e o cartão-postal de praia.

OWN-WORLD: esmalte branco (#F7FAFB/#FFFFFF) com rejunte Azure (#E8F1F2/#D2E1E5) no claro; no escuro, ladrilho Prussian vidrado (#0F2233) com rejunte quase preto. Cobalto Sapphire #006494 como tinta principal, Carolina #1B98E0 como esmalte claro, Celadon #247BA0 como segundo azul, Prussian #13293D como texto. Imóveis em esmaltes de azulejo de padrão (cobalto, ocre, verde-cobre, manganês, laranja-antimônio, turquesa), mais terrosos que os de hoje. Display em Young Serif (pintado à mão, de placa de número de casa); texto e números em Hanken Grotesk com algarismos tabulares. Cantos quase retos (2-4px), juntas de 2-4px entre ladrilhos, padrões geométricos de azulejo desenhados em SVG/CSS só onde carregam dado ou marcam um lugar.

STORY: o visitante vê de cara uma parede de janeiro com estadias pintadas e entende "agenda de aluguel por imóvel, sem noite em dobro"; experimenta pintar o nome do imóvel dele numa placa de azulejo; entende dinheiro por reserva (total, comissão, falta receber); cria a conta já com esse nome.

FIRST VIEWPORT: à esquerda (cerca de 5/12), a placa "Hostly · nº 1" em moldura de azulejo, título em Young Serif grande ("Sua temporada, ladrilho por ladrilho." ou equivalente), uma linha de apoio e a ação primária em forma de trabalho: campo "Nome do seu imóvel" + "Criar conta" (cobalto), com "Já tenho conta" ao lado. À direita (cerca de 7/12, sangrando até a borda e a altura toda), a parede de janeiro em azulejos com as estadias de 3 imóveis pintadas, legenda "cada cor é um imóvel" em ladrilhos pequenos; ao digitar, o nome aparece pintado numa placa de azulejo na parede.

FORM: Parede de azulejos, item 1 da minha lista ordenada (o sorteio tinha caído no item 4, Quadro de chaves; o usuário escolheu este cartão). Raises trazidos dos desafiantes descartados: um só fio de movimento (do autômato de papel: os ladrilhos assentam numa onda única, as faixas se pintam com pincelada, as telas trocam virando ladrilhos, sempre a mesma coreografia); tudo medido pela coluna de uma noite (do osciloscópio); passar sobre um imóvel acende todas as faixas dele (da ficha de personagem); um conjunto fixo de padrões de azulejo reaparece em toda tela (da placa do coletivo); o nome pintado na página inicial segue para o cadastro (do quarto decorável). Interação assinatura: pintar o próprio imóvel na parede e ver a faixa de uma reserva se pintar. Movimento com ease-out exponencial, a partir de um estado já visível, e sem nada disso com prefers-reduced-motion. seed:852f1eef7b7b80dc

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
