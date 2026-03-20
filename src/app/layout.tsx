import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ElisIA - Agente WhatsApp",
  description: "Assistente virtual de atendimento e vendas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
