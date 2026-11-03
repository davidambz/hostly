import { CalendarDays, FolderGit2, House, type LucideIcon, ReceiptText, Users } from 'lucide-react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { useRef, useState } from 'react'
import { Link } from 'react-router'

import { useTheme } from '@/components/theme/theme-context'
import { ModeToggle } from '@/components/theme/mode-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { isScreenId, SCREENS, type ScreenId } from './screens'

/** A transparent 1×1 GIF. */
const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export const REPOSITORY_URL = 'https://github.com/davidambz/hostly'

const JOBS: { icon: LucideIcon; title: string; text: string; screen: ScreenId }[] = [
  {
    icon: CalendarDays,
    title: 'Calendário de reservas',
    text: 'Todas as reservas de todos os imóveis no mês ou na semana, e nunca duas no mesmo imóvel na mesma noite.',
    screen: 'calendar',
  },
  {
    icon: House,
    title: 'Imóveis',
    text: 'Casas e apartamentos com o endereço completo a partir do CEP.',
    screen: 'properties',
  },
  {
    icon: Users,
    title: 'Intermediadores e comissão',
    text: 'Corretores e imobiliárias, pessoa física ou empresa, com a comissão de cada reserva calculada sobre as diárias.',
    screen: 'brokers',
  },
  {
    icon: ReceiptText,
    title: 'Resumo financeiro de cada reserva',
    text: 'Total do hóspede, comissão, quanto você recebe, quanto já entrou e quanto falta receber.',
    screen: 'booking',
  },
]

function Brand() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold">
      <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 items-center justify-center rounded-lg">
        <CalendarDays className="size-5" aria-hidden />
      </span>
      Hostly
    </span>
  )
}

/** Primary action on the dark band, in both themes. */
const bandPrimary = 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
const bandGhost = 'text-band-foreground hover:bg-band-accent hover:text-band-foreground'

