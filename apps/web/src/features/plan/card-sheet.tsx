import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Loader2, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { ErrorState, LoadingState } from '@/components/states'
import { useTheme } from '@/components/theme/theme-context'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { errorMessage } from '@/lib/api/form-errors'

import { useBillingConfig, useCardSetup, useSetCard } from './api'
import { cardAppearance, cardFonts } from './card-appearance'
import { stripeFor } from './stripe'

/**
 * Swapping the card the subscription is charged on, without leaving the app: Stripe's card
 * fields save the new card, and the API makes it the one the renewals use.
 */
export function CardSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const config = useBillingConfig(open)
  const { resolvedTheme } = useTheme()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Trocar o cartão</SheetTitle>
          <SheetDescription>
            As próximas cobranças da assinatura vão para o cartão novo. Nada é cobrado agora.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4 pb-6">
          {config.isPending ? (
            <LoadingState rows={2} />
          ) : config.isError ? (
            <ErrorState
              message={errorMessage(config.error)}
              onRetry={() => void config.refetch()}
            />
          ) : (
            <Elements
              key={resolvedTheme}
              stripe={stripeFor(config.data.publishableKey)}
              options={{
                mode: 'setup',
                currency: 'brl',
                locale: 'pt-BR',
                appearance: cardAppearance(resolvedTheme === 'dark'),
                fonts: cardFonts(),
              }}
            >
              <CardForm
                onSaved={() => {
                  onOpenChange(false)
                }}
              />
            </Elements>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CardForm({ onSaved }: { onSaved: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const setup = useCardSetup()
  const setCard = useSetCard()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const save = async () => {
    if (!stripe || !elements) return
    setSaving(true)
    setError(null)
    try {
      const checked = await elements.submit()
      if (checked.error) {
        setError(checked.error.message ?? 'Confira os dados do cartão.')
        return
      }
      const { clientSecret } = await setup.mutateAsync()
      const result = await stripe.confirmSetup({
        elements,
        clientSecret,
        // Only when the bank's check (3D Secure) needs a page of its own.
        confirmParams: { return_url: `${window.location.origin}/plano` },
        redirect: 'if_required',
      })
      if (result.error) {
        setError(result.error.message ?? 'O cartão não foi aceito.')
        return
      }
      const method = result.setupIntent.payment_method
      const id = typeof method === 'string' ? method : method?.id
      if (!id) {
        setError('O cartão não foi salvo. Tente de novo.')
        return
      }
      await setCard.mutateAsync(id)
      toast.success('Cartão trocado. As próximas cobranças vão para ele.')
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <PaymentElement
        options={{ layout: 'tabs' }}
        onReady={() => {
          setReady(true)
        }}
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={!stripe || !ready || saving}>
        {saving && <Loader2 className="animate-spin" aria-hidden />}
        Salvar cartão
      </Button>
      <p className="text-muted-foreground flex items-start gap-2 text-xs text-pretty">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Os dados do cartão vão direto para a Stripe; o Hostly não os vê nem guarda.
      </p>
    </form>
  )
}
