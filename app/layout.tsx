import type { Metadata } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { StoreProvider } from "@/components/providers/store-provider";
import { Toaster } from "@/components/ui/sonner";
import { EMPRESA_NOMBRE } from "@/lib/marca";
import "./globals.css";

// Archivo es la tipografía de marca de Preferenciale (brand sheet, sección 05):
// va en toda la interfaz. Space Mono queda para los montos, porque sus números
// son tabulares y alinean las columnas de plata — Archivo no lo hace.
const archivo = Archivo({
  variable: "--font-sans",
  subsets: ["latin"],
  // Los pesos que define el brand sheet.
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${EMPRESA_NOMBRE} — Panel de Cobranzas`,
  description: "Supervisión de cobranzas y gestión de clientes y financiaciones",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${archivo.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <StoreProvider>
            {children}
            <Toaster position="top-center" richColors />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
