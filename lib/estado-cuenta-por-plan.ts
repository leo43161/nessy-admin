import type { EstadoDeCuenta, EstadoDeCuentaPlan } from "@/types";

/**
 * Recorta el estado de cuenta a un solo plan.
 *
 * El cliente pidió poder mandar el estado de cuenta de **un** plan en vez de
 * todo junto: alguien con tres financiaciones recibía un PDF con las tres y no
 * entendía cuál le estaban reclamando.
 *
 * No hace falta ningún stored procedure nuevo para esto — `/estado_cuenta` ya
 * devuelve el desglose por plan en `planes[]`.
 *
 * ⚠️ **No alcanza con filtrar `planes`.** Los totales del pie del PDF y el
 * bloque de comportamiento de pago se calculan sobre lo que traiga el objeto,
 * así que un PDF de un plan mostraría el saldo de TODA la cuenta: el cliente
 * leería que debe más de lo que ese plan dice, por escrito y con membrete.
 * Por eso se recalculan desde los planes que quedan.
 *
 * Vive fuera del `.tsx` del PDF para que `estado-cuenta-por-plan.check.ts`
 * pueda correrlo sin arrastrar @react-pdf/renderer.
 */
export function soloElPlan(ec: EstadoDeCuenta, planId?: number): EstadoDeCuenta {
  if (planId === undefined) return ec;

  const planes = ec.planes.filter((p) => p.planId === planId);

  // Un id que no existe dejaría un PDF en blanco con los totales en cero, que
  // se lee como un cliente sin deuda. Ante la duda, la cuenta completa: de más
  // se explica, de menos se cobra mal.
  if (planes.length === 0) return ec;

  const sumar = (f: (p: EstadoDeCuentaPlan) => number) => planes.reduce((acc, p) => acc + f(p), 0);

  return {
    ...ec,
    planes,
    totalPagado: sumar((p) => p.pagado),
    saldoPendiente: sumar((p) => p.pendiente),
    totalVencido: sumar((p) => p.vencido),
  };
}
