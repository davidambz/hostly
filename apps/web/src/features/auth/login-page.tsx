import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'

import { FormError } from '@/components/form/form-error'
import { PasswordField } from '@/components/form/password-field'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import { applyApiError } from '@/lib/api/form-errors'

import { useAuth } from './auth-context'
import { AuthLayout } from './auth-layout'
import { type LoginValues, loginSchema } from './schemas'

export function LoginPage() {
  const { login } = useAuth()
  const [params] = useSearchParams()
  const accountCreated = params.has('created')
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    // After a signup whose automatic login failed, the e-mail comes along.
    defaultValues: { email: params.get('email') ?? '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // RequireGuest sends the user on once the session is up.
      await login(values)
    } catch (error) {
      applyApiError(error, form.setError, {
        email: 'E-mail inválido.',
        password: 'Senha inválida.',
      })
    }
  })

  const redirect = params.get('redirect')
  const signupLink = redirect
    ? `/cadastro?${new URLSearchParams({ redirect }).toString()}`
    : '/cadastro'

  return (
    <AuthLayout
      title="Entrar"
      subtitle={
        <>
          Ainda não tem conta?{' '}
          <Link
            to={signupLink}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Cadastre-se
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={(event) => void onSubmit(event)} className="grid gap-4">
        {accountCreated && !errors.root && (
          <p role="status" className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
            Conta criada! Entre com seu e-mail e senha para continuar.
          </p>
        )}
        <FormError message={errors.root?.message} />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          autoFocus={!accountCreated}
          error={errors.email?.message}
          {...form.register('email')}
        />
        <PasswordField
          label="Senha"
          autoComplete="current-password"
          autoFocus={accountCreated}
          error={errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
