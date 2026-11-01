import { CalendarDays, Home, MoreHorizontal, Pencil, Plus, SearchX, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
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

type Editing = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; property: Property }

export function PropertiesPage() {
  const { params, page, set } = useSearchParamState()
  const search = params.get('q') ?? ''
  const properties = useProperties({ search, page })
  const remove = useDeleteProperty()
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' })
  const [deleting, setDeleting] = useState<Property | null>(null)

  const onSearch = useCallback(
    (value: string) => {
      set('q', value)
    },
    [set],
  )

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`"${deleting.name}" foi excluído.`)
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === 'PROPERTY_HAS_BOOKINGS'
          ? `"${deleting.name}" tem reservas. Exclua as reservas dele antes de excluir o imóvel.`
          : errorMessage(error),
      )
    } finally {
      setDeleting(null)
    }
  }

  const newButton = (
    <Button
      onClick={() => {
        setEditing({ mode: 'new' })
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

      {properties.isPending ? (
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{property.name}</span>
                        <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
                      </div>
                      {apartmentLine(property) && (
                        <p className="text-muted-foreground text-xs">{apartmentLine(property)}</p>
                      )}
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
                              setEditing({ mode: 'edit', property })
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
                              setDeleting(property)
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
        open={editing.mode !== 'closed'}
        property={editing.mode === 'edit' ? editing.property : undefined}
        onOpenChange={(open) => {
          if (!open) setEditing({ mode: 'closed' })
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Excluir imóvel?"
        description={
          deleting ? `"${deleting.name}" será excluído. Isso não pode ser desfeito.` : ''
        }
        confirmLabel="Excluir"
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
