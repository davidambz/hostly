# Hostly

Gestão de reservas para aluguel de temporada. Reescrita do projeto `suasreservas` (PHP) com o front separado do back.

## Estrutura

```
apps/
  api/   # API REST (Fastify + Prisma + Zod)
  web/   # SPA (React + Vite + shadcn/ui + TanStack Query)
packages/
  validation/  # @hostly/validation: CPF, CNPJ, telefone e CEP (validadores e máscaras)
```

Monorepo com pnpm workspaces (Node 24, pnpm via corepack). TypeScript `strict` em tudo, com a config base em `tsconfig.base.json`. ESLint (flat config, type-checked) e Prettier ficam na raiz.

## Comandos

| Comando          | O que faz                        |
| ---------------- | -------------------------------- |
| `pnpm lint`      | ESLint no monorepo inteiro       |
| `pnpm format`    | Prettier em tudo                 |
| `pnpm typecheck` | `tsc --noEmit` em cada workspace |
| `pnpm test`      | testes de cada workspace         |
| `pnpm build`     | build de cada workspace          |

## API (`apps/api`)

```
src/
  config/env.ts   # env validada com Zod; falha no boot se algo estiver errado
  plugins/        # error-handler, security (helmet/cors/rate limit), not-found, swagger
  modules/<x>/    # x.routes.ts → x.service.ts → x.repository.ts, com x.schemas.ts
  shared/         # erros de domínio (AppError e subclasses) e tipos compartilhados
  test/           # helpers de teste
  app.ts          # buildApp(env), usado pelo server e pelos testes
  server.ts       # listen + shutdown gracioso
```

- As rotas só validam entrada e saída com Zod (`fastify-type-provider-zod`) e chamam o service. A regra de negócio fica no service e o acesso a dados no repository.
- Erros esperados: o service lança `NotFoundError`, `ConflictError` etc. e o error handler converte para `{ statusCode, code, message, details? }`. Nenhuma rota monta resposta de erro na mão.
- Erro inesperado vira 500 genérico, e o original vai para o log com o `reqId`.
- Toda rota, inclusive a 404, passa pelo rate limit. As exceções são `/health` (liveness, sempre 200 com o processo de pé, usado pelo `HEALTHCHECK`) e `/health/ready` (readiness: 200 ou 503 conforme o banco), com `config: { rateLimit: false }`. O 503 da readiness é o relatório de saúde, não um erro, e por isso não passa pelo error handler.
- Os testes ficam ao lado do código e usam `app.inject()`. O env dos testes vem de `src/test/env.ts`.
  - `*.test.ts` (projeto `unit`): sem banco, com `fakeDatabase()` ou um repository fake.
  - `*.int.test.ts` (projeto `integration`): Postgres de verdade em `TEST_DATABASE_URL`, cujo nome precisa terminar em `_test`. O banco é recriado e migrado a cada execução e as tabelas são esvaziadas antes de cada teste. Os arquivos rodam em série. Use `testDatabase()` e as factories de `src/test/factories.ts`, e `validCpf`/`validCnpj` de `src/test/documents.ts` (que reexporta `@hostly/validation/testing`).
  - Cada feature cobre caminho feliz, validação, 401/403/404/409, isolamento entre usuários e casos de borda. A cobertura mínima é de 85%.
- Docs em `/docs` (Swagger UI) e `/docs/json` (OpenAPI).

### Autenticação

- `POST /auth/login` devolve um access token JWT (HS256, `ACCESS_TOKEN_TTL_SECONDS`, padrão 15 min), enviado como `Authorization: Bearer`. O refresh token vai num cookie `hostly_refresh_token` (`httpOnly`, `SameSite=Strict`, `path=/auth`, `Secure` em produção).
- Refresh token opaco, guardado só como SHA-256. Cada `POST /auth/refresh` gera um token novo na mesma família (rotação atômica, numa transação). A expiração é fixada no login (`REFRESH_TOKEN_TTL_DAYS`) e não estende no refresh. Reapresentar um token `ROTATED` dentro de 30 s responde 401 `REFRESH_TOKEN_ROTATED`: são duas abas ou um retry, e o cliente deve tentar de novo uma vez, sem que o cookie seja apagado. Depois disso, é tratado como vazamento: a família inteira é revogada (`REUSE_DETECTED`) e a resposta é 401 `REFRESH_TOKEN_REUSED`. Logout revoga a família com `LOGOUT`. Os tokens expirados do usuário são apagados no login.
- Rotas protegidas: `onRequest: [app.authenticate]` na rota. Num módulo em que todas as rotas são protegidas (ex.: `properties`), use `app.addHook('onRequest', app.authenticate)` dentro do plugin do módulo, que nunca é encapsulado com `fastify-plugin`, senão o hook vaza para a API inteira. O id do usuário fica em `request.user.sub`. Códigos de 401: `UNAUTHORIZED` (sem token), `TOKEN_EXPIRED` (o front deve chamar o refresh) e `INVALID_TOKEN`.
- Login com e-mail desconhecido verifica um hash falso, para levar o mesmo tempo que uma senha errada. Os dois casos respondem `INVALID_CREDENTIALS`.
- `JWT_SECRET` é obrigatório. O compose usa um segredo `dev-only-…`, que a API recusa com `NODE_ENV=production`.

