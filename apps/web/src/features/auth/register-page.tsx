import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'

import { FormError } from '@/components/form/form-error'
import { PasswordField } from '@/components/form/password-field'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import { applyApiError } from '@/lib/api/form-errors'
import { maskCpf, maskPhone } from '@/lib/validation/brazil'

import { useAuth } from './auth-context'
import { AuthLayout } from './auth-layout'
import { PASSWORD_MIN_LENGTH, type RegisterValues, registerSchema } from './schemas'

const API_FIELDS = ['name', 'email', 'cpf', 'phone', 'password'] as const

export function RegisterPage() {
  const { register: registerAccount } = useAuth()
  const [params] = useSearchParams()
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', cpf: '', phone: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  /** Registers a field whose value is reformatted with `mask` as the user types. */
  const masked = (name: 'cpf' | 'phone', mask: (value: string) => string) => {
    const field = form.register(name)
    return {
      ...field,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        event.target.value = mask(event.target.value)
        return field.onChange(event)
      },
    }
  }

  const onSubmit = form.handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    try {
      await registerAccount(values)
    } catch (error) {
      applyApiError(error, form.setError, API_FIELDS)
    }
  })

  const loginLink = params.has('redirect') ? `/login?${params.toString()}` : '/login'

  return (
    <AuthLayout
      title="Criar conta"
      subtitle={
        <>
          Já tem conta?{' '}
          <Link
            to={loginLink}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={(event) => void onSubmit(event)} className="grid gap-4">
        <FormError message={errors.root?.message} />
        <TextField
          label="Nome"
          autoComplete="name"
          autoFocus
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
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="CPF"
            inputMode="numeric"
            placeholder="000.000.000-00"
            error={errors.cpf?.message}
            {...masked('cpf', maskCpf)}
          />
          <TextField
            label="Telefone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(00) 00000-0000"
            error={errors.phone?.message}
            {...masked('phone', maskPhone)}
          />
        </div>
        <PasswordField
          label="Senha"
          autoComplete="new-password"
          hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`}
          error={errors.password?.message}
          {...form.register('password')}
        />
        <PasswordField
          label="Confirme a senha"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...form.register('confirmPassword')}
        />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  )
}
