import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'TradeNews' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, background: '#0f0f0f' }}>{children}</body>
    </html>
  )
}
