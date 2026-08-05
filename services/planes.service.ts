import { api, USE_MOCK } from "@/services/api";
import { delay, getDb, nextId, saveDb } from "@/services/mock/db";
import { addDays } from "@/lib/format";
import { esCobrado } from "@/lib/status";
import type { FrecuenciaCuota, PlanListado, PlanPayload } from "@/types";

/** Días entre cuota y cuota según la frecuencia elegida */
const DIAS_POR_FRECUENCIA: Record<FrecuenciaCuota, number> = {
  Diaria: 1,
  Semanal: 7,
  Quincenal: 15,
  Mensual: 30,
};

export const FRECUENCIAS: FrecuenciaCuota[] = ["Diaria", "Semanal", "Quincenal", "Mensual"];

/**
 * Fechas de vencimiento de las cuotas de un plan.
 *
 * ponytail: "Mensual" avanza de a 30 días corridos, no al mismo día del mes
 * siguiente. Si el negocio necesita "todos los días 10", cambiar acá por
 * aritmética de calendario. Tampoco corre las fechas que caen en día no
 * laborable — eso lo resuelve `sp_VerFechasNoLaborales` (tarea 2.6) y hay
 * que aplicarlo cuando el endpoint exista.
 */
export function fechasDeCuotas(
  primeraFecha: string,
  cantidad: number,
  frecuencia: FrecuenciaCuota,
): string[] {
  const paso = DIAS_POR_FRECUENCIA[frecuencia];
  return Array.from({ length: cantidad }, (_, i) => addDays(i * paso, primeraFecha));
}

export async function getPlanes(): Promise<PlanListado[]> {
  if (USE_MOCK) {
    const db = getDb();
    const planes = db.planes.map<PlanListado>((p) => {
      const cc = db.cuentasCorrientes.find((c) => c.id === p.idCuentaCorriente);
      const cliente = db.clientes.find((c) => c.id === cc?.idCliente);
      const rel = db.clienteCobrador.find((cc2) => cc2.idCliente === cliente?.id);
      const cuotas = db.pagosPorRealizar.filter((pp) => pp.idPlanDePago === p.id);
      const cobradas = cuotas.filter((c) => esCobrado(c.estado));

      return {
        id: p.id,
        nombre: p.nombre,
        status: p.status,
        montoTotal: p.montoTotal,
        clienteId: cliente?.id ?? 0,
        clienteNombre: cliente?.nombreCompleto ?? "—",
        cobradorNombre: db.cobradores.find((c) => c.id === rel?.idCobrador)?.nombreCompleto ?? null,
        cuotasTotales: cuotas.length,
        cuotasCobradas: cobradas.length,
        pagado: cobradas.reduce((s, c) => s + c.montoEsperado, 0),
      };
    });
    return delay(planes.sort((a, b) => a.clienteNombre.localeCompare(b.clienteNombre)));
  }
  const { data } = await api.get<PlanListado[]>("/planes");
  return data;
}

/**
 * Alta o edición de un plan.
 *
 * En el alta genera además las cuotas (`Pagos_por_realizar`). Contra la API
 * real son dos llamadas, igual que el alta de cliente con sus teléfonos:
 * `sp_Crear-PlanDePago` devuelve el id y después `sp_Crear-PagoPorRealizar`
 * recibe el array de fechas como JSON.
 */
export async function guardarPlan(payload: PlanPayload): Promise<PlanListado> {
  if (USE_MOCK) {
    const db = getDb();

    if (payload.id) {
      const plan = db.planes.find((p) => p.id === payload.id);
      if (!plan) throw new Error("Plan no encontrado.");
      plan.nombre = payload.nombre;
      plan.montoTotal = payload.montoTotal;
      plan.status = payload.status;
    } else {
      // sp_CrearClientes ya dejó creada la cuenta corriente del cliente
      const cc = db.cuentasCorrientes.find((c) => c.idCliente === payload.idCliente);
      if (!cc) throw new Error("El cliente no tiene cuenta corriente.");

      const plan = {
        id: nextId(db.planes),
        idCuentaCorriente: cc.id,
        nombre: payload.nombre,
        montoTotal: payload.montoTotal,
        status: payload.status,
      };
      db.planes.push(plan);

      if (payload.cuotas && payload.cuotas.cantidad > 0) {
        const { cantidad, primeraFecha, frecuencia } = payload.cuotas;
        const montoCuota = Math.round(payload.montoTotal / cantidad);
        for (const fecha of fechasDeCuotas(primeraFecha, cantidad, frecuencia)) {
          db.pagosPorRealizar.push({
            id: nextId(db.pagosPorRealizar),
            idPlanDePago: plan.id,
            fechaAcordada: fecha,
            montoEsperado: montoCuota,
            dentroRango: null,
            estado: "Pendiente",
          });
        }
      }
      payload = { ...payload, id: plan.id };
    }

    saveDb();
    const listado = (await getPlanes()).find((p) => p.id === payload.id);
    if (!listado) throw new Error("Plan inconsistente.");
    return listado;
  }

  const { data } = payload.id
    ? await api.put<PlanListado>("/planes", payload)
    : await api.post<PlanListado>("/planes", payload);
  return data;
}

/** Baja lógica: Activo = 0. Nunca se borra (el historial de pagos queda). */
export async function eliminarPlan(id: number): Promise<number> {
  if (USE_MOCK) {
    const db = getDb();
    db.planes = db.planes.filter((p) => p.id !== id);
    db.pagosPorRealizar = db.pagosPorRealizar.filter((pp) => pp.idPlanDePago !== id);
    saveDb();
    return delay(id, 200);
  }
  await api.delete("/planes", { data: { id } });
  return id;
}
