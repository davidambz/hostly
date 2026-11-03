import { CalendarDays, FolderGit2, House, type LucideIcon, ReceiptText, Users } from 'lucide-react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Brand } from '@/components/brand'
import { ModeToggle } from '@/components/theme/mode-toggle'
import { useTheme } from '@/components/theme/theme-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { QuoteDemo } from './quote-demo'
import { isScreenId, SCREENS, type ScreenId } from './screens'
import { signupPath } from './signup-path'
import { TileWall } from './tile-wall'

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

/** The public home page: the calendar as a tiled wall, the money math working, the real screens. */
export function LandingPage() {
  const { resolvedTheme } = useTheme()
  const navigate = useNavigate()
  const [screen, setScreen] = useState<ScreenId>('calendar')
  const [propertyName, setPropertyName] = useState('')
  const tour = useRef<HTMLElement>(null)
  const nameId = useId()

  const showScreen = (id: ScreenId) => {
    setScreen(id)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    tour.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="bg-background min-h-svh">
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav aria-label="Conta" className="flex items-center gap-1 sm:gap-2">
          <ModeToggle />
          <Button asChild variant="ghost">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/cadastro">Criar conta</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section
          aria-labelledby="hero-title"
          className="mx-auto grid max-w-7xl gap-10 px-4 pt-8 pb-16 sm:px-6 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-12 lg:items-center lg:gap-12 lg:pt-4"
        >
          <div className="lg:col-span-5">
            <h1
              id="hero-title"
              className="font-display animate-tile-flip text-5xl leading-[1.02] tracking-[-0.02em] text-balance sm:text-6xl xl:text-7xl"
            >
              Sua temporada, ladrilho por ladrilho.
            </h1>
            <p
              style={{ animationDelay: '120ms' }}
              className="animate-tile-flip text-muted-foreground mt-6 max-w-md text-lg text-pretty"
            >
              Cada noite de cada imóvel num calendário que não deixa marcar duas vezes, e quanto
              cada reserva rende, já com a comissão do intermediador.
            </p>
            <form
              style={{ animationDelay: '240ms' }}
              className="animate-tile-flip mt-8 grid max-w-md gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void navigate(signupPath(propertyName))
              }}
            >
              <label htmlFor={nameId} className="text-sm font-medium">
                Comece pelo nome do seu imóvel
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id={nameId}
                  value={propertyName}
                  maxLength={60}
                  autoComplete="off"
                  placeholder="ex.: Casa da Praia"
                  className="h-11 text-base sm:flex-1"
                  onChange={(event) => {
                    setPropertyName(event.target.value)
                  }}
                />
                <Button type="submit" size="lg" className="h-11">
                  Criar conta
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                Já usa o Hostly?{' '}
                <Link
                  to="/login"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Entrar
                </Link>
              </p>
            </form>
          </div>

          <div className="bg-card rounded-md border p-3 shadow-[0_30px_60px_-30px_var(--frame-shadow)] sm:p-4 lg:col-span-7 lg:h-[min(40rem,calc(100svh-7rem))]">
            <TileWall visitorName={propertyName} />
          </div>
        </section>

        <section
          aria-labelledby="money-title"
          className="border-border bg-card border-y py-16 sm:py-24"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2
                id="money-title"
                className="font-display text-3xl leading-tight tracking-tight text-balance sm:text-4xl"
              >
                A conta de cada reserva, feita na hora
              </h2>
              <p className="text-muted-foreground mt-4 text-pretty">
                Diárias, limpeza, sinal e comissão viram o total do hóspede, o que você recebe e o
                que falta receber. Mexa nos valores: é a mesma conta do app.
              </p>
            </div>
            <div className="lg:col-span-8">
              <QuoteDemo />
            </div>
          </div>
        </section>

        <section
          ref={tour}
          aria-labelledby="tour-title"
          className="mx-auto max-w-7xl scroll-mt-4 px-4 py-16 sm:px-6 sm:py-24"
        >
          <h2
            id="tour-title"
            className="font-display text-3xl leading-tight tracking-tight sm:text-4xl"
          >
            As telas de verdade
          </h2>
          <TabsPrimitive.Root
            value={screen}
            onValueChange={(value) => {
              if (isScreenId(value)) setScreen(value)
            }}
            className="mt-8"
          >
            <TabsPrimitive.List
              aria-label="Telas do Hostly"
              className="flex flex-wrap gap-2 sm:grid sm:grid-cols-5 sm:gap-3"
            >
              {SCREENS.map((item) => (
                <TabsPrimitive.Trigger
                  key={item.id}
                  value={item.id}
                  className={cn(
                    'group text-muted-foreground flex shrink-0 flex-col gap-2 rounded-md p-1.5 text-left text-sm font-medium transition-colors',
                    'hover:text-foreground focus-visible:ring-ring outline-none focus-visible:ring-2',
                    'data-[state=active]:text-foreground',
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
                        'ring-border hidden aspect-[16/10] w-full rounded-[3px] object-cover object-left-top opacity-70 ring-1 transition-[opacity,box-shadow] sm:block',
                        'group-hover:opacity-90 group-data-[state=active]:ring-primary group-data-[state=active]:opacity-100 group-data-[state=active]:ring-2',
                      )}
                    />
                  </picture>
                  <span className="group-data-[state=active]:border-primary flex items-center gap-1.5 rounded-sm border border-transparent px-2 py-1 sm:border-0 sm:px-0.5 sm:py-0">
                    {item.label}
                  </span>
                </TabsPrimitive.Trigger>
              ))}
            </TabsPrimitive.List>

            {SCREENS.map((item) => (
              <TabsPrimitive.Content
                key={item.id}
                value={item.id}
                className="focus-visible:ring-ring mt-6 rounded-md outline-none focus-visible:ring-2"
              >
                <figure className="grid gap-6 lg:grid-cols-12 lg:items-start">
                  <div className="bg-card overflow-hidden rounded-md border shadow-[0_30px_60px_-30px_var(--frame-shadow)] lg:col-span-9">
                    <picture>
                      <source media="(min-width: 640px)" srcSet={item.image[resolvedTheme]} />
                      <img
                        src={item.phone[resolvedTheme]}
                        alt={item.alt}
                        width={780}
                        height={1440}
                        className="animate-tile-flip aspect-[390/720] w-full object-cover object-top sm:aspect-[16/10] sm:object-left-top"
                      />
                    </picture>
                  </div>
                  <figcaption className="lg:col-span-3 lg:pt-2">
                    <span className="font-display block text-2xl leading-snug text-balance">
                      {item.title}
                    </span>
                    <span className="text-muted-foreground mt-3 block text-pretty">
                      {item.caption}
                    </span>
                  </figcaption>
                </figure>
              </TabsPrimitive.Content>
            ))}
            <p className="text-muted-foreground mt-6 text-xs">
              Telas reais do Hostly, com dados fictícios.
            </p>
          </TabsPrimitive.Root>
        </section>

        <section
          aria-labelledby="jobs-title"
          className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24"
        >
          <h2
            id="jobs-title"
            className="font-display max-w-2xl text-3xl leading-tight tracking-tight text-balance sm:text-4xl"
          >
            Tudo o que a planilha fazia, sem a conta de cabeça
          </h2>
          <ul className="bg-grout mt-10 grid gap-[3px] overflow-hidden rounded-md p-[3px] sm:grid-cols-2">
            {JOBS.map(({ icon: Icon, title, text, screen: target }) => (
              <li key={title} className="bg-card flex flex-col gap-4 rounded-[2px] p-6 sm:p-8">
                <span
                  aria-hidden
                  className="azulejo text-primary flex size-12 items-center justify-center rounded-[3px] border [--tile-ink:var(--glaze-strong)]"
                >
                  <Icon className="size-6" />
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-1 text-pretty">{text}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
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
          className="azulejo-field border-border border-y px-4 py-20 [--tile-size:56px] sm:px-6 sm:py-28"
        >
          <div className="bg-card mx-auto flex max-w-2xl flex-col items-center gap-6 rounded-md border p-8 text-center shadow-[0_30px_60px_-30px_var(--frame-shadow)] sm:p-12">
            <h2
              id="close-title"
              className="font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl"
            >
              Comece pelo primeiro imóvel.
            </h2>
            <p className="text-muted-foreground max-w-md text-pretty">
              Cadastre o imóvel, lance as reservas que você já tem e veja a temporada inteira de uma
              vez.
            </p>
            <Button asChild size="lg">
              <Link to={signupPath(propertyName)}>Criar conta</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="text-muted-foreground mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6">
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
