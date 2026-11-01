import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { EmptyState, ErrorState, LoadingState } from './states'

describe('states', () => {
  it('LoadingState announces itself and draws placeholder rows', () => {
    const { container } = render(<LoadingState rows={3} />)

    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(9)
  })

  it('EmptyState shows its title, description and action', () => {
    render(
      <EmptyState
        icon={Home}
        title="Nenhum imóvel"
        description="Cadastre o primeiro."
        action={<button>Novo</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Nenhum imóvel' })).toBeInTheDocument()
    expect(screen.getByText('Cadastre o primeiro.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo' })).toBeInTheDocument()
  })

  it('ErrorState is an alert with an optional retry', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(<ErrorState message="Falhou." onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Falhou.')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    rerender(<ErrorState message="Falhou." />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
