import { FolderGit2 } from 'lucide-react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Brand } from '@/components/brand'
import { ModeToggle } from '@/components/theme/mode-toggle'
import { useTheme } from '@/components/theme/theme-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { PlansSection } from './plans-section'
import { QuoteDemo } from './quote-demo'
import { isScreenId, SCREENS, type ScreenId } from './screens'
import { signupPath } from './signup-path'
import { SeasonChart } from './season-chart'
import { SeasonReport } from './season-report'

/** A transparent 1×1 GIF. */
const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export const REPOSITORY_URL = 'https://github.com/davidambz/hostly'

/** What else comes with the app, as a chart's legend: a term and what it means. */
const INCLUDED = [
  {
    term: 'Pagamentos da reserva',
    description: 'Registre o sinal e cada parcela; o que falta receber se atualiza sozinho.',
  },
  {
    term: 'Intermediadores',
    description: 'Corretor com CPF ou imobiliária com CNPJ, cada um com a sua comissão.',
  },
  {
    term: 'Próximas entradas e saídas',
    description: 'Quem chega e quem sai nos próximos sete dias, logo no topo das reservas.',
  },
  {
    term: 'Planilha do mês',
    description: 'As reservas do mês, ou um relatório, num arquivo que o Excel abre direto.',
  },
  {
    term: 'No celular',
    description: 'Instale na tela inicial e abra como um app, direto nas reservas.',
  },
  {
    term: 'Claro e escuro',
    description: 'Segue o tema do aparelho, ou o que você escolher.',
  },
]

