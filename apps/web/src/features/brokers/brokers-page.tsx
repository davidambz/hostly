import { MoreHorizontal, Pencil, Plus, SearchX, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { SearchInput } from '@/components/search-input'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useClampedPage } from '@/hooks/use-clamped-page'
import { useOverlay } from '@/hooks/use-overlay'
import { useSearchParamState } from '@/hooks/use-search-param-state'
import { ApiError } from '@/lib/api/errors'
import { errorMessage } from '@/lib/api/form-errors'

import {
  BROKER_TYPE_BADGES,
  BROKER_TYPE_LABELS,
  type Broker,
  PAGE_SIZE,
  useBrokers,
  useDeleteBroker,
} from './api'
import { documentLine, phonesLine } from './broker-format'
import { BrokerSheet } from './broker-sheet'

export function BrokersPage() {
  const { page, search, setSearch, setPage } = useSearchParamState()
  const brokers = useBrokers({ search, page })
  const remove = useDeleteBroker()
  const editing = useOverlay<Broker>()
  const deleting = useOverlay<Broker>()
  const pastTheEnd = useClampedPage({
    page,
    pageSize: PAGE_SIZE,
    total: brokers.data?.total,
    empty: brokers.data?.items.length === 0,
    goTo: setPage,
  })

  const confirmDelete = async () => {
    const broker = deleting.item
    if (!broker) return
    try {
      await remove.mutateAsync(broker.id)
      toast.success(`"${broker.name}" foi excluído.`)
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === 'BROKER_HAS_BOOKINGS'
          ? `"${broker.name}" está em reservas. Tire-o das reservas antes de excluir.`
          : errorMessage(error),
      )
    } finally {
      deleting.setOpen(false)
    }
  }

  const newButton = (
    <Button
      onClick={() => {
        editing.show()
      }}
    >
      <Plus aria-hidden />
      Novo intermediador
    </Button>
  )

  const nothingYet = brokers.data?.total === 0 && search === ''

  return (
    <>
      <PageHeader
        title="Intermediadores"
        description="Corretores e imobiliárias que trazem reservas."
        actions={newButton}
      />

      {!nothingYet && (
        <SearchInput
          label="Buscar intermediador"
          placeholder="Buscar pelo nome"
          value={search}
          onSearch={setSearch}
        />
      )}

      {brokers.isPending || pastTheEnd ? (
        <LoadingState />
      ) : brokers.isError ? (
        <ErrorState message={errorMessage(brokers.error)} onRetry={() => void brokers.refetch()} />
      ) : nothingYet ? (
        <EmptyState
          icon={Users}
          title="Nenhum intermediador ainda"
          description="Cadastre os corretores e imobiliárias que trazem reservas, para acompanhar as comissões."
          action={newButton}
        />
      ) : brokers.data.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nada encontrado"
          description={`Nenhum intermediador com "${search}" no nome.`}
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table aria-label="Intermediadores">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">CPF/CNPJ</TableHead>
                  <TableHead className="hidden sm:table-cell">Contato</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brokers.data.items.map((broker) => (
                  <TableRow key={broker.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{broker.name}</span>
                        <Badge variant="secondary" title={BROKER_TYPE_LABELS[broker.type]}>
                          {BROKER_TYPE_BADGES[broker.type]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden font-mono text-xs md:table-cell">
                      {documentLine(broker) || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      <ContactLines broker={broker} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ações de ${broker.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              editing.show(broker)
                            }}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              deleting.show(broker)
                            }}
                          >
                            <Trash2 className="size-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={PAGE_SIZE}
            total={brokers.data.total}
            onPageChange={setPage}
          />
        </>
      )}

      <BrokerSheet open={editing.open} broker={editing.item} onOpenChange={editing.setOpen} />

      <ConfirmDialog
        open={deleting.open}
        onOpenChange={deleting.setOpen}
        title="Excluir intermediador?"
        description={`"${deleting.item?.name ?? ''}" será excluído. Isso não pode ser desfeito.`}
        confirmLabel="Excluir"
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

function ContactLines({ broker }: { broker: Broker }) {
  const phones = phonesLine(broker)
  if (!broker.email && !phones) return <>—</>
  return (
    <div className="grid gap-0.5">
      {broker.email && <span className="truncate">{broker.email}</span>}
      {phones && <span className="text-xs">{phones}</span>}
    </div>
  )
}
