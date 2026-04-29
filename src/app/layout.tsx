import type { Metadata } from 'next'
import './globals.css'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { KeyboardOverlay } from '@/components/keyboard/KeyboardOverlay'

export const metadata: Metadata = {
  title: 'FamilyHub Calendar',
  description: 'Unified family calendar — Google, Apple, Outlook in one place',
  manifest: '/manifest.json',
  themeColor: '#0f1117',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={process.env.NEXT_PUBLIC_LOCAL_MODE === 'true' ? 'kiosk-mode' : ''}
        style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <ServiceWorkerRegistration />
        <KeyboardOverlay />
        {children}
      </body>
    </html>
  )
}
