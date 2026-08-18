import { api } from "@/services/api";
import { aNumero } from "@/services/mapear";
import type { RangoFechas } from "@/types";

/**
 * El balance financiero: los dos bolsillos.
 *
 * Cada peso que se cobra se parte en dos según los porcentajes configurados:
 * uno va al fondo de REINVERSIÓN (la plata con la que se vuelve a prestar) y
 * el otro al de GANANCIA (sueldos y retiros del dueño).
 *
 * La división la hace la base, no esto. Y la hace **con el porcentaje que
 * regía el día de cada cobro**, no con el actual: cambiar los porcentajes hoy
 * no reescribe lo que ya entró.
 */

export interface ConfiguracionFinanciera {
  reinversion: number;
  ganancia: number;
  /** Cuándo se guardó esta distribución */
  desde: string | null;
}

export interface CajasFuertes {
  /** Todo lo cobrado, de toda la historia */
  recaudadoHistorico: number;
  /** Bolsillo A: recaudado × %reinversión + inyecciones − prestado */
  disponibleParaPrestar: number;
  /** Bolsillo B: recaudado × %ganancia − sueldos y retiros */
  disponibleParaGanancia: number;
}

/** Los tres movimientos de caja que no son un cobro */
export type TipoMovimiento = "prestamo" | "gasto" | "inyeccion";

export interface AsientoLibro {
  fecha: string;
  categoria: string;
  detalle: string;
  /** Qué bolsillo tocó */
  fondo: string;
  ingreso: number;
  egreso: number;
}

export interface Balance {
  desde: string;
  hasta: string;
  configuracion: ConfiguracionFinanciera | null;
  /** ⚠️ NO responde al filtro de fechas: es el saldo real de hoy */
  cajas: CajasFuertes;
  /** Sí responde al filtro */
  libro: AsientoLibro[];
}

type FilaCruda = Record<string, string | number | null>;

const n = (fila: FilaCruda | null, campo: string): number =>
  fila == null ? 0 : aNumero(fila[campo] ?? 0);

function aConfiguracion(f: FilaCruda | null): ConfiguracionFinanciera | null {
  if (f == null) return null;

  return {
    // El balance devuelve las columnas con otro nombre que el endpoint de
    // configuración, así que se aceptan las dos formas.
    reinversion: aNumero(f.Porcentaje_Reinversion ?? f.Porcentaje_Reinversion_Aplicado ?? 0),
    ganancia: aNumero(f.Porcentaje_Ganancia ?? f.Porcentaje_Ganancia_Aplicado ?? 0),
    desde: (f.Fecha_Modificacion as string | null) ?? null,
  };
}

/** Los porcentajes vigentes. */
export async function getConfiguracion(): Promise<ConfiguracionFinanciera | null> {
  const { data } = await api.get<{ configuracion: FilaCruda }>("/estadisticas/configuracion");
  return aConfiguracion(data.configuracion);
}

/**
 * Guarda una distribución nueva.
 *
 * La API rechaza si no suman 100 — el stored procedure no lo comprueba, así
 * que esa validación es la que protege la plata. Acá se valida también, para
 * no mandar un pedido que ya sabemos que va a fallar.
 */
export async function guardarConfiguracion(
  reinversion: number,
  ganancia: number,
): Promise<ConfiguracionFinanciera | null> {
  const { data } = await api.post<{ configuracion: FilaCruda }>("/estadisticas/configuracion", {
    reinversion,
    ganancia,
  });

  return aConfiguracion(data.configuracion);
}

/**
 * Registra plata que entra o sale de la caja por fuera de los cobros.
 *
 *   prestamo   plata entregada en mano a un cliente  → resta de reinversión
 *   gasto      sueldos y retiros                     → resta de ganancia
 *   inyeccion  plata propia que pone el dueño        → suma a reinversión
 */
export async function registrarMovimiento(
  tipo: TipoMovimiento,
  concepto: string,
  monto: number,
): Promise<void> {
  await api.post("/estadisticas/movimiento", { tipo, concepto, monto });
}

export async function getBalance(rango: RangoFechas): Promise<Balance> {
  const { data } = await api.get<{
    desde: string;
    hasta: string;
    configuracion: FilaCruda | null;
    cajas: FilaCruda | null;
    libro: FilaCruda[];
  }>("/estadisticas/balance", { params: { desde: rango.desde, hasta: rango.hasta } });

  return {
    desde: data.desde,
    hasta: data.hasta,
    configuracion: aConfiguracion(data.configuracion),
    cajas: {
      recaudadoHistorico: n(data.cajas, "Total_Recaudado_Historico"),
      disponibleParaPrestar: n(data.cajas, "Caja_Disponible_Para_Prestar"),
      disponibleParaGanancia: n(data.cajas, "Caja_Disponible_Para_Ganancia"),
    },
    libro: (data.libro ?? []).map((f) => ({
      fecha: (f.Fecha as string | null) ?? "",
      categoria: (f.Categoria as string | null) ?? "—",
      detalle: (f.Detalle as string | null) ?? "",
      // El SP arma este campo con un CASE que solo contempla los tres tipos
      // conocidos: cualquier otro cae en null.
      fondo: (f.Fondo_Afectado as string | null) ?? "—",
      ingreso: aNumero(f.Ingreso_Debe ?? 0),
      egreso: aNumero(f.Egreso_Haber ?? 0),
    })),
  };
}
