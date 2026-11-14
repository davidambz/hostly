import { type ComponentProps, useId } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface TextareaFieldProps extends ComponentProps<'textarea'> {
  label: string
  error?: string
  hint?: string
}

/** A labelled multi-line field, styled like the inputs, its error and hint announced with it. */
export function TextareaField({ label, error, hint, className, id, ...props }: TextareaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  const showHint = Boolean(hint) && !error
  const describedBy = [error ? errorId : null, showHint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      <textarea
        id={fieldId}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'border-input placeholder:text-muted-foreground dark:bg-input/30 min-h-20 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        )}
        {...props}
      />
      {showHint && (
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
