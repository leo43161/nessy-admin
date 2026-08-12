import { fmtMoney, formatFecha } from "@/lib/format";
import type { EstadoDeCuenta } from "@/types";

// Va el nombre del producto y no el del panel: lo lee el cliente, no el admin.
const APP_NAME = "GestorCobros";

/** Arma el estado de cuenta como texto plano para compartir (WhatsApp, etc.) */
export function estadoDeCuentaToText(ec: EstadoDeCuenta): string {
  const lineas: string[] = [];
  lineas.push(`*${APP_NAME} — Estado de Cuenta*`);
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
      lineas.push(
        `  Próxima cuota: ${fmtMoney(plan.proximaCuota.monto)} el ${formatFecha(plan.proximaCuota.fecha)}`
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
