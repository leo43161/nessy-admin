import type { ClienteStatus, EstadoVisible, PagoEstado, PlanStatus } from "@/types";

/** Un pago con alguno de estos estados cuenta como cobrado */
export const ESTADOS_COBRADOS: PagoEstado[] = ["Pagado"];

export function esCobrado(estado: PagoEstado): boolean {
  return ESTADOS_COBRADOS.includes(estado);
}

/** Vencido (derivado): sigue pendiente y la fecha acordada ya pasó */
export function esVencido(estado: PagoEstado, fechaAcordada: string, hoy: string): boolean {
  return estado === "Pendiente" && fechaAcordada < hoy;
}

interface EstadoMeta {
  /** "Cobrado" — texto del chip */
  label: string;
  /** Símbolo para los contadores compactos del encabezado de columna */
  icono: string;
  /** Fondo + borde de la card en el kanban */
  card: string;
  /** Chip de estado */
  chip: string;
  /** Punto de color pleno */
  dot: string;
  /** Fondo de la fila del ledger de cierre */
  fila: string;
  /** Color pleno, para montos y contadores */
  texto: string;
}

/**
 * Un color por estado. Son tres: los dos que guarda la base (N.4) más
 * "Vencido", que se deriva de la fecha y no existe como fila.
 */
export const ESTADO: Record<EstadoVisible, EstadoMeta> = {
  Pagado: {
    label: "Cobrado",
    icono: "✓",
    card: "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-900",
    chip: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
    dot: "bg-green-500",
    fila: "bg-green-50 dark:bg-green-950/40",
    texto: "text-green-600 dark:text-green-400",
  },
  Pendiente: {
    label: "Pendiente",
    icono: "⏳",
    card: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
    fila: "bg-amber-50 dark:bg-amber-950/40",
    texto: "text-amber-600 dark:text-amber-400",
  },
  Vencido: {
    label: "Vencido",
    icono: "⚠",
    card: "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900",
    chip: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    dot: "bg-red-500",
    fila: "bg-red-50 dark:bg-red-950/40",
    texto: "text-red-600 dark:text-red-400",
  },
  // Se fue a cobrar y no se pudo. Va en violeta y no en rojo a propósito: en
  // el kanban hay que poder separar de un vistazo lo que nadie visitó (rojo)
  // de lo que ya se gestionó sin éxito.
  Atrasado: {
    label: "Atrasado",
    icono: "🚩",
    card: "bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-900",
    chip: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    dot: "bg-purple-500",
    fila: "bg-purple-50 dark:bg-purple-950/40",
    texto: "text-purple-600 dark:text-purple-400",
  },
};

export const CLIENTE_STATUS_BADGE: Record<ClienteStatus, string> = {
  Activo: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  Inactivo: "bg-muted text-muted-foreground",
};

export const PLAN_STATUS_BADGE: Record<PlanStatus, string> = {
  Activo: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  Completado: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Incumplido: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  Refinanciado: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export const PLAN_STATUSES: PlanStatus[] = ["Activo", "Completado", "Incumplido", "Refinanciado"];

