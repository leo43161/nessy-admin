import { api, USE_MOCK } from "@/services/api";
import { cobrosEnRango, delay, getDb, todosLosCobros } from "@/services/mock/db";
import { aCliente, aCobrador, aCuota, type FilaCliente, type FilaCobrador, type FilaCuota } from "@/services/mapear";
import type { ClienteListado, CobroDelDia, RangoFechas } from "@/types";

/**
 * `/cuotas` exige un rango y no tiene modo "todo": sin `desde`/`hasta` cae a
 * hoy..hoy y devuelve vacío. El histórico se pide con un rango que cubre
 * cualquier dato real.
 *
 * ponytail: rango tope en vez de un flag. Cuando la tabla crezca esto hay que
 * cambiarlo por totales agregados en un SP + paginación (tareas B.3 y C.1),
 * que es la misma deuda que ya tiene lib/agregados.ts.
 */
const RANGO_HISTORICO: RangoFechas = { desde: "2000-01-01", hasta: "2099-12-31" };

/**
 * Clientes y cobradores indexados por id.
 *
 * `/cuotas` trae del cliente solo nombre, DNI, dirección y ubicación, pero la
 * UI también lee status, teléfonos y localidad; y del cobro trae el id de
 * quién cobró pero no su nombre. Los dos faltantes salen de `/clientes` y
 * `/cobradores`, que son listados chicos.
 *
 * ponytail: se piden en cada consulta de cuotas. Con la cartera actual son dos
 * requests de nada; si crece, cachearlos por sesión o pedirle al backend que
 * `/cuotas` devuelva esas columnas ya cruzadas.
 */
export async function cargarContexto(): Promise<{
  clientes: Map<number, ClienteListado>;
  cobradores: Map<number, string>;
}> {
  const [resClientes, resCobradores] = await Promise.all([
    api.get<{ total: number; clientes: FilaCliente[] }>("/clientes"),
    api.get<{ total: number; cobradores: FilaCobrador[] }>("/cobradores"),
  ]);

  return {
    clientes: new Map(resClientes.data.clientes.map((f) => [f.id_Clientes, aCliente(f)])),
    cobradores: new Map(
      resCobradores.data.cobradores.map((f) => [f.id_Cobradores, aCobrador(f).nombreCompleto]),
    ),
  };
}

/** Cuotas de un rango, de TODOS los cobradores, ya traducidas y enriquecidas. */
export async function getCuotasEnRango(rango: RangoFechas): Promise<CobroDelDia[]> {
  const [res, ctx] = await Promise.all([
    api.get<{ total: number; cuotas: FilaCuota[] }>("/cuotas", { params: rango }),
    cargarContexto(),
  ]);
  return res.data.cuotas.map((f) => aCuota(f, ctx.clientes, ctx.cobradores));
}

/**
 * Cuotas del período, de TODOS los cobradores.
 *
 * La agregación por cobrador se hace en el cliente (lib/agregados.ts) porque
 * ningún SP la devuelve armada.
 */
export async function getCobrosDelPeriodo(rango: RangoFechas): Promise<CobroDelDia[]> {
  if (USE_MOCK) {
    return delay(cobrosEnRango(getDb(), rango.desde, rango.hasta));
  }
  return getCuotasEnRango(rango);
}

/** Histórico completo, sin filtro de fecha — lo que consume el tab Análisis. */
export async function getHistorico(): Promise<CobroDelDia[]> {
  if (USE_MOCK) {
    return delay(todosLosCobros(getDb()));
  }
  return getCuotasEnRango(RANGO_HISTORICO);
}
