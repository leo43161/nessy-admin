// ════════════════════════════════════════════════════════════════
//  Agregados de la vista admin — funciones puras.
//
//  Todo lo que la maqueta HTML calculaba inline dentro de render*()
//  vive acá: son los números de los tres tabs. Al ser puras se
//  chequean sin navegador (`npm run check` → agregados.check.ts) y,
//  cuando la API exponga /cuotas y /cobros, se pueden reemplazar por
//  lo que devuelva el backend sin tocar la UI.
// ════════════════════════════════════════════════════════════════
// Relativos y con extensión: agregados.ts corre también fuera del bundler,
// desde `npm run check`. Los `import type` se borran en runtime, así que
// @/types no agrega dependencia.
import { colorCobrador } from "./constants.ts";
import { esCobrado, esVencido } from "./status.ts";
import type {
  BalancePeriodo,
  CierreCobrador,
  Cobrador,
  CobroCruzado,
  CobroDelDia,
  ColumnaCobrador,
  EstadoVisible,
  LedgerItem,
  PerformanceCobrador,
} from "@/types";

/**
 * Orden de severidad de las cards dentro de una columna del kanban.
 *
 * `Atrasado` va primero: son las que el cobrador ya fue a buscar sin éxito, o
 * sea las que necesitan una decisión y no otra visita.
 */
const ORDEN_SEVERIDAD: Record<EstadoVisible, number> = {
  Atrasado: 0,
  Vencido: 1,
  Pendiente: 2,
  Pagado: 3,
};

export const ESTADOS_VISIBLES: EstadoVisible[] = [
  "Pagado",
  "Pendiente",
  "Vencido",
  "Atrasado",
];

/**
 * Estado que se le muestra al admin.
 *
 * "Vencido" no existe en la DB: es una cuota que sigue Pendiente y cuya fecha
 * ya pasó — nadie la fue a ver. "Atrasado" sí existe: lo escribe el cobrador
 * cuando fue y no pudo cobrar, y por eso gana sobre vencido: las dos son
 * ciertas, pero atrasado dice más.
 */
export function estadoVisible(cobro: CobroDelDia, hoy: string): EstadoVisible {
  if (cobro.estado === "Atrasado") return "Atrasado";
  return esVencido(cobro.estado, cobro.fechaAcordada, hoy) ? "Vencido" : cobro.estado;
}

/** Una cuota la cobró alguien distinto del cobrador asignado (apoyo) */
export function esApoyo(cobro: CobroDelDia): boolean {
  return cobro.cobradoPorId !== null && cobro.cobradoPorId !== cobro.cobradorAsignadoId;
}

/** No entró la plata y ya no va a entrar sola.
 *  "Incomunicado" dejó de ser un estado de cuota (N.4): esas cuotas siguen
 *  Pendiente y entran acá por fecha, como cualquier otra vencida. */
function esDeficit(estado: EstadoVisible): boolean {
  return estado === "Vencido";
}

const sumaMontos = (cobros: CobroDelDia[]) => cobros.reduce((s, c) => s + c.montoEsperado, 0);

// ── Tab 1 · Operaciones ─────────────────────────────────────────

/**
 * Arma una columna de kanban por cobrador con sus cuotas del período.
 * Los cobradores sin ninguna cuota en el rango no generan columna.
 */
export function columnasPorCobrador(
  cobros: CobroDelDia[],
  cobradores: Cobrador[],
  hoy: string,
): ColumnaCobrador[] {
  return cobradores
    .map((cob, idx) => {
      const propios = cobros.filter((c) => c.cobradorAsignadoId === cob.id);
      const conteo = Object.fromEntries(ESTADOS_VISIBLES.map((e) => [e, 0])) as Record<
        EstadoVisible,
        number
      >;
      for (const c of propios) conteo[estadoVisible(c, hoy)]++;

      return {
        cobradorId: cob.id,
        nombre: cob.nombreCompleto,
        color: colorCobrador(idx),
        cobros: [...propios].sort(
          (a, b) =>
            ORDEN_SEVERIDAD[estadoVisible(a, hoy)] - ORDEN_SEVERIDAD[estadoVisible(b, hoy)] ||
            a.fechaAcordada.localeCompare(b.fechaAcordada),
        ),
        montoEsperado: sumaMontos(propios),
        conteo,
      };
    })
    .filter((col) => col.cobros.length > 0);
}

// ── Tab 2 · Cierre de caja ──────────────────────────────────────

export function balanceDelPeriodo(cobros: CobroDelDia[], hoy: string): BalancePeriodo {
  const esperado = sumaMontos(cobros);
  const cobrado = sumaMontos(cobros.filter((c) => esCobrado(c.estado)));
  const pendiente = sumaMontos(cobros.filter((c) => estadoVisible(c, hoy) === "Pendiente"));
  const deficit = sumaMontos(cobros.filter((c) => esDeficit(estadoVisible(c, hoy))));

  return {
    esperado,
    cobrado,
    pendiente,
    deficit,
    efectividad: esperado > 0 ? Math.round((cobrado / esperado) * 100) : 0,
  };
}

