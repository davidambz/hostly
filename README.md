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

Os valores vazios nos `.env` usam os padrões acima. O código de `apps/api` é montado no container e recarrega sozinho a cada alteração.

| Comando                        | O que faz                                                  |
| ------------------------------ | ---------------------------------------------------------- |
| `docker compose up --build -V` | recria as imagens e os `node_modules` depois de mudar deps |
| `docker compose logs -f api`   | acompanha os logs da API                                   |
| `docker compose down`          | para tudo (mantém o banco)                                 |
| `docker compose down -v`       | para tudo e apaga o banco                                  |

Imagem de produção da API (multi-stage, usuário não-root e só dependências de produção):

```bash
docker build -f apps/api/Dockerfile --target prod -t hostly-api .
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
