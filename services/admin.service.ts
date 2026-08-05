import { api, USE_MOCK } from "@/services/api";
import { cobrosEnRango, delay, getDb, todosLosCobros } from "@/services/mock/db";
import type { CobroDelDia, RangoFechas } from "@/types";

/**
 * Cuotas del período, de TODOS los cobradores.
 *
 * Contra la API real esto pega a `GET /cuotas` (sp_Ver-PagoPorRealizar),
 * que todavía no existe: es la tarea 2.3 de TAREAS.md. Mientras tanto sale
 * del mock. La agregación por cobrador se hace en el cliente
 * (lib/agregados.ts) porque ningún SP la devuelve armada.
 */
export async function getCobrosDelPeriodo(rango: RangoFechas): Promise<CobroDelDia[]> {
  if (USE_MOCK) {
    return delay(cobrosEnRango(getDb(), rango.desde, rango.hasta));
  }
  const { data } = await api.get<CobroDelDia[]>("/cuotas", { params: rango });
  return data;
}

/**
 * Histórico completo, sin filtro de fecha — lo que consume el tab Análisis.
 *
 * ponytail: trae todo y agrega en el cliente. Con el volumen actual alcanza;
 * cuando la tabla crezca hay que mover esto a un SP que devuelva los totales
 * ya sumados (y ahí también entra la paginación, tarea C.1).
 */
export async function getHistorico(): Promise<CobroDelDia[]> {
  if (USE_MOCK) {
    return delay(todosLosCobros(getDb()));
  }
  const { data } = await api.get<CobroDelDia[]>("/cuotas", { params: { historico: true } });
  return data;
}
