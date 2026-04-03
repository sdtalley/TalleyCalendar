import type { Metadata } from 'next'
import './globals.css'

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
      <body style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </body>
    </html>
  )
}
