import { getEstadoDeCuenta } from "@/services/clientes.service";
import { enviarEstadoCuenta } from "@/lib/compartir";
import { soloElPlan } from "@/lib/estado-cuenta-por-plan";
import type { EstadoDeCuenta } from "@/types";
import type { EstadoCuentaPdfCliente } from "@/lib/pdf/estado-cuenta-pdf";

/**
 * Arma el PDF del estado de cuenta y lo manda.
 *
 * Un solo camino para los envíos con adjunto del panel —el reclamo por atraso,
 * el comprobante de un cobro y el estado de cuenta de la ficha— porque los
 * tres hacían lo mismo y el único que recortaba al plan era uno.
 *
 * **`planId` es lo que decide qué se manda**, y no es un detalle de formato:
 *
 *   · con un número, el PDF es de ESA financiación y de ninguna otra. Es lo
 *     que va cuando se cobra o se reclama una cuota: el comprobante de algo
 *     que se acaba de hacer sobre un plan no puede mostrar el saldo de los
 *     demás.
 *   · con `undefined`, va la cuenta entera. Solo desde la ficha del cliente,
 *     que es donde se elige a propósito.
 *
 * El recorte lo hace **la base**, no el navegador: con `planId` la API llama a
 * `sp_VerEstadoDeCuentaSingular` y devuelve el saldo y el desglose ya
 * calculados sobre ese plan. Por eso se vuelve a pedir el estado de cuenta en
 * vez de reusar el que hay en pantalla — el PDF es lo que el cliente recibe
 * por escrito, y sale de una sola fuente.
 *
 * El texto se arma sobre el MISMO objeto que el PDF. Si no, el mensaje dice un
 * número y el adjunto otro, y el cliente no paga ninguno.
 *
 * @param texto  cómo se arma el mensaje a partir del estado de cuenta que
 *               devolvió la API. Cambia según el envío (reclamo o comprobante).
 * @returns `false` solo si el usuario cerró la hoja de compartir sin mandar.
 */
export async function enviarComprobante({
  clienteId,
  planId,
  cliente,
  telefono,
  leyenda,
  texto,
}: {
  clienteId: number;
  /** La financiación del PDF. `undefined` = toda la cuenta. */
  planId: number | undefined;
  cliente: EstadoCuentaPdfCliente;
  telefono: string | null;
  /** Encabezado del PDF: la leyenda del reclamo o la institucional */
  leyenda?: string;
  texto: (ec: EstadoDeCuenta) => string;
}): Promise<boolean> {
  const { estadoDeCuenta } = await getEstadoDeCuenta(clienteId, planId);

  const { archivoEstadoCuentaPdf, descargarArchivo } = await import("@/lib/pdf/estado-cuenta-pdf");

  /**
   * El recorte va DOS veces, y no es redundancia de más.
   *
   * La API ya devolvió un solo plan si entendió `id_plan`, y entonces esto no
   * hace nada. Pero una API sin ese parámetro —la anterior a este cambio—
   * ignora el filtro y responde la cuenta entera: sin este segundo recorte, el
   * cliente recibe por escrito el saldo de todas sus financiaciones cuando se
   * le quiso mandar una. Pasó exactamente eso probando el front nuevo contra
   * la API vieja.
   *
   * No hay forma de que las dos difieran: `soloElPlan` se queda con el plan
   * pedido y recalcula los totales sumando lo que queda.
   */
  const recortado = soloElPlan(estadoDeCuenta, planId);

  const archivo = await archivoEstadoCuentaPdf(recortado, cliente, leyenda);

  return enviarEstadoCuenta(archivo, texto(recortado), telefono, descargarArchivo);
}
