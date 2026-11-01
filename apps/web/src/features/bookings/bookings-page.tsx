import { CalendarDays, Home, List, Plus } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useOverlay } from '@/hooks/use-overlay'
import { useSearchParamState } from '@/hooks/use-search-param-state'
import { errorMessage } from '@/lib/api/form-errors'

import { useAllProperties } from '../properties/api'
import { type Booking, useDeleteBooking } from './api'
import { type BookingDraft, BookingSheet } from './booking-sheet'
import { BookingsCalendar, type CalendarView } from './bookings-calendar'
import { BookingsList } from './bookings-list'
import { formatStay, todayISO, validDateOrNull } from './dates'
import { colorOf, propertyColors } from './property-colors'

interface SheetState {
  booking?: Booking
  draft?: BookingDraft
}

/**
 * The bookings, as a calendar (default) or a list. Everything that picks what is shown
 * lives in the URL: `?imovel=`, `?modo=lista`, `?visao=semana`, `?data=`, `?status=`,
 * `?q=` and `?page=`.
 */
export function BookingsPage() {
  const { params, page, search, set, update, setSearch, setPage } = useSearchParamState()
  const properties = useAllProperties()
  const propertyId = params.get('imovel') ?? ''
  const mode = params.get('modo') === 'lista' ? 'list' : 'calendar'
  const view: CalendarView = params.get('visao') === 'semana' ? 'week' : 'month'
  const date = validDateOrNull(params.get('data')) ?? todayISO()
  const status = params.get('status') === 'anteriores' ? 'past' : 'upcoming'

  const sheet = useOverlay<SheetState>()
  const deleting = useOverlay<Booking>()
  const remove = useDeleteBooking()

  const colors = useMemo(
    () => propertyColors((properties.data ?? []).map((property) => property.id)),
    [properties.data],
  )
  // A link to a property that is gone (or someone else's) shows every property instead.
  const knownProperty = properties.data?.some((property) => property.id === propertyId) ?? false
  const filter = knownProperty ? propertyId : undefined

  const openBooking = useCallback(
    (booking: Booking) => {
      sheet.show({ booking })
    },
    [sheet],
  )
  const openDraft = useCallback(
    (draft: BookingDraft = {}) => {
      sheet.show({ draft: { propertyId: filter, ...draft } })
    },
    [sheet, filter],
  )
  const selectDays = useCallback(
    (checkIn: string, checkOut: string) => {
      openDraft({ checkIn, checkOut })
    },
    [openDraft],
  )
  const askDelete = useCallback(
    (booking: Booking) => {
      sheet.setOpen(false)
      deleting.show(booking)
    },
    [sheet, deleting],
  )

  const confirmDelete = async () => {
    const booking = deleting.item
    if (!booking) return
    try {
      await remove.mutateAsync(booking.id)
      toast.success(`A reserva de ${booking.guestName} foi excluída.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      deleting.setOpen(false)
    }
  }

  const newButton = (
    <Button
      onClick={() => {
        openDraft()
      }}
      disabled={properties.data?.length === 0}
    >
      <Plus aria-hidden />
      Nova reserva
    </Button>
  )

  if (properties.isPending) {
    return (
      <>
        <PageHeader title="Reservas" description="Quem fica em cada imóvel, e quando." />
        <LoadingState />
      </>
    )
  }
  if (properties.isError) {
    return (
      <>
        <PageHeader title="Reservas" description="Quem fica em cada imóvel, e quando." />
        <ErrorState
          message={errorMessage(properties.error)}
          onRetry={() => void properties.refetch()}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Reservas"
        description="Quem fica em cada imóvel, e quando."
        actions={newButton}
      />

      {properties.data.length === 0 ? (
        <EmptyState
          icon={Home}
          title="Cadastre um imóvel primeiro"
          description="As reservas são de um imóvel. Cadastre a casa ou o apartamento e volte aqui."
          action={
            <Button asChild>
              <Link to="/imoveis">Ir para imóveis</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <label htmlFor="booking-property-filter" className="text-sm font-medium">
                Imóvel
              </label>
              <select
                id="booking-property-filter"
                value={filter ?? ''}
                onChange={(event) => {
                  set('imovel', event.target.value)
                }}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 min-w-48 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                <option value="">Todos os imóveis</option>
                {properties.data.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              className="ml-auto"
              value={mode}
              aria-label="Modo de exibição"
              onValueChange={(value) => {
                if (value === 'calendar' || value === 'list') {
                  set('modo', value === 'list' ? 'lista' : undefined)
                }
              }}
            >
              <ToggleGroupItem value="calendar" aria-label="Calendário">
                <CalendarDays aria-hidden />
                <span className="hidden sm:inline">Calendário</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Lista">
                <List aria-hidden />
                <span className="hidden sm:inline">Lista</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {mode === 'calendar' ? (
            <>
              <BookingsCalendar
                view={view}
                date={date}
                propertyId={filter}
                colors={colors}
                onViewChange={(next, day) => {
                  update({
                    visao: next === 'week' ? 'semana' : undefined,
                    ...(day && { data: day }),
                  })
                }}
                onDateChange={(next) => {
                  set('data', next === todayISO() ? undefined : next)
                }}
                onSelectDays={selectDays}
                onOpenBooking={openBooking}
              />
              {!filter && (
                <ul
                  aria-label="Cores dos imóveis"
                  className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
                >
                  {properties.data.map((property) => (
                    <li key={property.id} className="flex items-center gap-1.5">
                      <span
                        className={`size-2.5 rounded-full ${colorOf(colors, property.id).dot}`}
                        aria-hidden
                      />
                      {property.name}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <BookingsList
              status={status}
              search={search}
              page={page}
              propertyId={filter}
              colors={colors}
              onStatusChange={(next) => {
                set('status', next === 'past' ? 'anteriores' : undefined)
              }}
              onSearch={setSearch}
              onPageChange={setPage}
              onOpenBooking={openBooking}
              onDeleteBooking={askDelete}
            />
          )}
        </>
      )}

      <BookingSheet
        open={sheet.open}
        booking={sheet.item?.booking}
        draft={sheet.item?.draft}
        onOpenChange={sheet.setOpen}
        onDelete={askDelete}
      />

      <ConfirmDialog
        open={deleting.open}
        onOpenChange={deleting.setOpen}
        title="Excluir reserva?"
        description={
          deleting.item
            ? `A reserva de ${deleting.item.guestName} em ${deleting.item.property.name} (${formatStay(deleting.item.checkIn, deleting.item.checkOut)}) será excluída. Isso não pode ser desfeito.`
            : ''
        }
        confirmLabel="Excluir"
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
