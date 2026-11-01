import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

import { TextField, type TextFieldProps } from './text-field'

/** A password input with a button to show what was typed. */
export function PasswordField(props: Omit<TextFieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
          aria-pressed={visible}
          onClick={() => {
            setVisible((value) => !value)
          }}
        >
          <Icon className="size-4" />
        </Button>
      }
    />
  )
}
