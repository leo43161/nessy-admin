// Relativo y con extensión: este archivo corre también fuera del bundler,
// desde `npm run check` (ver reestructura.check.ts).
import { cuotasNecesarias, totalConInteres } from "./cuotas.ts";

/**
 * Cómo queda un plan después de refinanciarlo, renovarlo o reestructurarlo.
 *
 * Esto **replica lo que hacen los tres stored procedures**, para poder
 * mostrárselo al admin antes de que confirme. Es la única oportunidad que
 * tiene de darse cuenta de que tipeó 1.500 en vez de 15.000, porque después
 * las cuotas viejas ya están dadas de baja.
 *
 * Los SP hacen, los tres igual:
 *
 *     cantidad = FLOOR(total / monto_cuota)
 *     resto    = total − cantidad × monto_cuota
 *     … genera `cantidad` cuotas de `monto_cuota`
 *     … y si resto > 0, una más por `resto`
 *
 * O sea: la última cuota es la chica, no la grande. `cuotasNecesarias` de
 * `lib/cuotas.ts` usa `Math.ceil`, que da el mismo número que
 * `FLOOR + (resto > 0 ? 1 : 0)`. Su equivalencia la comprueba
 * `reestructura.check.ts`, porque si un día alguno de los dos lados cambia el
 * redondeo, la vista previa empieza a mentir en silencio.
 */

export type Escenario = "refinanciar" | "renovar" | "reestructurar";

export interface DatosPrevios {
  escenario: Escenario;
  /** Suma de las cuotas Pendiente + Atrasado del plan */
  deudaVieja: number;
  /** Penalización (refinanciar) o interés de la plata nueva (renovar), en % */
  interes: number;
  /** Plata nueva. Solo refinanciar y renovar */
  capitalNuevo: number;
  /** Interés de la plata nueva. Solo refinanciar */
  interesNuevo: number;
  montoCuota: number;
  frecuenciaDias: number;
}

export interface Previa {
  /** Lo que se reparte en cuotas nuevas */
  totalAGenerar: number;
  /** Lo que el cliente termina debiendo del plan entero */
  deudaFinal: number;
  cantidadCuotas: number;
  /** El resto: siempre la ÚLTIMA, y siempre ≤ montoCuota */
  ultimaCuota: number;
  /** true si el reparto dio exacto y todas las cuotas salen iguales */
  exacto: boolean;
  diasTotales: number;
}

/**
 * Cuánta plata nueva se va a repartir en cuotas.
 *
 *   refinanciar    la deuda vieja con penalización + la plata nueva con SU interés
 *   renovar        solo la plata nueva con interés (lo viejo no se toca)
 *   reestructurar  la misma deuda, sin interés: solo cambia el tamaño de las cuotas
 */
export function totalAGenerar(d: DatosPrevios): number {
  if (d.escenario === "reestructurar") return d.deudaVieja;

  if (d.escenario === "renovar") return totalConInteres(d.capitalNuevo, d.interes);

  return totalConInteres(d.deudaVieja, d.interes) + totalConInteres(d.capitalNuevo, d.interesNuevo);
}

export function calcularPrevia(d: DatosPrevios): Previa {
  const total = totalAGenerar(d);
  const cantidad = cuotasNecesarias(total, d.montoCuota);

  // Renovar ACOPLA: la deuda vieja sigue en pie y lo nuevo se suma. Los otros
  // dos REEMPLAZAN: la deuda vieja deja de existir como cronograma.
  const deudaFinal = d.escenario === "renovar" ? d.deudaVieja + total : total;

  // El resto de los SP: `total − FLOOR(total/cuota) × cuota`. Cuando la
  // división da exacta el resto es 0 y no se inserta cuota extra, así que
  // todas salen por `montoCuota`.
  const exacto = cantidad > 0 && redondear(cantidad * d.montoCuota) === redondear(total);

  return {
    totalAGenerar: total,
    deudaFinal,
    cantidadCuotas: cantidad,
    ultimaCuota: exacto || cantidad === 0
      ? d.montoCuota
      : redondear(total - (cantidad - 1) * d.montoCuota),
    exacto: exacto || cantidad === 0,
    diasTotales: cantidad * d.frecuenciaDias,
  };
}

/** Dos decimales, sin arrastrar el error binario de los flotantes. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
