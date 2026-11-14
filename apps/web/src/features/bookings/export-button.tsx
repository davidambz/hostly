import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { unwrap } from '@/lib/api/errors'
import { api } from '@/lib/api/client'
import { errorMessage } from '@/lib/api/form-errors'
import { downloadFile } from '@/lib/download'

import { bookingKeys } from './api'
import { parseDate } from './dates'
import { bookingsCsv, csvFileName } from './export-csv'
import { monthBounds } from './occupancy'

/**
 * Saves the month's bookings (those checking in during it) as a spreadsheet, for the
 * property shown or all of them.
 */
export function ExportButton({
  date,
  propertyId,
  propertyName,
}: {
  date: string
  propertyId?: string
  propertyName?: string
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const bounds = monthBounds(date)
  const monthName = format(parseDate(bounds.from), 'MMMM', { locale: ptBR })

  const exportMonth = async () => {
    setBusy(true)
    try {
      const query = { ...bounds, propertyId }
      // The same data the calendar asks for, so a month already on screen costs nothing.
      const bookings = await queryClient.query({
        queryKey: bookingKeys.calendar(query),
        queryFn: async () => unwrap(await api.GET('/bookings/calendar', { params: { query } })),
      })
      downloadFile(csvFileName(date, propertyName), bookingsCsv(date, bookings))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" onClick={() => void exportMonth()} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      Exportar {monthName}
    </Button>
  )
}
