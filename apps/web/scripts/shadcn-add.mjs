/**
 * `pnpm ui:add <component…>`: adds shadcn/ui components and fixes what its CLI gets wrong
 * in this setup. It can't resolve our `@/lib/utils` alias, so it imports `cn` from an
 * unrelated npm package (and installs it), and wires the toaster to `next-themes`
 * instead of our ThemeProvider.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const components = process.argv.slice(2)
if (components.length === 0) {
  console.error('Usage: pnpm ui:add <component…>')
  process.exit(1)
}

execFileSync('pnpm', ['dlx', 'shadcn@4.23.0', 'add', ...components, '--yes', '--overwrite'], {
  stdio: 'inherit',
})

const fixes = [
  [/import \{ cn \} from "cn"/g, 'import { cn } from "@/lib/utils"'],
  [/from "next-themes"/g, 'from "@/components/theme/theme-context"'],
  [/^"use client"\n\n?/m, ''],
]

for (const dir of ['src/components/ui', 'src/hooks']) {
  for (const file of readdirSync(dir)) {
    const path = join(dir, file)
    const before = readFileSync(path, 'utf8')
    const after = fixes.reduce(
      (text, [pattern, replacement]) => text.replace(pattern, replacement),
      before,
    )
    if (after !== before) writeFileSync(path, after)
  }
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const unwanted = ['cn', 'next-themes'].filter((name) => pkg.dependencies?.[name])
if (unwanted.length > 0) {
  execFileSync('pnpm', ['remove', ...unwanted], { stdio: 'inherit' })
}
execFileSync('pnpm', ['exec', 'prettier', '--write', 'src/components/ui', 'src/hooks'], {
  stdio: 'inherit',
})
