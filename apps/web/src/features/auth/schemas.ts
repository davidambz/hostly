import { z } from 'zod'

import { isValidCpf, isValidPhone } from '@/lib/validation/brazil'

export const PASSWORD_MIN_LENGTH = 8

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
  password: z.string().min(1, 'Informe sua senha.'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe seu nome.').max(255, 'Nome longo demais.'),
    email: z.string().trim().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
    cpf: z.string().refine(isValidCpf, 'CPF inválido.'),
    phone: z.string().refine(isValidPhone, 'Telefone inválido. Use DDD + número.'),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      .max(128, 'Senha longa demais.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

export type RegisterValues = z.infer<typeof registerSchema>
