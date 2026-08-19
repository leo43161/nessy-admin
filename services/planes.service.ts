import { api } from "@/services/api";
import { cargarContexto, getHistorico } from "@/services/admin.service";
import { aNumero, aPlan, dePlan, type FilaPlan } from "@/services/mapear";
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
export async function guardarPlan(
  payload: PlanPayload,
): Promise<{ plan: PlanListado; capitalRegistrado: boolean | null }> {
  // En la edición el cronograma no se toca: las cuotas ya existen y varias
  // pueden estar cobradas.
  const cuerpo = dePlan(payload.id ? { ...payload, cuotas: undefined } : payload);

  const { data } = payload.id
    ? await api.put<{ id_Plan_de_pagos: number }>("/planes", cuerpo)
    : await api.post<{ id_Plan_de_pagos: number; capital_registrado: boolean | null }>(
        "/planes",
        cuerpo,
      );

  const planes = await getPlanes();
  const guardado = planes.find((p) => p.id === data.id_Plan_de_pagos);
  if (!guardado) throw new Error("El plan se guardó pero no se pudo releer.");

  // El descuento del capital y la creación del plan son dos operaciones
  // separadas —así se decidió—, así que la API avisa si la segunda falló. El
  // plan existe igual: lo que falta es el movimiento de caja, y eso hay que
  // cargarlo a mano o el balance queda mostrando plata que ya se prestó.
  return {
    plan: guardado,
    capitalRegistrado:
      (data as { capital_registrado?: boolean | null }).capital_registrado ?? null,
  };
}

/** Baja lógica: Activo = 0. Nunca se borra (el historial de pagos queda). */
export async function eliminarPlan(id: number): Promise<number> {
  await api.delete("/planes", { data: { id } });
  return id;
}

// ════════════════════════════════════════════════════════════════
//  Los tres escenarios que reescriben el cronograma de un plan
//
//  Los tres dan de baja las cuotas que el cliente todavía no pagó y las
//  reemplazan. Las pagadas nunca se tocan: el historial de atrasos es lo que
//  el negocio necesita conservar, y por eso todo pasa DENTRO del mismo plan en
//  vez de crear uno nuevo.
//
//  El cálculo del total lo hace la base, no esto: acá se manda lo que el admin
//  pactó y la API responde con el antes y el después para poder confirmarlo.
// ════════════════════════════════════════════════════════════════

/** Los tres comparten esto: cuánto sale cada cuota, cada cuántos días y la nota. */
export interface BaseReestructura {
  planId: number;
  montoCuota: number;
  frecuenciaDias: number;
  /** Nota opcional del admin; la base la pega al final del mensaje del historial */
  mensaje?: string;
}

export interface DatosRefinanciacion extends BaseReestructura {
  /** Penalización sobre la deuda vieja, en por ciento */
  interes: number;
  /** Plata nueva, opcional */
  capitalNuevo?: number;
  /** Interés de esa plata nueva, en por ciento */
  interesNuevo?: number;
  fechaInicio: string;
}

export interface DatosRenovacion extends BaseReestructura {
  capitalNuevo: number;
  interes: number;
}

export type DatosReestructuracion = BaseReestructura;

/** Deuda pendiente y cuántas cuotas la componen, antes y después de la operación. */
export interface CorteDeDeuda {
  deuda: number;
  cuotas: number;
}

export interface ResultadoReestructura {
  operacion: "refinanciacion" | "renovacion" | "reestructuracion";
  planId: number;
  antes: CorteDeDeuda;
  despues: CorteDeDeuda;
}

interface RespuestaCruda {
  operacion: ResultadoReestructura["operacion"];
  id_Plan_de_pagos: number;
  antes: { deuda: number | string; cuotas: number };
  despues: { deuda: number | string; cuotas: number };
}

const corte = (c: { deuda: number | string; cuotas: number }): CorteDeDeuda => ({
  deuda: aNumero(c.deuda),
  cuotas: c.cuotas,
});

async function reestructura(
  ruta: string,
  cuerpo: Record<string, unknown>,
): Promise<ResultadoReestructura> {
  const { data } = await api.post<RespuestaCruda>(ruta, cuerpo);

  return {
    operacion: data.operacion,
    planId: data.id_Plan_de_pagos,
    antes: corte(data.antes),
    despues: corte(data.despues),
  };
}

