'use client'

import { useVirtualKeyboard } from '@/hooks/useVirtualKeyboard'
import { VirtualKeyboard } from './VirtualKeyboard'

export function KeyboardOverlay() {
  const keyboard = useVirtualKeyboard()
  return (
    <VirtualKeyboard
      isVisible={keyboard.isVisible}
      inputType={keyboard.inputType}
      focusedInput={keyboard.focusedInput}
    />
  )
}
