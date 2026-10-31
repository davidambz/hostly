# Hostly

Gestão de reservas para aluguel de temporada: imóveis, intermediadores e reservas, com controle financeiro de cada estadia.

> Em construção. O roadmap está nas [issues](https://github.com/davidambz/hostly/issues).

## Desenvolvimento

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
