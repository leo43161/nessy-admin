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
