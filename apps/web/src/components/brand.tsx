import { cn } from '@/lib/utils'

/**
 * Hostly's mark: a house-number tile, white enamel in a cobalt frame, with the H painted on
 * it. `inverted` is for dark grounds (the sidebar).
 */
export function BrandMark({
  className,
  inverted = false,
}: {
  className?: string
  inverted?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-display flex size-9 shrink-0 items-center justify-center rounded-[3px] text-xl leading-none',
        'shadow-[inset_0_0_0_2px_currentColor,inset_0_0_0_4px_var(--card)]',
        inverted
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_0_0_2px_var(--sidebar-primary-foreground),inset_0_0_0_4px_var(--sidebar-primary)]'
          : 'bg-card text-cobalt',
        className,
      )}
    >
      H
    </span>
  )
}

/** The mark with the name beside it. */
export function Brand({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark inverted={inverted} />
      <span className="font-display text-xl tracking-tight">Hostly</span>
    </span>
  )
}
