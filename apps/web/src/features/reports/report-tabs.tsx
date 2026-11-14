import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

const TABS = [
  { to: '/relatorios', label: 'Desempenho' },
  { to: '/relatorios/ano', label: 'Ano mês a mês' },
  { to: '/relatorios/comissoes', label: 'Comissões e canais' },
]

/** Switches between the reports, keeping each one's own URL. */
export function ReportTabs() {
  return (
    <nav aria-label="Relatórios" className="border-b">
      <ul className="-mb-px flex gap-4 overflow-x-auto">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end
              className={({ isActive }) =>
                cn(
                  'inline-block border-b-2 px-1 pb-2 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
