import { CalendarDays, Home, MoreHorizontal, Pencil, Plus, SearchX, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { SEARCH_MAX_LENGTH, SearchInput } from '@/components/search-input'
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
import { useSearchParamState } from '@/hooks/use-search-param-state'
import { ApiError } from '@/lib/api/errors'
import { errorMessage } from '@/lib/api/form-errors'

import {
  PAGE_SIZE,
  type Property,
  PROPERTY_TYPE_LABELS,
  useDeleteProperty,
  useProperties,
} from './api'
import { apartmentLine, placeLine, streetLine } from './property-format'
import { PropertySheet } from './property-sheet'

/**
 * What a panel or dialog shows. It keeps its property after closing, so the content doesn't
 * change while it animates out.
 */
interface Overlay {
  open: boolean
  property?: Property
}

function PropertyName({ property }: { property: Property }) {
  const apartment = apartmentLine(property)
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{property.name}</span>
        <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
      </div>
      {apartment && <p className="text-muted-foreground text-xs">{apartment}</p>}
    </>
  )
}

export function PropertiesPage() {
  const { params, page, set } = useSearchParamState()
  const search = (params.get('q') ?? '').trim().slice(0, SEARCH_MAX_LENGTH)
  const properties = useProperties({ search, page })
  const remove = useDeleteProperty()
  const [editing, setEditing] = useState<Overlay>({ open: false })
  const [deleting, setDeleting] = useState<Overlay>({ open: false })
  const lastPage = Math.max(1, Math.ceil((properties.data?.total ?? 0) / PAGE_SIZE))
  const pastTheEnd = properties.data?.items.length === 0 && page > lastPage

  // A deletion or an old link can leave the page past the last one: go to the last one.
  useEffect(() => {
    if (pastTheEnd) set('page', lastPage)
  }, [pastTheEnd, lastPage, set])

  const onSearch = useCallback(
    (value: string) => {
      set('q', value)
    },
    [set],
  )

  const confirmDelete = async () => {
    const property = deleting.property
    if (!property) return
    try {
      await remove.mutateAsync(property.id)
      toast.success(`"${property.name}" foi excluído.`)
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === 'PROPERTY_HAS_BOOKINGS'
          ? `"${property.name}" tem reservas. Exclua as reservas dele antes de excluir o imóvel.`
          : errorMessage(error),
      )
    } finally {
      setDeleting({ open: false, property })
    }
  }

  const newButton = (
    <Button
      onClick={() => {
        setEditing({ open: true })
      }}
    >
      <Plus aria-hidden />
      Novo imóvel
    </Button>
  )

  const nothingYet = properties.data?.total === 0 && search === ''

  return (
    <>
      <PageHeader
        title="Imóveis"
        description="As casas e apartamentos que você aluga."
        actions={newButton}
      />

      {!nothingYet && (
        <SearchInput
          label="Buscar imóvel"
          placeholder="Buscar pelo nome"
          value={search}
          onSearch={onSearch}
        />
      )}

      {properties.isPending || pastTheEnd ? (
        <LoadingState />
      ) : properties.isError ? (
        <ErrorState
          message={errorMessage(properties.error)}
          onRetry={() => void properties.refetch()}
        />
      ) : nothingYet ? (
        <EmptyState
          icon={Home}
          title="Nenhum imóvel ainda"
          description="Cadastre sua primeira casa ou apartamento para começar a registrar reservas."
          action={newButton}
        />
      ) : properties.data.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nada encontrado"
          description={`Nenhum imóvel com "${search}" no nome.`}
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table aria-label="Imóveis">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Endereço</TableHead>
                  <TableHead className="hidden sm:table-cell">Cidade</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.data.items.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <PropertyName property={property} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {streetLine(property) || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {placeLine(property) || '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ações de ${property.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing({ open: true, property })
                            }}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/reservas?imovel=${property.id}`}>
                              <CalendarDays className="size-4" />
                              Ver reservas
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              setDeleting({ open: true, property })
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
            total={properties.data.total}
            onPageChange={(next) => {
              set('page', next)
            }}
          />
        </>
      )}

      <PropertySheet
        open={editing.open}
        property={editing.property}
        onOpenChange={(open) => {
          setEditing((current) => ({ ...current, open }))
        }}
      />

      <ConfirmDialog
        open={deleting.open}
        onOpenChange={(open) => {
          setDeleting((current) => ({ ...current, open }))
        }}
        title="Excluir imóvel?"
        description={`"${deleting.property?.name ?? ''}" será excluído. Isso não pode ser desfeito.`}
        confirmLabel="Excluir"
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
