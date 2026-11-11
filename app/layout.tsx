import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessaoProvider } from "@/lib/sessao";
import { AvisosProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "Beb's Gestão",
  description: "PDV e estoque da Beb's Adega e Tabacaria.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#070914", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AvisosProvider>
          <SessaoProvider>{children}</SessaoProvider>
        </AvisosProvider>
      </body>
    </html>
  );
}
