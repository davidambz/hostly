import { cn } from '@/lib/utils'

/**
 * Hostly's mark: a sounding on a chart, the H set wide over a waterline. `inverted` is for the
 * dark top bar.
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
        'font-wide relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md text-base leading-none font-extrabold',
        inverted ? 'bg-bar-active text-depth-4-foreground' : 'bg-primary text-primary-foreground',
        className,
      )}
    >
      <span className="-mt-1">H</span>
      <span className="absolute inset-x-1.5 bottom-1.5 h-px bg-current opacity-60" />
    </span>
  )
}

/** The mark with the name beside it. */
export function Brand({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark inverted={inverted} />
      <span className="font-wide text-lg font-bold">Hostly</span>
    </span>
  )
}
