/**
 * El armado de una financiación: del total y el interés al cronograma.
 *
 * Todo el cálculo vive acá y es puro, para que se pueda chequear sin montar la
 * pantalla. La regla de negocio que manda es una sola:
 *
 *   **el monto por cuota decide la cantidad de cuotas**, no al revés.
 *
 * El admin dice "quiero cuotas de 20.000" y el sistema saca cuántas hacen
 * falta. Se puede tocar la cantidad en su lugar, y entonces se recalcula el
 * monto — pero el que redondea siempre es el mismo: el resto va a la última
 * cuota, así el cronograma suma exactamente el total financiado.
 */

/** Cada cuánto vence una cuota */
export type Periodo = "Mensual" | "Quincenal" | "Semanal" | "Diaria" | "Manual";

export interface Cronograma {
  /** Cada cuánto: mes, quincena, semana o día */
  periodo: Periodo;
  /**
   * Cuántas unidades del período pasan entre cuota y cuota. Solo aplica a
   * Semanal (1 a 4), Diaria (1 a 7) y Manual (los días que quieran).
   */
  cada: number;
  primeraFecha: string;
}

export interface Cuota {
  fecha: string;
  monto: number;
}

export interface Resumen {
  /** Lo que el cliente termina debiendo: capital + interés */
  totalFinanciado: number;
  cuotas: Cuota[];
  /** Vencimiento de la última cuota */
  ultimaFecha: string;
  /** Días entre la primera y la última */
  duracionDias: number;
}

const CENTAVOS = 100;

/** Total con interés aplicado. 100.000 al 25% → 125.000 */
export function totalConInteres(montoTotal: number, interesPct: number): number {
  return redondear(montoTotal * (1 + interesPct / 100));
}

/**
 * Cuántas cuotas de ese valor hacen falta para cubrir el total.
 *
 * Redondea para arriba: si sobra una fracción, es una cuota más —más chica—,
 * no una cuota menos. 105.000 en cuotas de 20.000 son 6, no 5.
 */
export function cuotasNecesarias(total: number, montoPorCuota: number): number {
  if (montoPorCuota <= 0 || total <= 0) return 0;
  return Math.ceil(centavos(total) / centavos(montoPorCuota));
}

/** Cuánto sale cada cuota si el total se parte en esa cantidad */
export function montoPorCuota(total: number, cantidad: number): number {
  if (cantidad <= 0) return 0;
  // Para abajo: lo que falte se lo lleva la última cuota, nunca se cobra de más.
  return Math.floor(centavos(total) / cantidad) / CENTAVOS;
}

/**
 * Reparte el total en `cantidad` cuotas.
 *
 * Todas valen igual salvo la última, que se queda con la diferencia. Es lo que
 * hace que 25.000 en 12 cuotas sume 25.000 y no 24.999,96.
 */
export function repartir(total: number, cantidad: number): number[] {
  if (cantidad <= 0 || total <= 0) return [];

  const base = Math.floor(centavos(total) / cantidad);
  const montos = Array.from({ length: cantidad }, () => base);
  montos[cantidad - 1] += centavos(total) - base * cantidad;

  return montos.map((c) => c / CENTAVOS);
}

/**
 * Fechas de vencimiento.
 *
 * "Mensual" cae **el mismo día de cada mes**, no cada 30 días corridos: un plan
 * que arranca un día 10 vence todos los 10. Cuando el día no existe en el mes
 * (un 31 en febrero) cae en el último día de ese mes, y el mes siguiente
 * vuelve al 31 — el día pactado no se pierde por el camino.
 */
export function fechasDeCuotas(cronograma: Cronograma, cantidad: number): string[] {
  const { periodo, cada, primeraFecha } = cronograma;

  if (periodo === "Mensual") {
    return Array.from({ length: cantidad }, (_, i) => sumarMeses(primeraFecha, i));
  }

  const paso =
    periodo === "Quincenal" ? 15 : periodo === "Semanal" ? 7 * cada : Math.max(1, cada);

  return Array.from({ length: cantidad }, (_, i) => sumarDias(primeraFecha, i * paso));
}

/** El cronograma completo, listo para mandar a la API */
export function calcularResumen(
  montoTotal: number,
  interesPct: number,
  cantidad: number,
  cronograma: Cronograma,
  /** Fechas cargadas a mano; si vienen, mandan sobre el período */
  fechasManuales?: string[],
): Resumen {
  const total = totalConInteres(montoTotal, interesPct);
  const fechas =
    fechasManuales && fechasManuales.length > 0
      ? [...fechasManuales].sort()
      : fechasDeCuotas(cronograma, cantidad);

  const montos = repartir(total, fechas.length);
  const cuotas = fechas.map((fecha, i) => ({ fecha, monto: montos[i] ?? 0 }));
  const ultimaFecha = fechas[fechas.length - 1] ?? cronograma.primeraFecha;

  return {
    totalFinanciado: total,
    cuotas,
    ultimaFecha,
    duracionDias: diasEntre(cronograma.primeraFecha, ultimaFecha),
  };
}

/**
 * Cómo se describe el atraso de una cuota.
 *
 * No siempre está vencida: el cobrador puede marcar "no pude cobrar" **antes**
 * del vencimiento —fue, el cliente no estaba, y lo deja registrado—. Ahí los
 * días dan negativo y el texto decía "vencidos hace -12 días".
 */
export function textoAtraso(dias: number): string {
  if (dias > 0) return `vencidos hace ${dias} ${dias === 1 ? "día" : "días"}`;
  if (dias === 0) return "vencen hoy";
  return `vencen en ${-dias} ${dias === -1 ? "día" : "días"}`;
}

/** "5 meses y 12 días" — para mostrar cuánto dura la financiación */
export function duracionEnPalabras(dias: number): string {
  if (dias <= 0) return "un solo pago";
  if (dias < 31) return `${dias} ${dias === 1 ? "día" : "días"}`;

  const meses = Math.floor(dias / 30);
  const resto = dias % 30;
  const m = `${meses} ${meses === 1 ? "mes" : "meses"}`;

  return resto === 0 ? m : `${m} y ${resto} ${resto === 1 ? "día" : "días"}`;
}

/* ────────────────────────── fechas ────────────────────────── */

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

/**
 * Mismo día del mes, N meses después.
 *
 * `setMonth` solo no alcanza: al 31 de enero le suma un mes y devuelve el 2 o 3
 * de marzo, porque febrero no tiene 31. Acá se recorta al último día del mes
 * destino, y como siempre se cuenta desde la fecha original, el mes que sí
 * tiene 31 vuelve a caer 31.
 */
export function sumarMeses(iso: string, meses: number): string {
  const base = new Date(`${iso}T00:00:00`);
  const dia = base.getDate();

  const destino = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimoDelMes = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();

  destino.setDate(Math.min(dia, ultimoDelMes));
  return aISO(destino);
}

export function diasEntre(desde: string, hasta: string): number {
  const ms = new Date(`${hasta}T00:00:00`).getTime() - new Date(`${desde}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function redondear(n: number): number {
  return Math.round(n * CENTAVOS) / CENTAVOS;
}

/** A centavos enteros: en decimales, 0.1 + 0.2 no da 0.3 */
function centavos(n: number): number {
  return Math.round(n * CENTAVOS);
}