/** The public home page: what Hostly is, shown with the app's own screens. */
export function LandingPage() {
  const { resolvedTheme } = useTheme()
  const [screen, setScreen] = useState<ScreenId>('calendar')
  const tour = useRef<HTMLDivElement>(null)

  const showScreen = (id: ScreenId) => {
    setScreen(id)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    tour.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="bg-background selection:bg-sidebar-primary selection:text-sidebar-primary-foreground min-h-svh">
      <header className="bg-band text-band-foreground">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <nav aria-label="Conta" className="flex items-center gap-1 sm:gap-2">
            <ModeToggle className={bandGhost} />
            <Button asChild variant="ghost" className={bandGhost}>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className={cn('hidden sm:inline-flex', bandPrimary)}>
              <Link to="/cadastro">Criar conta</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <TabsPrimitive.Root
          value={screen}
          onValueChange={(value) => {
            if (isScreenId(value)) setScreen(value)
          }}
        >
          <div className="bg-band text-band-foreground pb-36 sm:pb-56 lg:pb-72">
            <section
              aria-labelledby="hero-title"
              className="mx-auto max-w-4xl px-4 pt-14 text-center sm:px-6 sm:pt-16"
            >
              <h1
                id="hero-title"
                className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
              >
                Cada noite de cada imóvel, no lugar certo.
              </h1>
              <p className="text-band-foreground/80 mx-auto mt-5 max-w-xl text-lg text-pretty">
                O Hostly organiza as reservas do seu aluguel de temporada: o calendário de cada
                imóvel, sem datas em dobro, e quanto cada reserva rende, já com a comissão do
                intermediador.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className={bandPrimary}>
                  <Link to="/cadastro">Criar conta</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className={cn('border-band-border bg-transparent', bandGhost)}
                >
                  <Link to="/login">Já tenho conta</Link>
                </Button>
              </div>
            </section>

            <div ref={tour} className="mx-auto mt-12 max-w-6xl scroll-mt-4 px-4 sm:mt-14 sm:px-6">
              <TabsPrimitive.List
                aria-label="Telas do Hostly"
                className="flex flex-wrap justify-center gap-2 sm:grid sm:grid-cols-5 sm:gap-3"
              >
                {SCREENS.map((item) => (
                  <TabsPrimitive.Trigger
                    key={item.id}
                    value={item.id}
                    className={cn(
                      'group text-band-foreground/70 flex shrink-0 flex-col gap-2 rounded-lg p-1.5 text-left text-sm font-medium transition-colors',
                      'hover:text-band-foreground focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
                      'data-[state=active]:text-band-foreground',
                    )}
                  >
                    {/* Phones show no thumbnails, so they get a blank pixel instead of the capture. */}
                    <picture>
                      <source media="(min-width: 640px)" srcSet={item.image[resolvedTheme]} />
                      <img
                        src={BLANK_PIXEL}
                        alt=""
                        width={2000}
                        height={1250}
                        loading="lazy"
                        className={cn(
                          'ring-band-border hidden aspect-[16/10] w-full rounded-md object-cover object-left-top opacity-60 ring-1 transition-[opacity,box-shadow] sm:block dark:opacity-75',
                          'group-hover:opacity-80 group-data-[state=active]:opacity-100 group-data-[state=active]:ring-2 group-data-[state=active]:ring-sidebar-primary',
                        )}
                      />
                    </picture>
                    <span className="group-data-[state=active]:border-sidebar-primary flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 sm:border-0 sm:px-0.5 sm:py-0">
                      {item.label}
                    </span>
                  </TabsPrimitive.Trigger>
                ))}
              </TabsPrimitive.List>
            </div>
          </div>

          <div className="mx-auto -mt-28 max-w-6xl px-4 sm:-mt-48 sm:px-6 lg:-mt-64">
            {SCREENS.map((item) => (
              <TabsPrimitive.Content
                key={item.id}
                value={item.id}
                className="focus-visible:ring-ring rounded-xl outline-none focus-visible:ring-2"
              >
                <figure>
                  <div className="border-border bg-card overflow-hidden rounded-xl border shadow-[0_30px_60px_-24px_var(--frame-shadow)]">
                    <picture>
                      <source media="(min-width: 640px)" srcSet={item.image[resolvedTheme]} />
                      <img
                        src={item.phone[resolvedTheme]}
                        alt={item.alt}
                        width={780}
                        height={1440}
                        className={cn(
                          'aspect-[390/720] w-full object-cover object-top sm:aspect-[16/10] sm:object-left-top',
                          'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.985] motion-safe:duration-500 motion-safe:ease-out',
                        )}
                      />
                    </picture>
                  </div>
                  <figcaption className="mx-auto mt-8 max-w-2xl text-center">
                    <span className="block text-xl font-semibold text-balance">{item.title}</span>
                    <span className="text-muted-foreground mt-2 block text-pretty">
                      {item.caption}
                    </span>
                  </figcaption>
                </figure>
              </TabsPrimitive.Content>
            ))}
            <p className="text-muted-foreground mt-6 text-center text-xs">
              Telas reais do Hostly, com dados fictícios.
            </p>
          </div>
        </TabsPrimitive.Root>

        <section
          aria-labelledby="jobs-title"
          className="mx-auto max-w-4xl px-4 pt-24 sm:px-6 sm:pt-32"
        >
          <h2
            id="jobs-title"
            className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Tudo o que a planilha fazia, sem a conta de cabeça
          </h2>
          <ul className="divide-border border-border mt-10 divide-y border-y">
            {JOBS.map(({ icon: Icon, title, text, screen: target }) => (
              <li
                key={title}
                className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 py-6 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              >
                <Icon className="text-primary mt-0.5 size-6 sm:mt-0" aria-hidden />
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-1 max-w-prose text-pretty">{text}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="col-start-2 justify-self-start sm:col-start-3"
                  onClick={() => {
                    showScreen(target)
                  }}
                >
                  Ver a tela
                  <span className="sr-only">: {title}</span>
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="close-title"
          className="bg-band text-band-foreground mt-24 sm:mt-32"
        >
          <div className="mx-auto flex max-w-4xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-20">
            <div>
              <h2 id="close-title" className="text-3xl font-semibold tracking-tight text-balance">
                Comece pelo primeiro imóvel.
              </h2>
              <p className="text-band-foreground/80 mt-2 max-w-md text-pretty">
                Cadastre o imóvel, lance as reservas que você já tem e veja a temporada inteira de
                uma vez.
              </p>
            </div>
            <Button asChild size="lg" className={cn('shrink-0', bandPrimary)}>
              <Link to="/cadastro">Criar conta</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="text-muted-foreground mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6">
        <span>© Hostly</span>
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-2 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2"
        >
          <FolderGit2 className="size-4" aria-hidden />
          Código no GitHub
        </a>
      </footer>
    </div>
  )
}
