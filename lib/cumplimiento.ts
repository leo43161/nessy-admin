import type { EstadoDeCuenta } from "@/types";

/**
 * Cómo viene pagando el cliente.
 *
 * La efectividad usa **la misma fórmula que `sp_verCobradoresRanking`**, que es
 * la que ya se le aplica a los cobradores:
 *
 *     efectividad = 100 − (cuotas atrasadas / cuotas totales) × 100
 *
 * Es a propósito: si el cliente y el cobrador se miden distinto, dos números
 * que se leen igual dicen cosas distintas y nadie sabe cuál creer.
 *
 * "Atrasada" es una cuota sin pagar con la fecha ya pasada. Una cuota pagada
 * tarde **no** cuenta: `/estado_cuenta` devuelve la fecha del pago, no la del
 * vencimiento, así que después de cobrada no hay forma de saber si llegó a
 * término. La efectividad mide la deuda vencida de hoy, no el historial.
 */
export interface Cumplimiento {
  cuotasTotales: number;
  cuotasPagadas: number;
  cuotasAtrasadas: number;
  /** 0 a 100. Sin cuotas todavía, 100: no debe nada. */
  efectividad: number;
  advertencias: { fecha: string; motivo: string; recargo: number }[];
}

export function calcularCumplimiento(ec: EstadoDeCuenta, hoy: string): Cumplimiento {
  const movimientos = ec.planes.flatMap((p) => p.movimientos);

  const cuotas = movimientos.filter((m) => m.estado !== "Recargo");
  const pagadas = cuotas.filter((m) => m.estado === "Pagado");
  const atrasadas = cuotas.filter((m) => m.estado !== "Pagado" && m.fecha < hoy);

  return {
    cuotasTotales: cuotas.length,
    cuotasPagadas: pagadas.length,
    cuotasAtrasadas: atrasadas.length,
    efectividad:
      cuotas.length === 0 ? 100 : redondear(100 - (atrasadas.length / cuotas.length) * 100),
    advertencias: movimientos
      .filter((m) => m.estado === "Recargo")
      .map((m) => ({ fecha: m.fecha, motivo: m.concepto, recargo: m.monto })),
  };
}

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}
