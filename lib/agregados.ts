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
  TotalPorMetodo,
} from "@/types";

/**
 * Orden de severidad de las cards dentro de una columna del kanban.
 *
 * `Atrasado` va primero: son las que el cobrador ya fue a buscar sin éxito, o
 * sea las que necesitan una decisión y no otra visita.
 */
const ORDEN_SEVERIDAD: Record<EstadoVisible, number> = {
  ReclamoPendiente: 0,
  ReclamoRealizado: 1,
  Vencido: 2,
  Pendiente: 3,
  Pagado: 4,
};

export const ESTADOS_VISIBLES: EstadoVisible[] = [
  "Pagado",
  "Pendiente",
  "Vencido",
  "ReclamoPendiente",
  "ReclamoRealizado",
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
  // El cobrador fue y no pudo cobrar. Lo que falta hacer ahora es reclamar, y
  // si ya se reclamó, esperar: son dos situaciones distintas para el admin.
  if (cobro.estado === "Atrasado") {
    return cobro.whatsappEnviado ? "ReclamoRealizado" : "ReclamoPendiente";
  }

  if (esVencido(cobro.estado, cobro.fechaAcordada, hoy)) return "Vencido";

  // `Atrasado` ya salió arriba: acá solo quedan Pendiente y Pagado.
  return cobro.estado as EstadoVisible;
}

/**
 * Las cuotas que son DEUDA hoy: sin cobrar y con la fecha ya cumplida.
 *
 * El filtro de la fecha no es redundante con el estado. El cobrador puede
 * marcar "no pude cobrar" **antes** del vencimiento —pasó, el cliente no
 * estaba, y lo deja registrado—, y esa cuota queda `Atrasado` con fecha
 * futura. Sin esta comprobación entraba en el cartel de deuda: se vio en
 * producción una cuota que vencía en 7 días sumando al total de "6 cuotas en
 * deuda · $ 210.000" y mostrando "-7 días" al lado.
 *
 * Sigue apareciendo en la columna del cobrador con su chip de atrasada, que
 * es donde tiene que estar: hubo gestión, pero todavía no hay deuda.
 */
export function cuotasEnDeuda(cobros: CobroDelDia[], hoy: string): CobroDelDia[] {
  return cobros
    .filter((c) => c.fechaAcordada <= hoy)
    .filter((c) => {
      const estado = estadoVisible(c, hoy);
      return estado !== "Pagado" && estado !== "Pendiente";
    })
    .sort((a, b) => a.fechaAcordada.localeCompare(b.fechaAcordada));
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

/**
 * Lo que entró de verdad por una cuota cobrada.
 *
 * Un cobro parcial entra por menos que lo esperado y uno adelantado por más,
 * así que la plata que el cobrador tiene en la mano es `montoAbonado`. Se cae
 * a `montoEsperado` solo si la fila no trae el abonado: para una cuota en
 * `Pagado` eso no debería pasar, pero preferir el 0 haría desaparecer plata
 * del cierre sin que nadie se entere.
 */
const loQueEntro = (c: CobroDelDia) => c.montoAbonado ?? c.montoEsperado;

const sumaCobrado = (cobros: CobroDelDia[]) => cobros.reduce((s, c) => s + loQueEntro(c), 0);

/**
 * Agrupa cobros por método de pago, de mayor a menor.
 *
 * El nombre sale del catálogo (`/catalogos` → `Metodos_de_pago`) y no de una
 * lista escrita acá: el día que agreguen un método octavo aparece solo. Un id
 * que no esté en el catálogo cae en "Otro" en vez de desaparecer — la plata
 * tiene que figurar aunque el catálogo esté desactualizado.
 */
export function totalesPorMetodo(
  cobros: CobroDelDia[],
  metodos: Map<number, string>,
): TotalPorMetodo[] {
  const acumulado = new Map<number, TotalPorMetodo>();

  for (const c of cobros) {
    // 0 es "sin método registrado": son los cobros viejos, anteriores a que el
    // diálogo lo pidiera.
    const metodoId = c.metodoPagoId ?? 0;
    const fila = acumulado.get(metodoId) ?? {
      metodoId,
      metodo: metodos.get(metodoId) ?? (metodoId === 0 ? "Sin registrar" : "Otro"),
      cantidad: 0,
      total: 0,
    };
    fila.cantidad++;
    fila.total += loQueEntro(c);
    acumulado.set(metodoId, fila);
  }

  return [...acumulado.values()].sort((a, b) => b.total - a.total);
}

/** El id de "Efectivo" en `Metodos_de_pago`. Es la única fila que la caja
 *  física distingue del resto: lo demás ya entró a una cuenta. */
export const METODO_EFECTIVO = 1;

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

export function balanceDelPeriodo(
  cobros: CobroDelDia[],
  hoy: string,
  metodos: Map<number, string> = new Map(),
): BalancePeriodo {
  const cobradas = cobros.filter((c) => esCobrado(c.estado));
  const esperado = sumaMontos(cobros);
  // Lo cobrado se mide con lo abonado, no con lo esperado: un cobro parcial
  // entró por menos y uno adelantado por más.
  const cobrado = sumaCobrado(cobradas);
  const pendiente = sumaMontos(cobros.filter((c) => estadoVisible(c, hoy) === "Pendiente"));
  const deficit = sumaMontos(cobros.filter((c) => esDeficit(estadoVisible(c, hoy))));

  return {
    esperado,
    cobrado,
    pendiente,
    deficit,
    efectividad: esperado > 0 ? Math.round((cobrado / esperado) * 100) : 0,
    porMetodo: totalesPorMetodo(cobradas, metodos),
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
  metodos: Map<number, string> = new Map(),
): CierreCobrador[] {
  const nombrePorId = new Map(cobradores.map((c) => [c.id, c.nombreCompleto]));

  const fila = (cobro: CobroDelDia, tipo: LedgerItem["tipo"]): LedgerItem => ({
    cobroId: cobro.id,
    clienteNombre: cobro.cliente.nombreCompleto,
    telefonos: cobro.cliente.telefonos,
    // Lo cobrado va por lo abonado; lo vencido no se cobró, así que ahí el
    // número que importa es el que se esperaba.
    monto: tipo === "vencido" ? cobro.montoEsperado : loQueEntro(cobro),
    tipo,
    cubreA: tipo === "apoyo" ? (nombrePorId.get(cobro.cobradorAsignadoId) ?? "—") : null,
    metodo:
      tipo === "vencido" ? null : (metodos.get(cobro.metodoPagoId ?? 0) ?? "Sin registrar"),
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

      // Todo lo que pasó por su mano en el período, propio o cubriendo a otro.
      const cobradas = [...propias, ...apoyos];
      const porMetodo = totalesPorMetodo(cobradas, metodos);

      return {
        cobradorId: cob.id,
        nombre: cob.nombreCompleto,
        color: colorCobrador(idx),
        aEntregar: sumaCobrado(cobradas),
        porMetodo,
        // Lo que trae encima al cerrar el día. Una transferencia ya está en la
        // cuenta: pedírsela también era contarla dos veces.
        enEfectivo: porMetodo.find((m) => m.metodoId === METODO_EFECTIVO)?.total ?? 0,
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