/**
 * Cierre por cobrador: qué plata tiene que entregar y por qué.
 *
 * "A entregar" suma lo que ESE cobrador cobró con la mano — sus propias
 * cuotas más las que le cubrió a otro (apoyo) — no lo que le asignaron.
 * Las cuotas de su cartera que cobró un tercero no le suman: esa plata
 * la entrega el otro.
 */
export function cierrePorCobrador(
  cobros: CobroDelDia[],
  cobradores: Cobrador[],
  hoy: string,
): CierreCobrador[] {
  const nombrePorId = new Map(cobradores.map((c) => [c.id, c.nombreCompleto]));

  const fila = (cobro: CobroDelDia, tipo: LedgerItem["tipo"]): LedgerItem => ({
    cobroId: cobro.id,
    clienteNombre: cobro.cliente.nombreCompleto,
    telefonos: cobro.cliente.telefonos,
    monto: cobro.montoEsperado,
    tipo,
    cubreA: tipo === "apoyo" ? (nombrePorId.get(cobro.cobradorAsignadoId) ?? "—") : null,
  });

  return cobradores
    .map((cob, idx) => {
      // Cobradas por él: propias de su cartera, o cubiertas a otro
      const propias = cobros.filter(
        (c) => c.cobradoPorId === cob.id && c.cobradorAsignadoId === cob.id && esCobrado(c.estado),
      );
      const apoyos = cobros.filter(
        (c) => c.cobradoPorId === cob.id && c.cobradorAsignadoId !== cob.id && esCobrado(c.estado),
      );
      // Deuda de SU cartera, la haya intentado él o no
      const vencidas = cobros.filter(
        (c) => c.cobradorAsignadoId === cob.id && estadoVisible(c, hoy) === "Vencido",
      );

      return {
        cobradorId: cob.id,
        nombre: cob.nombreCompleto,
        color: colorCobrador(idx),
        aEntregar: sumaMontos(propias) + sumaMontos(apoyos),
        items: [
          ...propias.map((c) => fila(c, "propio")),
          ...apoyos.map((c) => fila(c, "apoyo")),
          ...vencidas.map((c) => fila(c, "vencido")),
        ],
      };
    })
    .filter((l) => l.items.length > 0);
}

// ── Tab 3 · Análisis ────────────────────────────────────────────

/** Cuántas cuotas hay en cada estado (histórico completo) */
export function distribucionDeEstados(
  cobros: CobroDelDia[],
  hoy: string,
): Array<{ estado: EstadoVisible; cantidad: number }> {
  const conteo = Object.fromEntries(ESTADOS_VISIBLES.map((e) => [e, 0])) as Record<
    EstadoVisible,
    number
  >;
  for (const c of cobros) conteo[estadoVisible(c, hoy)]++;
  return ESTADOS_VISIBLES.map((estado) => ({ estado, cantidad: conteo[estado] }));
}

/**
 * Tasa de éxito por cobrador sobre las cuotas ASIGNADAS a su cartera.
 * Se cuenta aparte lo que cobró él de lo que le tuvo que cubrir otro:
 * una cuota cobrada con apoyo entró igual, pero no la trajo él.
 */
export function performancePorCobrador(
  cobros: CobroDelDia[],
  cobradores: Cobrador[],
  hoy: string,
): PerformanceCobrador[] {
  return cobradores
    .map((cob, idx) => {
      const asignadas = cobros.filter((c) => c.cobradorAsignadoId === cob.id);
      const cobradas = asignadas.filter((c) => esCobrado(c.estado));
      const cobradasConApoyo = cobradas.filter(esApoyo).length;
      const cobradasPropias = cobradas.length - cobradasConApoyo;
      const fallidas = asignadas.filter((c) => esDeficit(estadoVisible(c, hoy))).length;
      const pendientes = asignadas.filter((c) => estadoVisible(c, hoy) === "Pendiente").length;

      return {
        cobradorId: cob.id,
        nombre: cob.nombreCompleto,
        color: colorCobrador(idx),
        efectividad:
          asignadas.length > 0 ? Math.round((cobradas.length / asignadas.length) * 100) : 0,
        cobradasPropias,
        cobradasConApoyo,
        fallidas,
        pendientes,
        total: asignadas.length,
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.efectividad - a.efectividad);
}

/** Cuotas que cobró un cobrador distinto al asignado, más recientes primero */
export function cobrosCruzados(cobros: CobroDelDia[]): CobroCruzado[] {
  return cobros
    .filter((c) => esApoyo(c) && esCobrado(c.estado))
    .map((c) => ({
      cobroId: c.id,
      fecha: c.fechaAcordada,
      clienteNombre: c.cliente.nombreCompleto,
      asignadoA: c.cobradorAsignadoNombre,
      cobradoPor: c.cobradoPorNombre ?? "—",
      monto: c.montoEsperado,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
