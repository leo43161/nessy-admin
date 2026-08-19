import { fmtMoney, formatFecha } from "@/lib/format";
import { EMPRESA_NOMBRE } from "@/lib/marca";
import type { EstadoDeCuenta } from "@/types";

/**
 * Cómo se nombra la primera cuota impaga del plan.
 *
 *  es **la más vieja sin pagar**, no la que viene. Para el
 * admin eso está bien —es la que hay que salir a cobrar— pero al cliente no se
 * le puede escribir "próxima cuota" con una fecha de hace dos meses: leyó
 * "Próxima cuota: $ 30.000,00 el 5 jun 2026" un 19 de agosto.
 *
 * Con la fecha ya pasada es una cuota vencida, y así se la nombra.
 */
export function etiquetaCuotaPendiente(fecha: string, hoy: string): string {
  return fecha < hoy ? "Cuota vencida" : "Próxima cuota";
}

/** Arma el estado de cuenta como texto plano para compartir (WhatsApp, etc.) */
export function estadoDeCuentaToText(ec: EstadoDeCuenta): string {
  const lineas: string[] = [];
  lineas.push(`*${EMPRESA_NOMBRE} — Estado de Cuenta*`);
  lineas.push(`Cliente: ${ec.clienteNombre}`);
  lineas.push(`Fecha: ${formatFecha(ec.generadoEl)}`);
  lineas.push("");

  for (const plan of ec.planes) {
    lineas.push(`*${plan.nombre}* (${plan.status})`);
    lineas.push(`  Cuotas: ${plan.cuotasPagadas}/${plan.cuotasTotales}`);
    lineas.push(`  Pagado: ${fmtMoney(plan.pagado)}`);
    lineas.push(`  Pendiente: ${fmtMoney(plan.pendiente)}`);
    if (plan.vencido > 0) lineas.push(`  Vencido: ${fmtMoney(plan.vencido)}`);
    if (plan.proximaCuota) {
      const etiqueta = etiquetaCuotaPendiente(plan.proximaCuota.fecha, ec.generadoEl);
      lineas.push(
        `  ${etiqueta}: ${fmtMoney(plan.proximaCuota.monto)} ${
          etiqueta === "Cuota vencida" ? "del" : "el"
        } ${formatFecha(plan.proximaCuota.fecha)}`
      );
    }
    lineas.push("");
  }

  lineas.push(`*Total pagado:* ${fmtMoney(ec.totalPagado)}`);
  lineas.push(`*Saldo pendiente:* ${fmtMoney(ec.saldoPendiente)}`);
  if (ec.totalVencido > 0) lineas.push(`*Total vencido:* ${fmtMoney(ec.totalVencido)}`);

  return lineas.join("\n");
}

/** Leyenda del reclamo, en el bloque superior del PDF */
export const LEYENDA_RECLAMO =
  "Registramos cuotas vencidas en tu plan.\nTe pedimos regularizar la situación o comunicarte para acordar una fecha de pago.";

/**
 * Reclamo: el estado de cuenta con el vencido adelante.
 *
 * Es el mismo detalle pero encabezado por lo que se debe, porque el reclamo se
 * manda cuando hay cuotas vencidas y eso es lo que tiene que leer primero el
 * cliente. El PDF va adjunto: es el comprobante de lo que se le reclama.
 */
export function reclamoToText(ec: EstadoDeCuenta): string {
  const nombre = ec.clienteNombre.split(" ")[0];

  return [
    `Hola ${nombre},`,
    "",
    `Tenés *${fmtMoney(ec.totalVencido)}* en cuotas vencidas.`,
    "",
    LEYENDA_RECLAMO.replace(/\n/g, " "),
    "",
    "Te adjuntamos el detalle:",
    "",
    estadoDeCuentaToText(ec),
  ].join("\n");
}
