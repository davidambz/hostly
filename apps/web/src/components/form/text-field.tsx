import { type ComponentProps, type ReactNode, useId } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface TextFieldProps extends ComponentProps<typeof Input> {
  label: string
  error?: string
  hint?: string
  /** Something to place inside the input, at its right edge (e.g. a show-password button). */
  trailing?: ReactNode
}

/** A labelled input whose error and hint are announced with it (aria-describedby). */
export function TextField({
  label,
  error,
  hint,
  trailing,
  className,
  id,
  ...props
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={trailing ? 'pr-10' : undefined}
          {...props}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
