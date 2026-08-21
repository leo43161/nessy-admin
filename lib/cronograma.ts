// Relativo y con extensión: este archivo corre también fuera del bundler,
// desde `npm run check` (ver cronograma.check.ts).
import { sumarDias } from "./cuotas.ts";

/**
 * El cronograma que va a quedar, para las cuatro operaciones que lo tocan.
 *
 *   editar         cambia el total del plan y rehace las cuotas pendientes
 *   refinanciar    la deuda vieja + penalización, cuotas nuevas
 *   renovar        más plata acoplada al final, sin tocar lo agendado
 *   reestructurar  la misma deuda, repartida en cuotas de otro tamaño
 *
 * Existe porque el admin tiene que **ver el cronograma antes de confirmarlo**.
 * Las tres últimas dan de baja las cuotas impagas y las reemplazan: si el
 * monto estaba mal tipeado, cuando se nota ya no hay vuelta atrás desde el
 * panel.
 *
 * ⚠️ **Las cuatro no reparten igual, y no es una elección de esta capa.**
 * Editar pasa por `PUT /cuotas`, donde el panel manda fecha y monto de cada
 * cuota, así que puede repartir parejo. Las otras tres las genera un stored
 * procedure que hace `FLOOR(total / cuota)` cuotas enteras y una última por el
 * resto. Reproducir cada regla donde corresponde es todo el punto de este
 * archivo: una previa que no coincida con lo que la base va a escribir es peor
 * que no mostrar nada.
 */

export type Operacion = "editar" | "refinanciar" | "renovar" | "reestructurar";

/** Una cuota del cronograma, ya sea de las que están o de las que van a estar */
export interface Cuota {
  fecha: string;
  monto: number;
}

/** Una cuota tal como está hoy en la base */
export interface CuotaExistente extends Cuota {
  estado: string;
}

/**
 * Cómo queda partido el cronograma actual.
 *
 * El corte es el que hacen los SP y `PUT /cuotas`: **lo pagado y lo atrasado no
 * se toca**. Lo pagado es historia; lo atrasado conserva su `fecha_acordada`
 * original, que es de donde sale el cálculo de la mora y la Deuda Crítica —
 * moverla borraría el rastro del atraso.
 */
export interface CorteDelPlan {
  pagadas: CuotaExistente[];
  atrasadas: CuotaExistente[];
  pendientes: CuotaExistente[];
  /** Suma de lo pagado */
  cobrado: number;
  /** Suma de lo atrasado: sigue debiéndose, pero no se puede reprogramar */
  atrasado: number;
  /** Suma de lo pendiente: esto es lo que se reemplaza */
  pendiente: number;
}

export function partirPorEstado(cuotas: CuotaExistente[]): CorteDelPlan {
  // Ordenadas por fecha, no en el orden en que las devolvió la API. El diálogo
  // de edición compara el cronograma calculado contra `pendientes` posición
  // por posición para saber si algo cambió: desordenadas, un plan intacto se
  // veía como "40 cuotas se dan de baja y 40 se crean".
  const porFecha = (a: CuotaExistente, b: CuotaExistente) => a.fecha.localeCompare(b.fecha);

  const pagadas = cuotas.filter((c) => c.estado === "Pagado").sort(porFecha);
  const atrasadas = cuotas.filter((c) => c.estado === "Atrasado").sort(porFecha);
  const pendientes = cuotas.filter((c) => c.estado === "Pendiente").sort(porFecha);

  return {
    pagadas,
    atrasadas,
    pendientes,
    cobrado: sumar(pagadas),
    atrasado: sumar(atrasadas),
    pendiente: sumar(pendientes),
  };
}

/**
 * Qué cuotas se dan de baja en cada operación. **Comprobado contra los SP**,
 * porque es lo que el diálogo le promete al admin antes de confirmar:
 *
 *   editar         `sp_Editar-PagoPorRealizar` → solo `Estado = 'Pendiente'`.
 *                  Las atrasadas sobreviven con su fecha original.
 *   refinanciar    `Estado IN ('Pendiente','Atrasado')`. Sobrevive lo pagado.
 *   reestructurar  igual que refinanciar.
 *   renovar        ninguna: acopla al final y no toca nada de lo agendado.
 */
export function seDanDeBaja(operacion: Operacion, corte: CorteDelPlan): CuotaExistente[] {
  if (operacion === "renovar") return [];
  if (operacion === "editar") return corte.pendientes;
  return [...corte.atrasadas, ...corte.pendientes];
}