/** The public home page: the season read like a chart, the money math working, the real screens. */
export function LandingPage() {
  const { resolvedTheme } = useTheme()
  const navigate = useNavigate()
  const [screen, setScreen] = useState<ScreenId>('calendar')
  const [propertyName, setPropertyName] = useState('')
  const nameId = useId()

  return (
    <div className="bg-background min-h-svh">
      <header className="bg-bar text-bar-foreground border-bar-border border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Brand inverted />
          <nav aria-label="Conta" className="flex items-center gap-1 sm:gap-2">
            <ModeToggle className="text-bar-foreground hover:bg-bar-accent hover:text-bar-foreground" />
            <Button
              asChild
              variant="ghost"
              className="text-bar-foreground hover:bg-bar-accent hover:text-bar-foreground"
            >
              <Link to="/login">Entrar</Link>
            </Button>
            <Button
              asChild
              className="bg-bar-active text-depth-4-foreground hover:bg-bar-active/90 hidden sm:inline-flex"
            >
              <Link to="/cadastro">Criar conta</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section
          aria-labelledby="hero-title"
          className="chart-graticule relative lg:min-h-[calc(100svh-3.5rem)]"
        >
          <div className="mx-auto grid max-w-7xl px-4 pt-6 pb-8 sm:px-6 lg:min-h-[calc(100svh-3.5rem)] lg:grid-cols-12 lg:items-center lg:pt-0 lg:pb-16">
            <div className="relative z-10 lg:col-span-5 lg:pr-10">
              <h1
                id="hero-title"
                className="font-wide animate-surface text-4xl leading-[1.02] font-bold text-balance sm:text-6xl xl:text-7xl"
              >
                Cada noite de cada imóvel, no lugar certo.
              </h1>
              <p
                style={{ animationDelay: '120ms' }}
                className="animate-surface text-muted-foreground mt-4 max-w-md text-base text-pretty sm:mt-6 sm:text-lg"
              >
                Um calendário por imóvel que não deixa marcar duas reservas na mesma noite, e quanto
                cada reserva rende, já com a comissão do intermediador.
              </p>
              <form
                style={{ animationDelay: '240ms' }}
                className="animate-surface mt-6 grid max-w-md gap-2 sm:mt-8"
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
          </div>

          {/* The chart: the right 7/12 of the hero, bleeding off the right edge, top to bottom. */}
          <div className="sm:pl-6 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[58%] lg:pb-6 lg:pl-0">
            <div className="h-full overflow-hidden sm:rounded-l-md">
              <SeasonChart visitorName={propertyName} />
            </div>
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
                className="font-wide text-3xl leading-tight font-bold text-balance sm:text-4xl"
              >
                A conta de cada reserva, feita na hora
              </h2>
              <p className="text-muted-foreground mt-4 text-pretty">
                Diárias, limpeza, sinal e comissão viram o total do hóspede, o que você recebe e o
                que falta receber. Depois, cada pagamento registrado desconta do que falta. Mexa nos
                valores: é a mesma conta do app.
              </p>
            </div>
            <div className="min-w-0 lg:col-span-8">
              <QuoteDemo />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="reports-title"
          className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12"
        >
          <div className="lg:col-span-4">
            <h2
              id="reports-title"
              className="font-wide text-3xl leading-tight font-bold text-balance sm:text-4xl"
            >
              Como cada imóvel vai, mês a mês
            </h2>
            <p className="text-muted-foreground mt-4 text-pretty">
              Os relatórios contam as noites e o dinheiro de cada imóvel, e comparam com o período
              anterior e com o ano passado. Uma reserva que vira o mês entra em cada mês só com as
              noites dele.
            </p>
            <dl className="mt-6 grid gap-4 text-sm">
              <div>
                <dt className="font-semibold">Desempenho</dt>
                <dd className="text-muted-foreground">
                  Ocupação, receita, líquido, diária média e RevPAR de cada imóvel.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Ano mês a mês</dt>
                <dd className="text-muted-foreground">
                  A temporada inteira, para saber quando subir e quando baixar a diária.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Comissões e canais</dt>
                <dd className="text-muted-foreground">
                  Quanto pagar a cada intermediador, e quanto rende cada canal depois da comissão.
                </dd>
              </div>
            </dl>
          </div>
          <div className="min-w-0 lg:col-span-8">
            <SeasonReport />
          </div>
        </section>

        <section
          aria-labelledby="tour-title"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24"
        >
          <h2 id="tour-title" className="font-wide text-3xl leading-tight font-bold sm:text-4xl">
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
              className="flex flex-wrap gap-2 sm:grid sm:grid-cols-3 sm:gap-3 lg:grid-cols-6"
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
                        className="animate-surface aspect-[390/720] w-full object-cover object-top sm:aspect-[16/10] sm:object-left-top"
                      />
                    </picture>
                  </div>
                  <figcaption className="lg:col-span-3 lg:pt-2">
                    <span className="font-wide block text-2xl leading-snug font-semibold text-balance">
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
          aria-labelledby="included-title"
          className="border-border bg-card border-y py-16 sm:py-24"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12">
            <h2
              id="included-title"
              className="font-wide text-3xl leading-tight font-bold text-balance sm:text-4xl lg:col-span-4"
            >
              E o que mais vem junto
            </h2>
            <dl className="grid gap-x-10 sm:grid-cols-2 lg:col-span-8">
              {INCLUDED.map((item) => (
                <div key={item.term} className="border-grid-line grid gap-1 border-t py-4">
                  <dt className="font-semibold">{item.term}</dt>
                  <dd className="text-muted-foreground text-sm text-pretty">{item.description}</dd>
                </div>
              ))}
              <div className="border-grid-line grid gap-1 border-t py-4">
                <dt className="font-semibold">Código aberto</dt>
                <dd className="text-muted-foreground text-sm text-pretty">
                  Todo o código está{' '}
                  <a
                    href={REPOSITORY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    no GitHub
                  </a>
                  , para quem quiser conferir como as contas são feitas.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <PlansSection signup={signupPath(propertyName)} />

        <section
          aria-labelledby="close-title"
          className="bg-depth-1 border-border border-y px-4 py-20 sm:px-6 sm:py-28"
        >
          <div className="bg-card mx-auto flex max-w-2xl flex-col items-center gap-6 rounded-md border p-8 text-center shadow-[0_30px_60px_-30px_var(--frame-shadow)] sm:p-12">
            <h2
              id="close-title"
              className="font-wide text-4xl leading-tight font-bold text-balance sm:text-5xl"
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
