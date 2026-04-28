'use client'

import { useEffect, useRef, useState } from 'react'

export type VirtualKeyboardInputType = 'text' | 'numeric'

export interface VirtualKeyboardState {
  isVisible: boolean
  inputType: VirtualKeyboardInputType
  focusedInput: HTMLInputElement | HTMLTextAreaElement | null
}

const SKIP_TYPES = new Set(['date', 'time', 'datetime-local', 'month', 'week', 'checkbox', 'radio', 'range', 'file', 'color', 'submit', 'button', 'reset', 'image', 'hidden'])

const isKiosk = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true'

export function useVirtualKeyboard(): VirtualKeyboardState {
  const [isVisible, setIsVisible] = useState(false)
  const [inputType, setInputType] = useState<VirtualKeyboardInputType>('text')
  const [focusedInput, setFocusedInput] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isKiosk) return

    function onFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return
      if (target instanceof HTMLInputElement && SKIP_TYPES.has(target.type)) return

      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }

      const numericTypes = new Set(['number', 'tel'])
      const isNumeric =
        (target instanceof HTMLInputElement && numericTypes.has(target.type)) ||
        target.inputMode === 'numeric'

      setFocusedInput(target)
      setInputType(isNumeric ? 'numeric' : 'text')
      setIsVisible(true)
    }

    function onFocusOut() {
      hideTimer.current = setTimeout(() => {
        setIsVisible(false)
        setFocusedInput(null)
      }, 150)
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  if (!isKiosk) return { isVisible: false, inputType: 'text', focusedInput: null }
  return { isVisible, inputType, focusedInput }
}
