import { MoreHorizontal, SearchX, ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { PaginationBar } from '@/components/pagination-bar'
import { SearchInput } from '@/components/search-input'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { errorMessage } from '@/lib/api/form-errors'

import { useAuth } from '../auth/auth-context'
import { ADMIN_PAGE_SIZE, type AdminUser, useAdminUsers, useSetAdmin } from './api'

/** Every account: its plan, its properties, and the administrator role. */
export function AdminUsersPage() {
  const { user: me } = useAuth()
  const { page, search, setSearch, setPage } = useSearchParamState()
  const users = useAdminUsers({ search, page })
  const setAdmin = useSetAdmin()
  const changing = useOverlay<AdminUser>()
  const pastTheEnd = useClampedPage({
    page,
    pageSize: ADMIN_PAGE_SIZE,
    total: users.data?.total,
    empty: users.data?.items.length === 0,
    goTo: setPage,
  })

  const target = changing.item
  const confirmChange = async () => {
    if (!target) return
    try {
      await setAdmin.mutateAsync({ userId: target.id, isAdmin: !target.isAdmin })
      toast.success(
        target.isAdmin
          ? `${target.name} não é mais administrador.`
          : `${target.name} agora é administrador.`,
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      changing.setOpen(false)
    }
  }

  return (
    <>
      <SearchInput
        label="Buscar conta"
        placeholder="Buscar pelo nome ou e-mail"
        value={search}
        onSearch={setSearch}
      />

      {users.isPending || pastTheEnd ? (
        <LoadingState />
      ) : users.isError ? (
        <ErrorState message={errorMessage(users.error)} onRetry={() => void users.refetch()} />
      ) : users.data.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nada encontrado"
          description={`Nenhuma conta com "${search}" no nome ou no e-mail.`}
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table aria-label="Contas">
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Imóveis</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        {user.isAdmin && <Badge>Admin</Badge>}
                      </div>
                      <div className="text-muted-foreground text-xs">{user.email}</div>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {user.propertyCount}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.plan.name}</Badge>
                    </TableCell>
                    <TableCell>
                      {user.id !== me?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Ações de ${user.name}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                changing.show(user)
                              }}
                            >
                              {user.isAdmin ? (
                                <ShieldOff className="size-4" />
                              ) : (
                                <ShieldCheck className="size-4" />
                              )}
                              {user.isAdmin ? 'Remover administrador' : 'Tornar administrador'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={ADMIN_PAGE_SIZE}
            total={users.data.total}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={changing.open}
        onOpenChange={changing.setOpen}
        title={target?.isAdmin ? 'Remover administrador?' : 'Tornar administrador?'}
        description={
          target?.isAdmin
            ? `${target.name} perde o acesso à administração.`
            : `${target?.name ?? ''} passa a ver e mudar contas, planos e concessões.`
        }
        confirmLabel={target?.isAdmin ? 'Remover' : 'Tornar administrador'}
        pending={setAdmin.isPending}
        onConfirm={() => void confirmChange()}
      />
    </>
  )
}
