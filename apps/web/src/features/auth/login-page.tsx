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
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // RequireGuest sends the user on once the session is up.
      await login(values)
    } catch (error) {
      applyApiError(error, form.setError, ['email', 'password'])
    }
  })

  const signupLink = params.has('redirect') ? `/cadastro?${params.toString()}` : '/cadastro'

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
        <FormError message={errors.root?.message} />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...form.register('email')}
        />
        <PasswordField
          label="Senha"
          autoComplete="current-password"
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
