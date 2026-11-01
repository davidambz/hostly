import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** "1–20 de 45" with previous/next. Hidden when everything fits in one page. */
export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize && page === 1) return null
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
      <p className="text-muted-foreground">
        {first}–{last} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1)
          }}
        >
          <ChevronLeft aria-hidden />
          Anterior
        </Button>
        <span className="text-muted-foreground" aria-current="page">
          Página {page} de {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => {
            onPageChange(page + 1)
          }}
        >
          Próxima
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
