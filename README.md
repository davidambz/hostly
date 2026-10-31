# Hostly

Gestão de reservas para aluguel de temporada: imóveis, intermediadores e reservas, com controle financeiro de cada estadia.

> Em construção. O roadmap está nas [issues](https://github.com/davidambz/hostly/issues).

## Rodando com Docker

Só precisa do Docker.

```bash
cp .env.example .env                    # opcional: portas e credenciais do Postgres
cp apps/api/.env.example apps/api/.env  # opcional: config da API
docker compose up
```

| Serviço  | Endereço                                       |
| -------- | ---------------------------------------------- |
| API      | http://localhost:3333 (docs em `/docs`)        |
| Postgres | `localhost:5432`, usuário/senha/banco `hostly` |

A API tem `/health` (liveness) e `/health/ready` (checa o banco).

Os valores vazios nos `.env` usam os padrões acima. O `DATABASE_URL` da API no compose é montado a partir de `POSTGRES_*`, então a senha não pode ter caracteres reservados de URL (`@ : / # ?`). O `apps/api/src` é montado no container e recarrega sozinho a cada alteração. Ao subir, o container gera o Prisma Client e aplica as migrations pendentes. As portas ficam presas ao `127.0.0.1`. Para mudar a porta da API no host, use `API_PORT` no `.env` da raiz.

| Comando                                                 | O que faz                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `docker compose up --build`                             | recria a imagem depois de mudar dependências ou configs (`package.json`, `tsconfig`) |
| `docker compose logs -f api`                            | acompanha os logs da API                                                             |
| `docker compose exec api pnpm db:seed`                  | popula dados de exemplo (login `ana@hostly.dev` / `hostly123`)                       |
| `docker compose exec api pnpm db:migrate --name <nome>` | cria e aplica uma migration nova a partir do `schema.prisma`                         |
| `docker compose down`                                   | para tudo (mantém o banco)                                                           |
| `docker compose down -v`                                | para tudo e apaga o banco                                                            |

### Imagens de produção

O Dockerfile da API tem dois alvos de produção, os dois multi-stage, com usuário não-root:

- `prod`: o runtime da API, só com dependências de produção e `HEALTHCHECK` em `/health`.
- `migrate`: job avulso que roda `prisma migrate deploy`. Rode antes de cada deploy.

```bash
docker build -f apps/api/Dockerfile --target migrate -t hostly-api-migrate .
docker build -f apps/api/Dockerfile --target prod -t hostly-api .

docker run --rm -e DATABASE_URL=postgresql://... hostly-api-migrate
docker run -e DATABASE_URL=postgresql://... -p 3333:3333 hostly-api
```

## Desenvolvimento local

Pré-requisitos: Node 24 (`.nvmrc`) e pnpm, habilitado pelo corepack.

```bash
corepack enable
pnpm install
```

| Comando          | O que faz                        |
| ---------------- | -------------------------------- |
| `pnpm lint`      | ESLint no monorepo inteiro       |
| `pnpm format`    | Prettier em tudo                 |
| `pnpm typecheck` | `tsc --noEmit` em cada workspace |
| `pnpm test`      | testes de cada workspace         |
| `pnpm build`     | build de cada workspace          |

Os commits seguem [Conventional Commits](https://www.conventionalcommits.org/) e são validados no hook de `commit-msg`.
