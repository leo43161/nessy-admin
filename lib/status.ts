import type { ClienteStatus, EstadoVisible, PagoEstado, PlanStatus } from "@/types";

/** Un pago con alguno de estos estados cuenta como cobrado */
export const ESTADOS_COBRADOS: PagoEstado[] = ["Pagado", "Adelanto", "Recargo"];

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
 * Un color por estado. La maqueta tenía cinco estados en inglés; acá son
 * seis reales, así que Recargo (cobrado tarde) y Adelanto (cobrado antes)
 * se distinguen del Pagado a secas en vez de mezclarse con él.
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
  Adelanto: {
    label: "Adelanto",
    icono: "⏫",
    card: "bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:border-teal-900",
    chip: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
    dot: "bg-teal-500",
    fila: "bg-teal-50 dark:bg-teal-950/40",
    texto: "text-teal-600 dark:text-teal-400",
  },
  Recargo: {
    label: "Con recargo",
    icono: "💰",
    card: "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-900",
    chip: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
    dot: "bg-violet-500",
    fila: "bg-violet-50 dark:bg-violet-950/40",
    texto: "text-violet-600 dark:text-violet-400",
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
  Incomunicado: {
    label: "Sin contacto",
    icono: "📵",
    card: "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-900",
    chip: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
    dot: "bg-orange-500",
    fila: "bg-orange-50 dark:bg-orange-950/40",
    texto: "text-orange-600 dark:text-orange-400",
  },
};

export const CLIENTE_STATUS_BADGE: Record<ClienteStatus, string> = {
  Activo: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  Inactivo: "bg-muted text-muted-foreground",
  Moroso: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export const PLAN_STATUS_BADGE: Record<PlanStatus, string> = {
  Activo: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  Completado: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Incumplido: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  Refinanciado: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export const PLAN_STATUSES: PlanStatus[] = ["Activo", "Completado", "Incumplido", "Refinanciado"];

export const CLIENTE_STATUSES: ClienteStatus[] = ["Activo", "Inactivo", "Moroso"];
