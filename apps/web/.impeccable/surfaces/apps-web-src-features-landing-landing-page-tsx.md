---
version: 1
slug: 'apps-web-src-features-landing-landing-page-tsx'
primary_target: 'apps/web/src/features/landing/landing-page.tsx'
related_targets: []
---

# Página inicial pública (`/` para visitantes)

Mode: Persuade. Audience: proprietários de poucos imóveis de temporada e gestores de vários (PRODUCT.md). Action: criar conta (secundária: entrar). Proof: as telas reais do app com dados fictícios, no claro e no escuro. Constraints: paleta e tokens do app, sem cards, sem preços nem números inventados, logado vai para /reservas.

Chosen structure: tour pelas telas (escolhida pelo usuário entre as três da rodada; a sorteada era a faixa de ocupação).

## Direction contract

THESIS: o produto se vende sendo visto. A página é uma janela para o app real, não uma lista de promessas; recusa o hero dividido com ilustração genérica e a fileira de cards de features.

OWN-WORLD: o mundo do app. Faixa Prussian (`bg-sidebar`) como o campo da primeira dobra nos dois temas, Carolina como ação, Azure e os tokens de fundo abaixo; fonte do sistema, cantos `--radius`, linhas finas `border-border`, as cores de imóvel do calendário como única cor viva.

STORY: o visitante lê em uma linha o que o Hostly faz, vê cada tela de verdade trocando pelas abas, entende os quatro trabalhos (calendário, imóveis, intermediadores com comissão, resumo financeiro) e cria a conta.

FIRST VIEWPORT: barra com marca, Entrar e Criar conta, e o seletor de tema; título de duas linhas e uma linha de apoio, centralizados, com Criar conta (primária) e Entrar; logo abaixo, a fileira de abas com miniaturas das cinco telas e, sob ela, a captura grande da tela escolhida, começando dentro da primeira dobra no desktop, com o topo da tela (cabeçalho e título da página do app) visível sem rolar.

FORM: tour pelas telas, item 7 da lista ordenada; ganhou do sorteio por escolha do usuário. Raise do VU-meter bridge: as abas são uma fileira de canais idênticos (miniatura + rótulo) que se lê varrendo a fileira inteira. Interação assinatura: trocar de aba (clique, setas do teclado) troca a captura com transição suave, e o tema da página troca as capturas entre claro e escuro. seed:39b6a9af89fb8ecd

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
