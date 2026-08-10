import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Central de Atendimento do RH · Grupo TEA",
  description:
    "Canal único para solicitações de RH do Grupo TEA: contratos, pagamentos, benefícios, férias, atestados e mais.",
  robots: { index: false, follow: false },
  icons: { icon: "/icone.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09a497",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
