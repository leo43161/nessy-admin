import { api } from "@/services/api";
import { cargarContexto, getHistorico } from "@/services/admin.service";
import { aPlan, dePlan, type FilaPlan } from "@/services/mapear";
import type { CobroDelDia, PlanListado, PlanPayload } from "@/types";

// El armado del cronograma —interés, reparto de cuotas y fechas— vive en
// `lib/cuotas.ts`, que es puro y tiene su chequeo. Acá solo quedan los
// requests. ponytail: las fechas que caen en día no laborable no se corren;
// eso lo resuelve `sp_VerFechasNoLaborales` cuando el endpoint exista.

export async function getPlanes(): Promise<PlanListado[]> {
  // `/planes` no trae el nombre del cliente ni el avance de cuotas: se cruzan
  // acá con /clientes y /cuotas, igual que el resto de las agregaciones.
  const [res, cuotas, ctx] = await Promise.all([
    api.get<{ total: number; planes: FilaPlan[] }>("/planes"),
    getHistorico(),
    cargarContexto(),
  ]);

  const porPlan = new Map<number, CobroDelDia[]>();
  for (const c of cuotas) {
    const acc = porPlan.get(c.planId);
    if (acc) acc.push(c);
    else porPlan.set(c.planId, [c]);
  }

  return res.data.planes
    .map((f) => aPlan(f, porPlan.get(f.id_Plan_de_pagos) ?? [], ctx.clientes))
    .sort((a, b) => a.clienteNombre.localeCompare(b.clienteNombre));
}

/**
 * Alta o edición de un plan.
 *
 * En el alta va también el cronograma: `POST /planes` acepta las cuotas y crea
 * plan y vencimientos en el mismo request. En la edición no se mandan — cambiar
 * el cronograma de un plan en curso es otra operación.
 *
 * La API devuelve el id, no el plan armado, así que se relee para que el store
 * reciba la fila con el cliente y el avance de cuotas ya cruzados.
 */
export async function guardarPlan(payload: PlanPayload): Promise<PlanListado> {
  // En la edición el cronograma no se toca: las cuotas ya existen y varias
  // pueden estar cobradas.
  const cuerpo = dePlan(payload.id ? { ...payload, cuotas: undefined } : payload);

  const { data } = payload.id
    ? await api.put<{ id_Plan_de_pagos: number }>("/planes", cuerpo)
    : await api.post<{ id_Plan_de_pagos: number }>("/planes", cuerpo);

  const planes = await getPlanes();
  const guardado = planes.find((p) => p.id === data.id_Plan_de_pagos);
  if (!guardado) throw new Error("El plan se guardó pero no se pudo releer.");

  return guardado;
}

/** Baja lógica: Activo = 0. Nunca se borra (el historial de pagos queda). */
export async function eliminarPlan(id: number): Promise<number> {
  await api.delete("/planes", { data: { id } });
  return id;
}
