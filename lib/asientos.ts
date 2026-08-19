import type { EstadoDeCuentaPlan } from "@/types";

/**
 * Los movimientos de un plan como asiento contable con saldo corrido, al
 * estilo del resumen bancario: el plan nace como débito por el monto total,
 * cada cobro lo acredita y cada recargo lo vuelve a debitar. El saldo de la
 * última fila coincide con `plan.pendiente`, que es lo que el PDF imprime en
 * el pie.
 *
 * Vive fuera del `.tsx` del PDF para que `asientos.check.ts` pueda correrlo
 * sin arrastrar @react-pdf/renderer — el mismo motivo que
 * `estado-cuenta-por-plan.ts`.
 */
export interface Asiento {
  fecha: string;
  concepto: string;
  cuota: string;
  vencimiento: string;
  debito: number | null;
  credito: number | null;
  saldo: number;
  /** Atraso o recargo: la fila va con el resaltador rojo y letra blanca. */
  alarma: boolean;
}

/** "2026-07-28" → "28/07/26" (formato compacto de la tabla, como el resumen bancario) */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function asientosDelPlan(plan: EstadoDeCuentaPlan): Asiento[] {
  // Un extracto va del movimiento más viejo al más nuevo, y el saldo corrido
  // solo tiene sentido en ese orden.
  //
  // Antes se hacía `.reverse()` dando por sentado que la API los mandaba del
  // más nuevo al más viejo. No es así: el asiento salía al revés y el "ALTA
  // PLAN" quedaba fechado con la ÚLTIMA cuota — una fecha futura, como si el
  // plan hubiera empezado el día que vence lo que todavía no se pagó.
  // Se ordena por fecha en vez de suponer.
  //
  // Las advertencias SIN recargo no entran en el asiento: no movieron plata.
  // Un "no pude cobrar" genera dos movimientos —la cuota, que queda Atrasado,
  // y la advertencia con el motivo—, y los dos salían en rojo, uno encima del
  // otro, con el saldo de la cuenta al costado. El cliente leía dos penalidades
  // de $120.000 donde había una cuota de $30.000. El motivo sigue estando, en
  // el bloque ADVERTENCIAS del pie, que es donde se lee como lo que es.
  const cronologico = [...plan.movimientos]
    .filter((m) => m.estado !== "Recargo" || m.monto > 0)
    .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));

  const filas: Asiento[] = [
    {
      fecha: "00/00/00",
      concepto: "SALDO ANTERIOR",
      cuota: "",
      vencimiento: "",
      debito: null,
      credito: null,
      saldo: 0,
      alarma: false,
    },
    {
      fecha: fechaCorta(cronologico[0]?.fecha),
      concepto: `ALTA PLAN ${plan.nombre.toUpperCase()}`,
      cuota: "",
      vencimiento: "",
      debito: plan.montoTotal,
      credito: null,
      saldo: plan.montoTotal,
      alarma: false,
    },
  ];

  let saldo = plan.montoTotal;
  // La numeración de cuota es de las cuotas, no de los recargos: un recargo
  // intercalado corría la numeración de todas las que venían después.
  let nroCuota = 0;

  for (const m of cronologico) {
    const recargo = m.estado === "Recargo";
    const cobrado = m.estado === "Pagado";

    // Un recargo es un DÉBITO: suma deuda. Antes no sumaba ni restaba, así que
    // el saldo corrido del extracto terminaba distinto de `plan.pendiente`
    // —que sí lo incluye, la API lo suma en `saldo_deudor`— y el pie del PDF
    // contradecía a la última fila de la tabla.
    if (recargo) saldo += m.monto;
    if (cobrado) saldo -= m.monto;
    if (!recargo) nroCuota++;

    filas.push({
      fecha: fechaCorta(m.fecha),
      // Una cuota que quedó atrasada dice que quedó atrasada: la fila es roja
      // y el único número que traía era el saldo de la cuenta, que se leía
      // como si fuera el importe del atraso.
      concepto: m.estado === "Atrasado" ? "CUOTA ATRASADA" : m.concepto.toUpperCase(),
      cuota: recargo ? "" : String(nroCuota),
      vencimiento: fechaCorta(m.fecha),
      debito: recargo ? m.monto : null,
      credito: cobrado ? m.monto : null,
      saldo,
      alarma: m.estado === "Atrasado" || recargo,
    });
  }

  // Sin fila de "PROXIMA CUOTA A VENCER". Repetía al pie una cuota que ya
  // estaba listada arriba —la primera pendiente— y lo hacía con dos errores:
  //
  //  · La numeraba `cuotasPagadas + 1`. Con cuotas atrasadas eso no es la
  //    próxima: un plan con 0 pagadas y 3 atrasadas la anunciaba como "cuota
  //    1", que es justamente la más vieja de las que se deben.
  //  · Le ponía el importe en DEBITOS sin tocar el saldo. En este asiento el
  //    plan se debita ENTERO en el alta, así que ninguna cuota debita por su
  //    cuenta: con esa fila la columna DEBITOS dejaba de sumar el saldo y el
  //    cliente que hace la cuenta a mano no le daba.
  //
  // No se pierde nada: las cuotas pendientes están en la tabla, en orden y
  // con su fecha de vencimiento. El resumen de WhatsApp sí sigue usando
  // `plan.proximaCuota` — ahí no hay columnas que cuadrar.

  return filas;
}
