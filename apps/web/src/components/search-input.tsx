import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const SEARCH_DEBOUNCE_MS = 300

/** A search box that reports what was typed once the user pauses. */
export function SearchInput({
  value,
  onSearch,
  label,
  placeholder,
}: {
  value: string
  onSearch: (value: string) => void
  label: string
  placeholder?: string
}) {
  const [text, setText] = useState(value)

  useEffect(() => {
    if (text.trim() === value) return
    const timer = setTimeout(() => {
      onSearch(text.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [text, value, onSearch])

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
        }}
        className="pr-9 pl-9"
      />
      {text && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
          aria-label="Limpar busca"
          onClick={() => {
            setText('')
            onSearch('')
          }}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}
