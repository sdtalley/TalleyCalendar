'use client'

import { useCallback, useRef, useEffect } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import type { SimpleKeyboard } from 'react-simple-keyboard'
import type { VirtualKeyboardInputType } from '@/hooks/useVirtualKeyboard'

interface Props {
  isVisible: boolean
  inputType: VirtualKeyboardInputType
  focusedInput: HTMLInputElement | HTMLTextAreaElement | null
}

// Lazy-initialized on first use (safe for SSR — never called on server)
let nativeInputSetter: ((this: HTMLInputElement, v: string) => void) | undefined
let nativeTextareaSetter: ((this: HTMLTextAreaElement, v: string) => void) | undefined

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  if (!nativeInputSetter) {
    nativeInputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  }
  if (!nativeTextareaSetter) {
    nativeTextareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  }
  if (el instanceof HTMLTextAreaElement) {
    nativeTextareaSetter?.call(el, value)
  } else {
    nativeInputSetter?.call(el, value)
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const QWERTY_LAYOUT = {
  default: [
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    '{lock} a s d f g h j k l ; \' {enter}',
    '{shift} z x c v b n m , . / {shift}',
    '{space}',
  ],
  shift: [
    '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
    '{tab} Q W E R T Y U I O P { } |',
    '{lock} A S D F G H J K L : " {enter}',
    '{shift} Z X C V B N M < > ? {shift}',
    '{space}',
  ],
}

const NUMERIC_LAYOUT = {
  default: [
    '7 8 9',
    '4 5 6',
    '1 2 3',
    '{bksp} 0 {enter}',
  ],
}

const QWERTY_DISPLAY = {
  '{bksp}': '⌫',
  '{enter}': '↵',
  '{shift}': '⇧',
  '{tab}': '↹',
  '{lock}': '⇪',
  '{space}': ' ',
}

const NUMERIC_DISPLAY = {
  '{bksp}': '⌫',
  '{enter}': '↵',
}

export function VirtualKeyboard({ isVisible, inputType, focusedInput }: Props) {
  const keyboardRef = useRef<SimpleKeyboard | null>(null)

  // When the focused input changes, sync keyboard value to current input value
  useEffect(() => {
    if (focusedInput && keyboardRef.current) {
      keyboardRef.current.setInput(focusedInput.value)
    }
  }, [focusedInput])

  const onKeyPress = useCallback((button: string) => {
    const input = focusedInput
    if (!input) return

    if (button === '{shift}' || button === '{lock}' || button === '{tab}') return

    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? input.value.length
    const current = input.value

    if (button === '{bksp}') {
      if (start === end && start > 0) {
        const next = current.slice(0, start - 1) + current.slice(end)
        setNativeValue(input, next)
        requestAnimationFrame(() => input.setSelectionRange(start - 1, start - 1))
      } else if (start !== end) {
        const next = current.slice(0, start) + current.slice(end)
        setNativeValue(input, next)
        requestAnimationFrame(() => input.setSelectionRange(start, start))
      }
      keyboardRef.current?.setInput(input.value)
      return
    }

    if (button === '{enter}') {
      if (input instanceof HTMLTextAreaElement) {
        const next = current.slice(0, start) + '\n' + current.slice(end)
        setNativeValue(input, next)
        requestAnimationFrame(() => input.setSelectionRange(start + 1, start + 1))
        keyboardRef.current?.setInput(input.value)
      } else {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      }
      return
    }

    if (button === '{space}') {
      const next = current.slice(0, start) + ' ' + current.slice(end)
      setNativeValue(input, next)
      requestAnimationFrame(() => input.setSelectionRange(start + 1, start + 1))
      keyboardRef.current?.setInput(input.value)
      return
    }

    // Regular character
    const next = current.slice(0, start) + button + current.slice(end)
    setNativeValue(input, next)
    requestAnimationFrame(() => input.setSelectionRange(start + button.length, start + button.length))
    keyboardRef.current?.setInput(input.value)
  }, [focusedInput])

  return (
    <div
      className="fixed left-0 right-0 bottom-0 transition-transform duration-200 ease-out select-none"
      style={{
        zIndex: 1000,
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}
      // Prevent keyboard clicks from stealing focus away from the input
      onMouseDown={e => e.preventDefault()}
      onPointerDown={e => e.preventDefault()}
    >
      <Keyboard
        keyboardRef={(r: SimpleKeyboard) => { keyboardRef.current = r }}
        onKeyPress={onKeyPress}
        layout={inputType === 'numeric' ? NUMERIC_LAYOUT : QWERTY_LAYOUT}
        display={inputType === 'numeric' ? NUMERIC_DISPLAY : QWERTY_DISPLAY}
        theme="hg-theme-default hg-layout-default familyhub-keyboard"
        mergeDisplay
      />
    </div>
  )
}
