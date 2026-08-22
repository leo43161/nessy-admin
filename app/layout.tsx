import type { Metadata, Viewport } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { StoreProvider } from "@/components/providers/store-provider";
import { Toaster } from "@/components/ui/sonner";
import { RegistrarSW } from "@/components/providers/registrar-sw";
import { EMPRESA_NOMBRE, MARCA_COLORES } from "@/lib/marca";
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
  // iOS no lee el manifiesto: para "Agregar a pantalla de inicio" necesita
  // estas dos cosas o abre la app dentro de Safari, con la barra y todo.
  appleWebApp: {
    capable: true,
    title: EMPRESA_NOMBRE,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // Pinta la barra del navegador con el color de marca en vez del gris del
  // sistema. Con la app instalada es el borde de arriba de la pantalla.
  themeColor: MARCA_COLORES.primario,
  // El panel se usa en el celular y tiene tablas: dejar hacer zoom es lo que
  // permite leer una fila apretada. Bloquearlo sería cómodo para el layout y
  // un problema para quien no ve bien.
  maximumScale: 5,
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
            <RegistrarSW />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