/** Escenario 1: rescate. Recalcula toda la deuda con una penalización. */
export function refinanciarPlan(d: DatosRefinanciacion): Promise<ResultadoReestructura> {
  return reestructura("/planes/refinanciar", {
    id: d.planId,
    interes: d.interes,
    capital_nuevo: d.capitalNuevo ?? 0,
    interes_nuevo: d.interesNuevo ?? 0,
    monto_cuota: d.montoCuota,
    frecuencia_dias: d.frecuenciaDias,
    fecha_inicio: d.fechaInicio,
    mensaje: d.mensaje,
  });
}

/** Escenario 2: más plata, acoplada al final del cronograma actual. */
export function renovarPlan(d: DatosRenovacion): Promise<ResultadoReestructura> {
  return reestructura("/planes/renovar", {
    id: d.planId,
    capital_nuevo: d.capitalNuevo,
    interes: d.interes,
    monto_cuota: d.montoCuota,
    frecuencia_dias: d.frecuenciaDias,
    mensaje: d.mensaje,
  });
}

/** Escenario 3: la misma deuda, repartida en cuotas de otro tamaño. */
export function reestructurarCuotas(d: DatosReestructuracion): Promise<ResultadoReestructura> {
  return reestructura("/planes/reestructurar", {
    id: d.planId,
    monto_cuota: d.montoCuota,
    frecuencia_dias: d.frecuenciaDias,
    mensaje: d.mensaje,
  });
}

/**
 * Lo que el cliente todavía debe de un plan: la suma de las cuotas
 * `Pendiente` y `Atrasado`.
 *
 * Se lee de la API y no se estima con `montoTotal − pagado` porque este número
 * es **exactamente el conjunto de cuotas que los tres SP dan de baja**, y es lo
 * que el admin ve antes de confirmar. Una estimación que difiera en mil pesos
 * del cálculo real de la base convierte la vista previa en una mentira.
 */
export async function getDeudaPendiente(planId: number): Promise<CorteDeDeuda> {
  const { data } = await api.get<{
    planes: (FilaPlan & { cuotas?: { Monto_esperado: string; Estado: string }[] })[];
  }>("/planes", { params: { id: planId } });

  const cuotas = data.planes[0]?.cuotas ?? [];
  const impagas = cuotas.filter((c) => c.Estado === "Pendiente" || c.Estado === "Atrasado");

  return {
    deuda: impagas.reduce((acc, c) => acc + aNumero(c.Monto_esperado), 0),
    cuotas: impagas.length,
  };
}

// ════════════════════════════════════════════════════════════════
//  Editar el cronograma de un plan en curso
// ════════════════════════════════════════════════════════════════

export interface CuotaDelPlan {
  id: number;
  fecha: string;
  monto: number;
  estado: string;
  /** Solo las pendientes se pueden mover: las pagadas y atrasadas no se tocan */
  editable: boolean;
}

/**
 * Las cuotas de un plan, tal como están hoy.
 *
 * `editable` sale del estado: **la API solo reprograma las `Pendiente`**. Una
 * pagada es historia y una atrasada conserva su fecha original, que es de donde
 * sale el cálculo de la mora — moverla borraría el rastro del atraso.
 */
export async function getCuotasDelPlan(planId: number): Promise<CuotaDelPlan[]> {
  const { data } = await api.get<{
    planes: (FilaPlan & {
      cuotas?: { id_Pagos_por_realizar: number; fecha_acordada: string; Monto_esperado: string; Estado: string }[];
    })[];
  }>("/planes", { params: { id: planId } });

  return (data.planes[0]?.cuotas ?? []).map((c) => ({
    id: c.id_Pagos_por_realizar,
    fecha: c.fecha_acordada,
    monto: aNumero(c.Monto_esperado),
    estado: c.Estado,
    editable: c.Estado === "Pendiente",
  }));
}

/**
 * Reemplaza el cronograma pendiente de un plan.
 *
 * ⚠️ **Hay que mandar el cronograma pendiente COMPLETO**, no solo lo que
 * cambia: la API da de baja todas las pendientes y carga estas en su lugar.
 *
 * Van los montos uno por uno y no un monto único: un cronograma donde la
 * última cuota absorbe los centavos de la división dejaría de cerrar en el
 * total si se aplanara con un solo valor.
 */
export async function reprogramarCuotas(
  planId: number,
  cuotas: { fecha: string; monto: number }[],
): Promise<CuotaDelPlan[]> {
  await api.put("/cuotas", {
    id_plan: planId,
    fechas: cuotas.map((c) => c.fecha),
    montos: cuotas.map((c) => c.monto),
  });

  return getCuotasDelPlan(planId);
}
