/**
 * Las dos caras del panel y sus pestañas.
 *
 * El modo activo se deduce del pathname; no hay estado que sincronizar,
 * así que un link compartido abre siempre donde corresponde.
 */
export type Modo = "supervision" | "gestion";

export interface Tab {
  href: string;
  label: string;
  icono: string;
}

export const MODOS: Record<Modo, { label: string; tabs: Tab[] }> = {
  supervision: {
    label: "Supervisión",
    tabs: [
      { href: "/operaciones", label: "Operaciones", icono: "📋" },
      { href: "/cierre", label: "Cierre", icono: "💰" },
      { href: "/analisis", label: "Análisis", icono: "📊" },
    ],
  },
  gestion: {
    label: "Gestión",
    tabs: [
      { href: "/gestion/clientes", label: "Clientes", icono: "👥" },
      { href: "/gestion/planes", label: "Financiaciones", icono: "🧾" },
    ],
  },
};

export function modoDeRuta(pathname: string): Modo {
  return pathname.startsWith("/gestion") ? "gestion" : "supervision";
}

/** Solo el modo supervisión filtra por fecha; la gestión no */
export function usaFiltroDeFecha(modo: Modo): boolean {
  return modo === "supervision";
}
