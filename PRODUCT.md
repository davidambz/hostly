# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Proprietários** de um ou poucos imóveis de temporada (casa de praia, apartamento), que alugam direto ou por intermediadores (imobiliária, corretor, Airbnb, Booking) e hoje controlam tudo em planilha, caderno ou WhatsApp.
- **Gestores** que administram vários imóveis, com vários intermediadores e comissões diferentes.

O trabalho dos dois é o mesmo: saber quais datas de cada imóvel estão ocupadas, não marcar duas reservas na mesma data, e saber quanto cada reserva rende, quanto já entrou e quanto vai de comissão.

## Product Purpose

O Hostly organiza as reservas de aluguel de temporada: imóveis, intermediadores e reservas num só lugar, com o calendário de ocupação e o resumo financeiro de cada reserva. Sucesso é o usuário largar a planilha e confiar no Hostly como a fonte de verdade das datas e dos valores.

## Positioning

Feito para o aluguel de temporada brasileiro de quem tem poucos imóveis ou gerencia alguns: calendário por imóvel que impede datas sobrepostas, intermediadores (pessoa física com CPF ou empresa com CNPJ) com comissão em porcentagem, e valores em reais calculados na reserva (total, recebido, a receber e comissão).

## Operating Context

- Uso no computador e no celular, em português, com valores em reais.
- O usuário cadastra imóveis (casa ou apartamento, com endereço preenchido pelo CEP), intermediadores (com comissão) e reservas (imóvel, hóspede, entrada, saída, valor da diária ou total, valor recebido, intermediador opcional).
- As reservas aparecem em calendário mensal e em lista.

## Capabilities and Constraints

- Funciona hoje:
  - Cadastro e login com sessão que continua (refresh token), troca de senha, sair dos outros aparelhos.
  - Imóveis (endereço pelo CEP, diária e limpeza padrão), intermediadores (CPF ou CNPJ, comissão padrão).
  - Reservas em calendário (mês e semana) e lista, sem datas sobrepostas, com o resumo financeiro ao vivo, pagamentos registrados um a um (sinal, parcelas) e o que falta receber; próximas entradas e saídas; exportação do mês em planilha.
  - Relatórios: desempenho por imóvel (ocupação, receita, líquido, diária média, RevPAR, comparados com o período anterior e o ano passado), o ano mês a mês com gráficos, e comissões a pagar por intermediador com os canais (cada intermediador e a reserva direta).
  - Planos e assinatura pela Stripe (cartão), com troca de periodicidade, cancelamento da renovação e histórico de pagamentos; backoffice para administradores (usuários, planos e preços, cortesias, painel).
  - Instalável no celular (PWA), tema claro e escuro.
- Fora por enquanto: contratos, recuperação de senha por e-mail, sincronização com Airbnb/Booking (iCal).
- Planos: **Free** (1 imóvel, de graça, sem prazo) e **Premium** (imóveis ilimitados), por mês, semestre ou ano. Não há período de teste: o Free é o jeito de conhecer. Os preços são definidos no backoffice e lidos da API (`GET /plans`): a página pública mostra os preços reais, nunca valores escritos à mão. Um administrador pode dar um plano de cortesia por 1 mês, 6 meses, 1 ano ou vitalício.
- Código aberto em github.com/davidambz/hostly.

## Brand Commitments

- Nome: Hostly. Textos de interface em português do Brasil.
- Cores na família azul definida pelo dono do produto: Prussian `#13293D`, Sapphire `#006494`, Celadon `#247BA0`, Carolina `#1B98E0`, Azure `#E8F1F2`. Desde o redesign (#45, 2026-11-03) tons e papéis podem mudar, mas o resultado tem que ficar bem parecido com essas cores. Tema claro e escuro.
- As reservas vivem num calendário (mês e semana, estadias marcadas por imóvel, no estilo Google Calendar), com o modo lista ao lado. O redesign não troca essa ideia.
- Cards são permitidos (a regra "sem cards" caiu no redesign #45).
- O dono quer movimento: animações com propósito no site todo, e a página inicial pública como a vitrine principal.

## Evidence on Hand

- As telas reais do app (calendário e lista de reservas, reserva com o resumo e os pagamentos, imóveis, intermediadores, relatórios), capturadas com a conta de demonstração e dados fictícios.
- Os planos e preços reais, vindos da API.
- Não existem clientes, depoimentos, números de uso nem logos de parceiros. Não inventar nenhum deles.

## Product Principles

1. As datas são a verdade: o sistema não deixa marcar duas reservas no mesmo imóvel na mesma data.
2. Dinheiro sem conta de cabeça: cada reserva mostra o total, o recebido, o que falta e a comissão.
3. Simples para quem tem um imóvel, organizado para quem tem vários.
4. Mostrar o produto funcionando em vez de prometer.
