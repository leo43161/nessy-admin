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

// ════════════════════════════════════════════════════════════════
//  Estadísticas históricas — sp_EstadisticasHistoricas, once bloques
// ════════════════════════════════════════════════════════════════

export interface FilaMetodoDePago {
  metodoId: number;
  metodo: string;
  cantidad: number;
  total: number;
}

export interface FilaClienteMoroso {
  clienteId: number;
  nombre: string;
  dni: string;
  atrasos: number;
  deuda: number;
}

export interface FilaRecaudacion {
  cobradorId: number;
  nombre: string;
  total: number;
}

export interface FilaMorosidad {
  cobradorId: number;
  nombre: string;
  cuotasAsignadas: number;
  cuotasAtrasadas: number;
  porcentajeMorosidad: number;
}

export interface EstadisticasHistoricas {
  desde: string;
  hasta: string;

  recaudado: number;
  efectivo: number;
  transferencia: number;
  /** Mercado Pago, tarjetas, cheque, transferencia bancaria */
  otrosMetodos: number;

  esperado: number;
  /** `recaudado / esperado × 100`; 0 si no había nada que cobrar */
  cumplimiento: number;

  planesNuevos: number;
  capitalFinanciado: number;

  capitalEstancado: number;
  cuotasAtrasadas: number;

  deudaCritica: number;
  cuotasCriticas: number;

  clientesNuevos: number;

  /** Ignora el rango: son siempre los próximos 30 días desde hoy */
  proyeccionProximoMes: number;
  cuotasProximoMes: number;

  clientesMorosos: FilaClienteMoroso[];
  rankingRecaudacion: FilaRecaudacion[];
  morosidadCobradores: FilaMorosidad[];
  /** Vacío hasta que se aplique sql/fix_estadisticas_y_cierre.sql: el
   *  bloque existe en el SP pero un 1054 en el bloque 9 cortaba el CALL antes. */
  metodos: FilaMetodoDePago[];
}

/** Un bloque agregado puede venir en null, y sus SUM en null si no hubo filas. */
type Agregado = Record<string, string | number | null> | null;

const n = (bloque: Agregado, campo: string): number =>
  bloque == null ? 0 : aNumero(bloque[campo] ?? 0);

export async function getEstadisticasHistoricas(
  rango: RangoFechas,
): Promise<EstadisticasHistoricas> {
  const { data } = await api.get<{
    desde: string;
    hasta: string;
    resumen: Agregado;
    esperado_vs_real: Agregado;
    capital_financiado: Agregado;
    capital_estancado: Agregado;
    deuda_critica: Agregado;
    clientes_nuevos: Agregado;
    proyeccion: Agregado;
    clientes_morosos: Record<string, string | number | null>[];
    ranking_cobradores: Record<string, string | number | null>[];
    morosidad_cobradores: Record<string, string | number | null>[];
    metodos: Record<string, string | number | null>[];
  }>("/estadisticas/historicas", {
    params: { desde: rango.desde, hasta: rango.hasta },
  });

  const esperado = n(data.esperado_vs_real, "Dinero_Esperado");
  const recaudadoReal = n(data.esperado_vs_real, "Dinero_Recaudado_Real");

  return {
    desde: data.desde,
    hasta: data.hasta,

    recaudado: n(data.resumen, "Total_Recaudado"),
    efectivo: n(data.resumen, "Total_Efectivo"),
    transferencia: n(data.resumen, "Total_Transferencia"),
    otrosMetodos: n(data.resumen, "Total_Otros_Metodos"),

    esperado,
    // Sin nada agendado no hay cumplimiento que medir: 0 y no una división por
    // cero, que en JS da Infinity y se imprimiría como "∞%".
    cumplimiento: esperado > 0 ? (recaudadoReal / esperado) * 100 : 0,

    planesNuevos: n(data.capital_financiado, "Cantidad_Planes_Nuevos"),
    capitalFinanciado: n(data.capital_financiado, "Capital_Total_Financiado"),

    capitalEstancado: n(data.capital_estancado, "Capital_Estancado_En_Periodo"),
    cuotasAtrasadas: n(data.capital_estancado, "Cantidad_Cuotas_Atrasadas"),

    deudaCritica: n(data.deuda_critica, "Deuda_Critica_Mas_30_Dias"),
    cuotasCriticas: n(data.deuda_critica, "Cuotas_Criticas"),

    clientesNuevos: n(data.clientes_nuevos, "Nuevos_Clientes_Registrados"),

    proyeccionProximoMes: n(data.proyeccion, "Ingresos_Proyectados_Proximo_Mes"),
    cuotasProximoMes: n(data.proyeccion, "Cuotas_Pendientes_Proximo_Mes"),

    clientesMorosos: (data.clientes_morosos ?? []).map((f) => ({
      clienteId: aNumero(f.id_cliente ?? 0),
      // El nombre lo agrega el JOIN contra Metodos_de_pago del SP.
      nombre: (f.Nombre_completo as string | null) ?? `Cliente ${f.id_cliente}`,
      dni: (f.DNI as string | null) ?? "",
      atrasos: aNumero(f.Cantidad_Atrasos ?? 0),
      deuda: aNumero(f.Deuda_Acumulada ?? 0),
    })),

    rankingRecaudacion: (data.ranking_cobradores ?? []).map((f) => ({
      cobradorId: aNumero(f.id_Cobrador ?? 0),
      nombre: (f.Nombre_completo as string | null) ?? "—",
      total: aNumero(f.Total_Recaudado ?? 0),
    })),

    morosidadCobradores: (data.morosidad_cobradores ?? []).map((f) => ({
      cobradorId: aNumero(f.id_cobrador ?? 0),
      nombre: (f.Nombre_completo as string | null) ?? "—",
      cuotasAsignadas: aNumero(f.Cuotas_Totales_Asignadas ?? 0),
      cuotasAtrasadas: aNumero(f.Cuotas_Atrasadas ?? 0),
      porcentajeMorosidad: aNumero(f.Porcentaje_Morosidad ?? 0),
    })),

    metodos: (data.metodos ?? []).map((f) => ({
      metodoId: aNumero(f.id_metodo_de_pago ?? 0),
      metodo: (f.Metodo as string | null) ?? "Otro",
      cantidad: aNumero(f.Cantidad_Cobros ?? 0),
      total: aNumero(f.Total ?? 0),
    })),
  };
}
