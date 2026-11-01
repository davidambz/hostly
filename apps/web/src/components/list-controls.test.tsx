import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PaginationBar } from './pagination-bar'
import { SEARCH_DEBOUNCE_MS, SearchInput } from './search-input'

describe('SearchInput', () => {
  it('reports the trimmed text once the user pauses, not on every key', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const onSearch = vi.fn()
    const user = userEvent.setup({ delay: 50, advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    render(<SearchInput label="Buscar" value="" onSearch={onSearch} />)

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), ' casa ')
    expect(onSearch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('casa')
    vi.useRealTimers()
  })

  it('clears at once', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchInput label="Buscar" value="casa" onSearch={onSearch} />)

    await user.click(screen.getByRole('button', { name: 'Limpar busca' }))

    expect(onSearch).toHaveBeenCalledWith('')
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })
})

describe('PaginationBar', () => {
  it('shows the range and moves between pages', async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    render(<PaginationBar page={2} pageSize={20} total={45} onPageChange={onPageChange} />)

    expect(screen.getByText('21–40 de 45')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(onPageChange.mock.calls).toEqual([[1], [3]])
  })

  it('disables the ends', () => {
    render(<PaginationBar page={3} pageSize={20} total={45} onPageChange={vi.fn()} />)

    expect(screen.getByText('41–45 de 45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  })

  it('is hidden when everything fits in one page', () => {
    const { container } = render(
      <PaginationBar page={1} pageSize={20} total={20} onPageChange={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('still shows on an empty page past the end, so the user can go back', () => {
    render(<PaginationBar page={4} pageSize={20} total={45} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()
  })
})
