# Hostly

Gestão de reservas para aluguel de temporada. Reescrita do projeto `suasreservas` (PHP) com o front separado do back.

## Estrutura

```
apps/
  api/   # API REST (Fastify + Prisma + Zod)
  web/   # SPA (React + Vite + shadcn/ui + TanStack Query)
packages/  # código compartilhado entre os apps
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
