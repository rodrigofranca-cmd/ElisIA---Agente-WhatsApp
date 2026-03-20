import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ElisIA - Agente WhatsApp',
  description: 'Assistente virtual de atendimento'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