/** Las que quedan en pie después de la operación, ordenadas por fecha */
export function sobreviven(operacion: Operacion, corte: CorteDelPlan): CuotaExistente[] {
  const debaja = new Set(seDanDeBaja(operacion, corte));
  return [...corte.pagadas, ...corte.atrasadas, ...corte.pendientes]
    .filter((c) => !debaja.has(c))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/* ══════════════════════════════════════════════════════════════
   Monto por cuota ↔ cantidad de cuotas
   ══════════════════════════════════════════════════════════════ */

/**
 * Los dos campos son la misma información vista de dos lados, así que si los
 * dos fueran editables a la vez se pisarían. El último que se tocó manda y el
 * otro se calcula — es el mismo trato que hace el alta de una financiación.
 */
export interface ParCuota {
  monto: string;
  cantidad: string;
  manda: "monto" | "cantidad";
}

export const PAR_VACIO: ParCuota = { monto: "", cantidad: "", manda: "monto" };

/**
 * Del par a los dos números firmes.
 *
 * `reglaSP` cambia el redondeo, y no por gusto:
 *
 *   false (editar)  el total se parte en `cantidad` cuotas parejas. Es lo que
 *                   hace `repartir()` y lo que el panel manda en `PUT /cuotas`.
 *   true  (los 3)   el SP hace FLOOR: entran `floor(total / monto)` cuotas
 *                   enteras y, si sobra algo, una última más chica. Pedir 4
 *                   cuotas de un total que no divide exacto da 5.
 */
export function resolverPar(
  total: number,
  par: ParCuota,
  reglaSP: boolean,
): { montoCuota: number; cantidad: number } {
  if (total <= 0) return { montoCuota: 0, cantidad: 0 };

  if (par.manda === "monto") {
    const montoCuota = Number(par.monto) || 0;
    if (montoCuota <= 0) return { montoCuota: 0, cantidad: 0 };
    return { montoCuota, cantidad: cantidadPara(total, montoCuota) };
  }

  const cantidad = Math.floor(Number(par.cantidad) || 0);
  if (cantidad <= 0) return { montoCuota: 0, cantidad: 0 };

  if (!reglaSP) {
    // Reparto parejo: el monto sale de la división y `repartir()` acomoda los
    // centavos en la última.
    return { montoCuota: redondear(total / cantidad), cantidad };
  }

  // Con la regla del SP no se puede pedir "N cuotas" y que salgan N: el SP
  // recibe el MONTO, no la cantidad. Se busca el monto que produce N cuotas —
  // redondeando para arriba, porque con el monto justo el FLOOR daría N y el
  // resto quedaría en una cuota N+1.
  const montoCuota = redondear(total / cantidad);
  return { montoCuota, cantidad: cantidadPara(total, montoCuota) };
}

/**
 * El techo de cuotas que se acepta generar.
 *
 * No es una preferencia: es una defensa. El monto por cuota se escribe dígito
 * a dígito, así que camino a "700000" el campo pasa por "7" — y 3.000.000 en
 * cuotas de $7 son **428.572 cuotas**. Con la previa dibujando una fila por
 * cuota eso congelaba la pestaña antes de terminar de tipear; confirmado, la
 * API le escribía esas 428.572 filas a `Pagos_por_realizar`.
 *
 * 400 deja lugar de sobra para lo que existe de verdad —un plan diario de un
 * año son 365— y corta cualquier cosa que solo puede ser un error de tipeo.
 */
export const TOPE_CUOTAS = 400;

/** Cuántas cuotas de ese monto entran, con la regla del SP: enteras + resto */
export function cantidadPara(total: number, montoCuota: number): number {
  if (total <= 0 || montoCuota <= 0) return 0;
  const enteras = Math.floor(centavos(total) / centavos(montoCuota));
  const resto = centavos(total) - enteras * centavos(montoCuota);
  return resto > 0 ? enteras + 1 : enteras;
}

/* ══════════════════════════════════════════════════════════════
   Las cuotas que se van a generar
   ══════════════════════════════════════════════════════════════ */

/**
 * El cronograma que van a escribir los tres SP.
 *
 * `cantidad` cuotas de `montoCuota` clavado y, si la división dejó resto, una
 * última por ese resto — más chica, nunca más grande. El primer vencimiento es
 * `desde` y de ahí cada `frecuenciaDias`.
 */
export function cuotasSegunSP(
  total: number,
  montoCuota: number,
  desde: string,
  frecuenciaDias: number,
): Cuota[] {
  if (total <= 0 || montoCuota <= 0 || frecuenciaDias < 1) return [];
  // Antes de armar nada: con un monto absurdamente chico esto son cientos de
  // miles de objetos, y el render de la previa se lleva puesta la pestaña.
  if (cantidadPara(total, montoCuota) > TOPE_CUOTAS) return [];

  const enteras = Math.floor(centavos(total) / centavos(montoCuota));
  const resto = (centavos(total) - enteras * centavos(montoCuota)) / 100;

  const montos = Array.from({ length: enteras }, () => montoCuota);
  if (resto > 0) montos.push(redondear(resto));

  return montos.map((monto, i) => ({ fecha: sumarDias(desde, i * frecuenciaDias), monto }));
}

/* ══════════════════════════════════════════════════════════════
   Dónde arranca el cronograma nuevo
   ══════════════════════════════════════════════════════════════ */

/**
 * El primer vencimiento nuevo. **Lo decide el SP, no el panel** —salvo en
 * refinanciar, que lo recibe como parámetro—, así que esto replica lo que hace
 * cada uno:
 *
 *   refinanciar    `p_Fecha_Inicio`: la que el admin eligió
 *   renovar        `MAX(fecha_acordada) + frecuencia`: se acopla al final del
 *                  cronograma actual, sin pisar nada de lo agendado
 *   reestructurar  `MIN(fecha_acordada)` de las impagas, o HOY si no hay: la
 *                  deuda se reparte de nuevo desde donde estaba parada
 *   editar         no pasa por un SP; arranca donde diga el panel
 *
 * Devuelve `null` cuando no se puede saber —renovar sobre un plan sin
 * cronograma—, y ahí la previa no tiene que inventar fechas: la API rechaza
 * ese caso con un 409.
 */
export function primeraFechaNueva(
  operacion: Operacion,
  cuotas: CuotaExistente[],
  frecuenciaDias: number,
  fechaElegida: string,
  hoy: string,
): string | null {
  if (operacion === "refinanciar" || operacion === "editar") {
    return fechaElegida || null;
  }

  if (operacion === "renovar") {
    const ultima = maximo(cuotas.map((c) => c.fecha));
    return ultima === null ? null : sumarDias(ultima, Math.max(1, frecuenciaDias));
  }

  // Reestructurar: la más vieja de las que todavía no se pagaron.
  const impagas = cuotas.filter((c) => c.estado !== "Pagado").map((c) => c.fecha);
  return minimo(impagas) ?? hoy;
}

/* ══════════════════════════════════════════════════════════════
   Editar: cuánto queda para repartir
   ══════════════════════════════════════════════════════════════ */

/**
 * Cuánta plata tienen que cubrir las cuotas nuevas cuando se cambia el total
 * de un plan en curso.
 *
 * El total es del plan entero, pero lo cobrado ya entró y lo atrasado no se
 * puede reprogramar. Así que las pendientes nuevas cubren lo que falta:
 *
 *     a repartir = total nuevo − cobrado − atrasado
 *
 * Si da cero o negativo el plan no admite cronograma nuevo: el cliente ya pagó
 * (o debe en cuotas intocables) más que el total al que se lo quiere llevar.
 * Ahí hay que decidir a mano, no adivinar.
 */
export function aRepartirAlEditar(totalNuevo: number, corte: CorteDelPlan): number {
  return redondear(totalNuevo - corte.cobrado - corte.atrasado);
}

/* ────────────────────────── auxiliares ────────────────────────── */

function sumar(cuotas: Cuota[]): number {
  return redondear(cuotas.reduce((t, c) => t + c.monto, 0));
}

function maximo(fechas: string[]): string | null {
  return fechas.length === 0 ? null : fechas.reduce((a, b) => (a > b ? a : b));
}

function minimo(fechas: string[]): string | null {
  return fechas.length === 0 ? null : fechas.reduce((a, b) => (a < b ? a : b));
}

/** Dos decimales, sin arrastrar el error binario de los flotantes. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A centavos enteros: en decimales, 0.1 + 0.2 no da 0.3 */
function centavos(n: number): number {
  return Math.round(n * 100);
}
