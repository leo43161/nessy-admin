import { api } from "@/services/api";
import { aNumero } from "@/services/mapear";
import type { RangoFechas } from "@/types";

/**
 * Los números que calcula la base.
 *
 * `lib/agregados.ts` agrega en el cliente a partir de `/cuotas`, y para el
 * tablero del período está bien. Pero hay cosas que el frontend **no puede**
 * saber porque no tiene los datos: cuántos clientes registrados no tienen
 * ningún plan en curso, o cuánta plata hay en la calle contando todo el
 * histórico. Eso sale de acá.
 *
 * Los DECIMAL viajan como string, igual que en el resto de la API.
 */

export interface EstadisticasEnVivo {
  clientesTotales: number;
  clientesConPlan: number;
  /** Registrados sin ningún plan en curso */
  clientesFantasma: number;
  porcentajeFantasma: number;
  deudaEnLaCalle: number;
  deudaPromedioPorCliente: number;
}

export interface FilaRanking {
  cobradorId: number;
  nombre: string;
  cuotasAsignadas: number;
  cuotasConAtraso: number;
  /** 100 − (atrasadas / asignadas) × 100, calculado por la base */
  efectividad: number;
}

export async function getEstadisticasEnVivo(): Promise<EstadisticasEnVivo> {
  const { data } = await api.get<{
    estadisticas: {
      Total_Clientes_Registrados: number;
      Clientes_Con_Planes_Activos: number;
      Clientes_Fantasma: number;
      Porcentaje_Clientes_Fantasma: string | number;
      Deuda_Total_En_Calle: string | number;
      Promedio_Deuda_Por_Cliente_Activo: string | number;
    };
  }>("/estadisticas/vivo");

  const e = data.estadisticas;

  return {
    clientesTotales: e.Total_Clientes_Registrados,
    clientesConPlan: e.Clientes_Con_Planes_Activos,
    clientesFantasma: e.Clientes_Fantasma,
    porcentajeFantasma: aNumero(e.Porcentaje_Clientes_Fantasma),
    deudaEnLaCalle: aNumero(e.Deuda_Total_En_Calle),
    deudaPromedioPorCliente: aNumero(e.Promedio_Deuda_Por_Cliente_Activo),
  };
}

export async function getRanking(rango: RangoFechas): Promise<FilaRanking[]> {
  const { data } = await api.get<{
    ranking: {
      id_Cobradores: number;
      Nombre_Cobrador: string | null;
      Cuotas_Asignadas: number;
      Cuotas_Con_Atraso_o_Vencidas: string | number;
      Porcentaje_Efectividad: string | number;
    }[];
  }>("/estadisticas/ranking", { params: { desde: rango.desde, hasta: rango.hasta } });

  return data.ranking.map((f) => ({
    cobradorId: f.id_Cobradores,
    nombre: f.Nombre_Cobrador ?? "—",
    cuotasAsignadas: f.Cuotas_Asignadas,
    cuotasConAtraso: aNumero(f.Cuotas_Con_Atraso_o_Vencidas),
    efectividad: aNumero(f.Porcentaje_Efectividad),
  }));
}
