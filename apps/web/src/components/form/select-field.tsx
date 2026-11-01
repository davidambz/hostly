import { type ComponentProps, useId } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface SelectFieldProps extends ComponentProps<'select'> {
  label: string
  error?: string
  options: readonly { value: string; label: string }[]
  /** Text of an empty first option; omit to require a choice. */
  emptyLabel?: string
}

/** A labelled native select: keyboard- and screen-reader-friendly, with the input's look. */
export function SelectField({
  label,
  error,
  options,
  emptyLabel,
  className,
  id,
  ...props
}: SelectFieldProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const errorId = `${selectId}-error`

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={selectId}>{label}</Label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        {...props}
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
