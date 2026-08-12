/**
 * Las cinco pantallas del panel, en una sola barra.
 *
 * Antes estaban partidas en dos modos —supervisión y gestión— con un switch
 * arriba: para ir del kanban a la ficha de un cliente había que cambiar de modo
 * primero. Ahora es una sola lista y se salta directo.
 *
 * El modo sigue existiendo para una cosa: solo las pantallas de supervisión
 * usan el filtro de fecha. Se deduce del pathname, así que un link compartido
 * abre siempre donde corresponde.
 */
export type Modo = "supervision" | "gestion";

export interface Tab {
  href: string;
  label: string;
  /** Nombre del icono de lucide-react; el componente resuelve cuál es */
  icono: "operaciones" | "cierre" | "analisis" | "clientes" | "financiaciones";
}

export const TABS: Tab[] = [
  { href: "/operaciones", label: "Operaciones", icono: "operaciones" },
  { href: "/cierre", label: "Cierre", icono: "cierre" },
  { href: "/analisis", label: "Análisis", icono: "analisis" },
  { href: "/gestion/clientes", label: "Clientes", icono: "clientes" },
  { href: "/gestion/planes", label: "Planes", icono: "financiaciones" },
];

export function modoDeRuta(pathname: string): Modo {
  return pathname.startsWith("/gestion") ? "gestion" : "supervision";
}

/** Solo el modo supervisión filtra por fecha; la gestión no */
export function usaFiltroDeFecha(modo: Modo): boolean {
  return modo === "supervision";
}
