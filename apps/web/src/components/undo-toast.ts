import { toast } from 'sonner'

import { errorMessage } from '@/lib/api/form-errors'

/** Long enough to read the notice and reach the button. */
export const UNDO_TOAST_MS = 8000

/**
 * Says something was deleted, with a "Desfazer" button that puts it back. The deletion has
 * already happened (so a refusal, like a property that still has bookings, shows at once);
 * undoing creates the item again from what it was.
 */
export function toastDeleted(
  message: string,
  { restore, restored }: { restore: () => Promise<unknown>; restored: string },
) {
  toast.success(message, {
    duration: UNDO_TOAST_MS,
    action: {
      label: 'Desfazer',
      onClick: () => {
        restore().then(
          () => toast.success(restored),
          (error: unknown) => toast.error(errorMessage(error)),
        )
      },
    },
  })
}
