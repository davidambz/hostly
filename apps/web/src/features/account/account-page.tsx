import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormError } from '@/components/form/form-error'
import { PasswordField } from '@/components/form/password-field'
import { TextField } from '@/components/form/text-field'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { applyApiError, errorMessage } from '@/lib/api/form-errors'

import * as authApi from '../auth/api'
import { useAuth } from '../auth/auth-context'
import {
  PASSWORD_MIN_LENGTH,
  type PasswordChangeValues,
  passwordChangeSchema,
  type ProfileValues,
  profileSchema,
} from '../auth/schemas'

/** The account: name and e-mail, the password, and the other devices logged in. */
export function AccountPage() {
  return (
    <>
      <PageHeader title="Conta" description="Seus dados de acesso ao Hostly." />
      <div className="grid max-w-2xl gap-6">
        <ProfileSection />
        <PasswordSection />
        <DevicesSection />
      </div>
    </>
  )
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="bg-card grid gap-4 rounded-md border p-5">
      <div className="grid gap-1">
        <h2 id={id} className="font-wide text-lg font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  )
}

function ProfileSection() {
  const { user, setUser } = useAuth()
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  })
  const { errors, isSubmitting, isDirty } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const updated = await authApi.updateProfile(values)
      setUser(updated)
      form.reset({ name: updated.name, email: updated.email })
      toast.success('Dados salvos.')
    } catch (error) {
      applyApiError(error, form.setError, { name: 'Nome inválido.', email: 'E-mail inválido.' })
    }
  })

  return (
    <Section
      id="profile-title"
      title="Seus dados"
      description="O nome e o e-mail com que você entra."
    >
      <form noValidate onSubmit={(event) => void onSubmit(event)} className="grid gap-4">
        <FormError message={errors.root?.message} />
        <TextField
          label="Nome"
          autoComplete="name"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <div>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Salvar dados
          </Button>
        </div>
      </form>
    </Section>
  )
}

function PasswordSection() {
  const form = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      form.reset()
      toast.success('Senha trocada. Os outros aparelhos precisam entrar de novo.')
    } catch (error) {
      applyApiError(error, form.setError, {
        currentPassword: 'Senha atual inválida.',
        newPassword: 'Senha inválida.',
      })
    }
  })

  return (
    <Section
      id="password-title"
      title="Senha"
      description="Ao trocar a senha, os outros aparelhos saem da conta; este continua."
    >
      <form noValidate onSubmit={(event) => void onSubmit(event)} className="grid gap-4">
        <FormError message={errors.root?.message} />
        <PasswordField
          label="Senha atual"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...form.register('currentPassword')}
        />
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          hint={`Pelo menos ${String(PASSWORD_MIN_LENGTH)} caracteres.`}
          error={errors.newPassword?.message}
          {...form.register('newPassword')}
        />
        <PasswordField
          label="Confirme a nova senha"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...form.register('confirmPassword')}
        />
        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Trocar senha
          </Button>
        </div>
      </form>
    </Section>
  )
}

function DevicesSection() {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  const logoutOthers = async () => {
    setPending(true)
    try {
      await authApi.logoutOthers()
      toast.success('Os outros aparelhos saíram da conta.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  return (
    <Section
      id="devices-title"
      title="Outros aparelhos"
      description="Esqueceu a conta aberta num computador ou celular? Tire todos os outros aparelhos da conta; este continua."
    >
      <div>
        <Button
          variant="outline"
          onClick={() => {
            setConfirming(true)
          }}
        >
          Sair dos outros aparelhos
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Sair dos outros aparelhos?"
        description="Todos os outros aparelhos vão precisar entrar de novo. Este continua na conta."
        confirmLabel="Sair dos outros"
        pending={pending}
        onConfirm={() => void logoutOthers()}
      />
    </Section>
  )
}
