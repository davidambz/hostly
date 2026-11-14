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

# Hostly: redesign "Carta náutica" (#47)

Scope: the whole web app in one world, replacing "Parede de azulejos" (#45), which the user rejected except for the bookings calendar. Operate surfaces (app layout, reservas, imóveis, intermediadores, forms, booking summary) lead; login/signup and the public home (`/`, Persuade) inherit the world. Audience and truth: PRODUCT.md. Pinned by the user: colors very close to the blue family; the calendar keeps its current structure (month/week grid, stay bars per property), only its background may change with the theme; no serif (the user hated Young Serif); cards allowed; motion with purpose; light and dark.

Chosen in the direction round (2026-11-14, presented on a Claude Design canvas at the user's request): the assigned card "Carta náutica" over the pick "Modernismo brasileiro", the competitive challenger "Painel de embarque" and the canon "SaaS limpo". Build path: code-led. Sketches: the canvas boards Main.dc.html (Reservas) and A-Home.dc.html (Home).

## Direction contract

THESIS: a temporada como uma carta náutica do litoral: os azuis da marca viram tons de profundidade, linhas finas e números de sondagem. Recusa o painel SaaS cinza com cards e a fantasia temática (nada de rosa dos ventos, âncora ou mapa ilustrado).

OWN-WORLD: papel de carta #F3F8F9, tons de profundidade #E8F1F2 → #CFE3EA → #9CC7DA → Carolina #1B98E0 → Sapphire #006494 → Prussian #13293D (texto e barra do topo); areia #E9DFC7 como único quente. Escuro: carta noturna #0B1A27 com linhas claras. Archivo só, largura variável: títulos largos 600–700, UI normal, rótulos secundários em itálico como nomes de água, algarismos tabulares. Linhas de 1px, cantos 4–6px.

STORY: o usuário abre Reservas, vê numa faixa quanto cada imóvel está ocupado no mês e, no calendário, quem fica onde; abre uma reserva e vê total, recebido, a receber e comissão sem conta de cabeça.

FIRST VIEWPORT: barra Prussian de 56px no topo com a marca à esquerda, abas Reservas · Imóveis · Intermediadores (ativa com sublinhado Carolina), tema e avatar à direita. Abaixo, coluna de até 1280px: título largo "Reservas" com descrição e "+ Nova reserva" à direita; filtro de imóvel e Calendário|Lista; a faixa de sondagem; o calendário do mês com fundo de curvas de nível.

FORM: Carta náutica, item 3 da minha lista ordenada (sorteado). Raises dos descartados: hierarquia só por contraste de escala (espécime de fonte variável); uma família só e linhas finas (anuário de design); a grade do calendário como estrutura visível (Crouwel); importância por tamanho numa escala fixa (atlas estelar); cada imóvel com identidade fixa em toda tela (catálogo de personagens). Assinatura: sondagem de ocupação, um segmento por imóvel cujo azul aprofunda com as noites reservadas, com o número escrito como profundidade de carta. Movimento: a sondagem enche como maré ao trocar de mês, as faixas deslizam ao entrar; ease-out exponencial a partir de estado visível, nada com prefers-reduced-motion. seed:1216961af2af0814

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