### Banco (Prisma 7 + Postgres)

- O schema fica em `prisma/schema.prisma` e as migrations em `prisma/migrations`. O cliente é gerado em `src/generated/prisma` (no gitignore) por `pnpm db:generate`, que roda sozinho no `pnpm install`.
- `app.db` é o Prisma Client (plugin `database`). Os testes injetam um banco com `buildApp(env, { db })`.
- Ids UUID v7, dinheiro em centavos (`Int`), porcentagem em basis points (1000 = 10%), CPF, CEP e telefone só com dígitos; CNPJ com dígitos e letras maiúsculas (o CNPJ alfanumérico existe desde jul/2026, então nunca use `onlyDigits` nele, só `normalizeDocument`); e-mail em minúsculas.
- Toda linha de domínio tem `userId`, e toda query filtra por ele. Reservas apontam para imóvel e intermediador por FK composta `(id, user_id)`, então o banco recusa uma reserva com imóvel ou intermediador de outro usuário.
- Recursos do usuário (imóveis, intermediadores, reservas) seguem o mesmo molde: o repository filtra tudo por `userId` (recurso de outro usuário = 404), o update lê-decide-escreve numa transação com `lockOwnedRow` (`SELECT … FOR UPDATE`), e o delete usa `deleteOwnedRow` no repository e `deleteOrFail` no service (404 quando não há o que apagar, 409 quando há FK apontando).
- As regras de integridade também ficam no banco, como CHECK constraints escritas à mão no SQL da migration (o Prisma não modela CHECK). Ao criar uma migration nova, use `--create-only` quando precisar acrescentar SQL.
- O `.pnpmfile.cjs` tira o peer `prisma` do `@prisma/client`, para a CLI não ir para a imagem de produção. A CLI só existe na imagem `migrate`.

## Web (`apps/web`)

```
src/
  app/          # providers e rotas
  pages/        # uma página por rota
  components/   # ui/ (shadcn, gerados) e componentes do app (theme/, …)
  lib/api/      # cliente da API: client.ts, errors.ts, session.ts, schema.d.ts (gerado)
  lib/          # query client, utils
  styles/       # globals.css: tokens da paleta (claro e escuro)
  test/         # setup e helpers (renderRoute, renderWithProviders)
```

- **Paleta**: Prussian `#13293D`, Sapphire `#006494`, Celadon `#247BA0`, Carolina `#1B98E0` e Azure `#E8F1F2`, como tokens em `globals.css`. Use as classes do tema (`bg-primary`, `text-muted-foreground`…), nunca cores soltas. Tudo tem que funcionar no claro e no escuro (`ThemeProvider` + script no `index.html` que evita o flash).
- **Sem cards**: listas e tabelas. As reservas também têm a visão de calendário.
- **Contrato da API**: `apps/api/openapi.json` é gerado (`pnpm --filter @hostly/api openapi:export`) e os tipos do front saem dele (`pnpm --filter @hostly/web api:types`). Os dois arquivos são versionados, e o CI falha se estiverem desatualizados.
- **Chamadas**: `api.GET('/rota')` (openapi-fetch, tipado) + `unwrap()`, que lança `ApiError` (`status`, `code`, `details`). O access token fica só em memória (`session.ts`); o `authFetch` faz o refresh no `TOKEN_EXPIRED` (um só, compartilhado) e repete a requisição.
- Testes: Vitest + Testing Library + MSW (`*.test.tsx` ao lado do código). Os componentes de `components/ui` (shadcn) ficam fora da cobertura.

## Pacote compartilhado (`packages/validation`)

- `@hostly/validation` tem as regras brasileiras usadas pela API e pelo front. Os validadores (`isValid…`) recebem o valor já normalizado (`onlyDigits`, `normalizePhone`, `normalizeDocument`); as máscaras (`mask…`) aceitam qualquer texto digitado. Nunca duplique essas regras num app.
- O `exports` tem a condição `@hostly/source`, que aponta para o `src`: TypeScript (`customConditions` no `tsconfig.base.json`), tsx (`--conditions`), Vite e Vitest leem o fonte direto, sem build. Só o build de produção da API usa o `dist/` (`tsc`, no gitignore), compilado por `pnpm build` e pelo Dockerfile. Um app novo que consuma o pacote precisa da mesma condição.

## Fluxo de trabalho

- Tudo começa por uma issue. A branch sai da `dev` atualizada e se chama `feat/<n>-slug` (ou `fix/`, `chore/`, `docs/`, `test/`, `ci/`). O PR vai para `dev`.
- O corpo do PR começa com `Closes #<n>`, com uma linha para cada issue fechada.
- Commits em **inglês**, no padrão Conventional Commits, só com a linha de assunto. O commitlint valida no hook `commit-msg`. Sem `Co-Authored-By`.
- Antes de abrir o PR: lint, typecheck, testes (cobertura mínima de 85%) e teste manual por curl contra a API rodando.
- `main` é produção e `dev` é integração.

## Convenções

- Código, banco e API em inglês; textos de interface, issues e docs em português.
- Dinheiro em centavos (inteiro), nunca float.
- `.env.example` só com os nomes das variáveis, valores vazios.
