import { api } from "@/services/api";
import { obtenerUbicacion } from "@/lib/geo";

/**
 * Registrar un cobro desde el panel.
 *
 * El tipo de cobro **no se elige**: la API lo deduce del monto contra lo
 * esperado (igual → ideal, menos → parcial, más → adelantado) y llama al SP que
 * corresponde. Por eso el body es siempre el mismo.
 *
 * Dos cosas propias del admin:
 *
 * - `id_cobrador` es obligatorio. Al cobrador se lo saca del token, pero el
 *   admin tiene que decir a nombre de quién entró la plata.
 * - La ubicación se pide igual que en la app del cobrador. Desde una oficina
 *   va a dar fuera de rango, que es la verdad de ese cobro.
 */
export interface CobroPayload {
  cuotaId: number;
  monto: number;
  idMetodoDePago: number;
  cobradorId: number;
  /** Obligatoria si el monto es menor al esperado: vencimiento del resto */
  nuevaFecha?: string;
}

export interface CobroResultado {
  tipo: "ideal" | "parcial" | "adelantado";
  sinUbicacion: boolean;
}

export async function registrarCobro(payload: CobroPayload): Promise<CobroResultado> {
  const ubicacion = await obtenerUbicacion();

  const { data } = await api.post<{ tipo: CobroResultado["tipo"]; sin_ubicacion: boolean }>(
    "/cobros",
    {
      id_cuota: payload.cuotaId,
      monto: payload.monto,
      id_metodo_de_pago: payload.idMetodoDePago,
      id_cobrador: payload.cobradorId,
      nueva_fecha: payload.nuevaFecha,
      lat: ubicacion?.lat ?? null,
      lon: ubicacion?.lon ?? null,
    },
  );

  return { tipo: data.tipo, sinUbicacion: data.sin_ubicacion };
}

/**
 * Deja registrado que se le mandó el reclamo al cliente por esa cuota
 * (`Pagos_por_realizar.WhatsApp_Enviado`, vía `sp_MarcarWhatsAppEnviado`).
 *
 * Es lo que hace que la cuota pase de "Reclamo pendiente" a "Reclamo
 * realizado" en el tablero: sin esto, el admin no tiene forma de saber a
 * quién ya le reclamó y termina mandando el mismo mensaje dos veces.
 *
 * No corta el flujo si falla: el mensaje ya salió y el cliente lo tiene.
 */
export async function marcarReclamoEnviado(cuotaId: number): Promise<void> {
  try {
    await api.post("/cuotas/whatsapp", { id_cuota: cuotaId });
  } catch {
    // silencio a propósito
  }
}
