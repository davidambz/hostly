import { CalendarX, MoreHorizontal, Pencil, SearchX, Trash2 } from 'lucide-react'

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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClampedPage } from '@/hooks/use-clamped-page'
import { errorMessage } from '@/lib/api/form-errors'
import { formatBRL } from '@/lib/money'

import { type Booking, type BookingStatus, PAGE_SIZE, useBookings } from './api'
import { formatStay, nightsLabel } from './dates'
import { colorOf, type PropertyColor } from './property-colors'

/** Upcoming or past stays as a table, with search by guest and pages. */
export function BookingsList({
  status,
  search,
  page,
  propertyId,
  colors,
  onStatusChange,
  onSearch,
  onPageChange,
  onOpenBooking,
  onDeleteBooking,
}: {
  status: BookingStatus
  search: string
  page: number
  propertyId?: string
  colors: Map<string, PropertyColor>
  onStatusChange: (status: BookingStatus) => void
  onSearch: (search: string) => void
  onPageChange: (page: number) => void
  onOpenBooking: (booking: Booking) => void
  onDeleteBooking: (booking: Booking) => void
}) {
  const bookings = useBookings({ status, search, page, propertyId })
  const pastTheEnd = useClampedPage({
    page,
    pageSize: PAGE_SIZE,
    total: bookings.data?.total,
    empty: bookings.data?.items.length === 0,
    goTo: onPageChange,
  })

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(value) => {
            if (value === 'upcoming' || value === 'past') onStatusChange(value)
          }}
        >
          <TabsList>
            <TabsTrigger value="upcoming">Próximas</TabsTrigger>
            <TabsTrigger value="past">Anteriores</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput
          label="Buscar hóspede"
          placeholder="Buscar pelo hóspede"
          value={search}
          onSearch={onSearch}
        />
      </div>

      {bookings.isPending || pastTheEnd ? (
        <LoadingState />
      ) : bookings.isError ? (
        <ErrorState
          message={errorMessage(bookings.error)}
          onRetry={() => void bookings.refetch()}
        />
      ) : bookings.data.items.length === 0 ? (
        search ? (
          <EmptyState
            icon={SearchX}
            title="Nada encontrado"
            description={`Nenhuma reserva com "${search}" no nome do hóspede.`}
          />
        ) : (
          <EmptyState
            icon={CalendarX}
            title={status === 'upcoming' ? 'Nenhuma reserva por vir' : 'Nenhuma reserva passada'}
            description={
              status === 'upcoming'
                ? 'As próximas estadias aparecem aqui, da mais próxima para a mais distante.'
                : 'As estadias que já acabaram aparecem aqui, da mais recente para a mais antiga.'
            }
          />
        )
      ) : (
        <>
          <div className="rounded-lg border">
            <Table aria-label={status === 'upcoming' ? 'Próximas reservas' : 'Reservas anteriores'}>
              <TableHeader>
                <TableRow>
                  <TableHead>Hóspede</TableHead>
                  <TableHead>Estadia</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Total</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Falta receber</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.data.items.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => {
                          onOpenBooking(booking)
                        }}
                      >
                        {booking.guestName}
                      </button>
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <span
                          className={`size-2 shrink-0 rounded-full ${colorOf(colors, booking.property.id).dot}`}
                          aria-hidden
                        />
                        {booking.property.name}
                        {booking.broker && ` · via ${booking.broker.name}`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{formatStay(booking.checkIn, booking.checkOut)}</p>
                      <p className="text-muted-foreground text-xs">{nightsLabel(booking.nights)}</p>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {formatBRL(booking.financials.total)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {booking.financials.balanceDue === 0 ? (
                        <Badge variant="secondary">Quitado</Badge>
                      ) : (
                        formatBRL(booking.financials.balanceDue)
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ações da reserva de ${booking.guestName}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              onOpenBooking(booking)
                            }}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              onDeleteBooking(booking)
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
            total={bookings.data.total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  )
}
