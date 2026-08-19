// Chequeo de lib/agregados.ts —  `npm run check`
//
// Node 24 ejecuta TypeScript directo, así que no hace falta framework ni
// build. Cubre lo que no es obvio de la agregación: que "Vencido" se derive
// de la fecha, que el apoyo le sume al que cobró y no al asignado, y que
// el déficit no se pise con lo pendiente.
import assert from "node:assert/strict";
import {
  balanceDelPeriodo,
  cierrePorCobrador,
  cobrosCruzados,
  columnasPorCobrador,
  distribucionDeEstados,
  esApoyo,
  estadoVisible,
  cuotasEnDeuda,
  METODO_EFECTIVO,
  performancePorCobrador,
  totalesPorMetodo,
} from "./agregados.ts";
import type { Cobrador, CobroDelDia, PagoEstado } from "../types/index.ts";

const HOY = "2026-06-10";

const cobrador = (id: number, nombre: string) => ({ id, nombreCompleto: nombre }) as Cobrador;

const COBRADORES = [cobrador(1, "Marcos G"), cobrador(2, "Luis F"), cobrador(3, "Diego P")];

let seq = 0;
function cuota(
  asignadoA: number,
  estado: PagoEstado,
  fecha: string,
  monto: number,
  cobradoPor: number | null = null,
  metodoPagoId: number | null = null,
  montoAbonado: number | null = null,
): CobroDelDia {
  seq++;
  return {
    // Una cuota cobrada trae lo abonado y el método; una pendiente, no.
    montoAbonado: estado === "Pagado" ? (montoAbonado ?? monto) : null,
    metodoPagoId: estado === "Pagado" ? (metodoPagoId ?? METODO_EFECTIVO) : null,
    id: seq,
    planId: seq,
    planNombre: "Plan",
    fechaAcordada: fecha,
    montoEsperado: monto,
    estado,
    dentroRango: cobradoPor === null ? null : cobradoPor === asignadoA,
    whatsappEnviado: false,
    cobradorAsignadoId: asignadoA,
    cobradorAsignadoNombre: COBRADORES.find((c) => c.id === asignadoA)!.nombreCompleto,
    cobradoPorId: cobradoPor,
    cobradoPorNombre: cobradoPor
      ? COBRADORES.find((c) => c.id === cobradoPor)!.nombreCompleto
      : null,
    cliente: {
      id: seq,
      dni: `3000000${seq}`,
      nombreCompleto: `Cliente ${seq}`,
      status: "Activo",
      email: null,
      codigoPostal: null,
      direccion: null,
      casaODepto1: null,
      direccionAlternativa: null,
      casaODepto2: null,
      img: null,
      fechaNacimiento: null,
      ubicacionCobro: null,
      idLocalidad: 1,
      localidadNombre: "Centro",
      telefonos: [{ id: seq, numero: "3815000000" }],
      cobradorAsignadoId: asignadoA,
      cobradorAsignadoNombre: null,
    },
  };
}

// Marcos: 1 pagada, 1 pendiente futura, 1 vencida
// Luis:   1 pagada por Diego (apoyo), 1 vencida
// Diego:  1 pagada propia
const COBROS = [
  cuota(1, "Pagado", "2026-06-09", 10_000, 1),
  cuota(1, "Pendiente", "2026-06-15", 20_000),
  cuota(1, "Pendiente", "2026-06-05", 40_000), // pasada ⇒ Vencido
  cuota(2, "Pagado", "2026-06-09", 5_000, 3), // Diego cubrió a Luis
  cuota(2, "Pendiente", "2026-06-08", 7_000), // pasada ⇒ Vencido
  cuota(3, "Pagado", "2026-06-10", 3_000, 3),
];

// ── "Vencido" se deriva de la fecha, no está en la DB ──
assert.equal(estadoVisible(COBROS[1], HOY), "Pendiente", "cuota futura sigue Pendiente");
assert.equal(estadoVisible(COBROS[2], HOY), "Vencido", "cuota pendiente pasada es Vencido");
assert.equal(estadoVisible(COBROS[0], HOY), "Pagado", "una cuota cobrada nunca vence");

// "Atrasado" le gana a "Vencido" cuando las dos cosas son ciertas.
//
// Vencido lo dice el calendario: nadie fue a ver esa cuota. Atrasado lo
// escribe el cobrador cuando fue y no pudo cobrar. Si una atrasada apareciera
// como vencida, el admin no podría separar lo que falta visitar de lo que ya
// se visitó sin éxito — que es justo la decisión que tiene que tomar.
const atrasada = { ...COBROS[2], estado: "Atrasado" as const };
assert.equal(estadoVisible(atrasada, HOY), "ReclamoPendiente");
assert.equal(
  estadoVisible({ ...atrasada, fechaAcordada: "2099-01-01" }, HOY),
  "ReclamoPendiente",
  "sigue reclamable aunque la fecha no haya pasado: la marcó una persona",
);

// Y una vez reclamada pasa a amarillo: de nuestro lado no queda nada por hacer.
assert.equal(
  estadoVisible({ ...atrasada, whatsappEnviado: true }, HOY),
  "ReclamoRealizado",
  "con el reclamo mandado deja de estar pendiente",
);

// El flag solo cuenta sobre una atrasada. Una vencida que nadie visitó sigue
// vencida por más que alguna vez se le haya mandado un mensaje.
assert.equal(estadoVisible({ ...COBROS[2], whatsappEnviado: true }, HOY), "Vencido");

// ── Apoyo = lo cobró alguien distinto del asignado ──
assert.equal(esApoyo(COBROS[3]), true, "Diego cobrando a un cliente de Luis es apoyo");
assert.equal(esApoyo(COBROS[0]), false, "cobrar lo propio no es apoyo");
assert.equal(esApoyo(COBROS[1]), false, "una cuota sin cobrar no es apoyo");

// ── Balance: las tres categorías particionan el total, sin superponerse ──
const bal = balanceDelPeriodo(COBROS, HOY);
assert.equal(bal.esperado, 85_000);
assert.equal(bal.cobrado, 18_000); // 10k + 5k + 3k
assert.equal(bal.pendiente, 20_000); // solo la futura
assert.equal(bal.deficit, 47_000); // 40k vencida + 7k incomunicada
assert.equal(
  bal.cobrado + bal.pendiente + bal.deficit,
  bal.esperado,
  "cobrado + pendiente + déficit tiene que dar el esperado",
);
assert.equal(bal.efectividad, 21); // round(18000/85000*100)
assert.equal(balanceDelPeriodo([], HOY).efectividad, 0, "sin cuotas no divide por cero");

// ── Cierre: la plata la entrega quien la cobró, no a quien se le asignó ──
const cierre = cierrePorCobrador(COBROS, COBRADORES, HOY);
const porNombre = (n: string) => cierre.find((c) => c.nombre === n)!;

assert.equal(porNombre("Marcos G").aEntregar, 10_000, "Marcos entrega solo lo suyo");
assert.equal(
  porNombre("Luis F").aEntregar,
  0,
  "Luis no entrega la cuota que le cobró Diego: esa plata la tiene Diego",
);
assert.equal(porNombre("Diego P").aEntregar, 8_000, "Diego entrega lo propio (3k) + el apoyo (5k)");
assert.equal(
  bal.cobrado,
  cierre.reduce((s, c) => s + c.aEntregar, 0),
  "la suma de los cierres tiene que dar todo lo cobrado del período",
);

// La deuda sí queda del lado del asignado, aunque no la haya intentado él
const itemsLuis = porNombre("Luis F").items;
assert.equal(itemsLuis.length, 1);
assert.equal(itemsLuis[0].tipo, "vencido");
const apoyoDeDiego = porNombre("Diego P").items.find((i) => i.tipo === "apoyo")!;
assert.equal(apoyoDeDiego.cubreA, "Luis F", "el ledger dice a quién se le cubrió");

// ── Kanban: agrupa por asignado y ordena por severidad ──
const columnas = columnasPorCobrador(COBROS, COBRADORES, HOY);
assert.equal(columnas.length, 3);
const colMarcos = columnas.find((c) => c.nombre === "Marcos G")!;
assert.equal(colMarcos.montoEsperado, 70_000);
assert.equal(colMarcos.conteo.Vencido, 1);
assert.equal(colMarcos.cobros[0].montoEsperado, 40_000, "la vencida va primera");
assert.equal(colMarcos.cobros.at(-1)!.estado, "Pagado", "la cobrada va última");
assert.equal(
  columnasPorCobrador([COBROS[0]], COBRADORES, HOY).length,
  1,
  "un cobrador sin cuotas no genera columna",
);

// ── Análisis ──
const dist = distribucionDeEstados(COBROS, HOY);
assert.equal(
  dist.reduce((s, d) => s + d.cantidad, 0),
  COBROS.length,
  "la distribución cuenta cada cuota exactamente una vez",
);
assert.equal(
  dist.find((d) => d.estado === "Vencido")!.cantidad,
  2,
  "las dos pendientes con fecha pasada (Marcos y Luis)",
);

const perf = performancePorCobrador(COBROS, COBRADORES, HOY);
assert.deepEqual(
  perf.map((p) => p.nombre),
  ["Diego P", "Luis F", "Marcos G"],
  "se ordena por efectividad descendente",
);
const perfLuis = perf.find((p) => p.nombre === "Luis F")!;
assert.equal(perfLuis.efectividad, 50, "1 de sus 2 cuotas entró");
assert.equal(perfLuis.cobradasConApoyo, 1, "pero no la trajo él");
assert.equal(perfLuis.cobradasPropias, 0);

const cruzados = cobrosCruzados(COBROS);
assert.equal(cruzados.length, 1);
assert.equal(cruzados[0].asignadoA, "Luis F");
assert.equal(cruzados[0].cobradoPor, "Diego P");

// ── Cierre por método de pago ─────────────────────────────────────────────
//
// Lo que se pidió: en el cierre tiene que verse CUÁNTA plata trajo cada
// cobrador POR CADA MÉTODO. Sin eso, "a entregar" mezcla el efectivo que
// trae en el bolsillo con una transferencia que ya está en la cuenta, y al
// cerrar el día se le pide plata que nadie tiene que entregar.
const METODOS = new Map([
  [1, "Efectivo"],
  [2, "Transferencia"],
  [7, "Mercado Pago"],
]);

// Marcos cobra tres: 10.000 efectivo, 25.000 transferencia, 5.000 Mercado Pago.
const MIXTO = [
  cuota(1, "Pagado", "2026-06-09", 10_000, 1, 1),
  cuota(1, "Pagado", "2026-06-09", 25_000, 1, 2),
  cuota(1, "Pagado", "2026-06-09", 5_000, 1, 7),
];

const [marcosCierre] = cierrePorCobrador(MIXTO, [COBRADORES[0]], HOY, METODOS);

assert.equal(marcosCierre.aEntregar, 40_000, "el total no cambia");
assert.equal(marcosCierre.enEfectivo, 10_000, "pero solo 10.000 los trae encima");
assert.deepEqual(
  marcosCierre.porMetodo.map((m) => [m.metodo, m.total]),
  [
    ["Transferencia", 25_000],
    ["Efectivo", 10_000],
    ["Mercado Pago", 5_000],
  ],
  "un renglón por método, de mayor a menor",
);
assert.equal(
  marcosCierre.porMetodo.reduce((s, m) => s + m.total, 0),
  marcosCierre.aEntregar,
  "el desglose por método tiene que sumar exactamente lo que se entrega",
);

// Un método que no está en el catálogo no puede hacer desaparecer la plata.
const desconocido = totalesPorMetodo([cuota(1, "Pagado", "2026-06-09", 7_000, 1, 99)], METODOS);
assert.deepEqual(
  desconocido.map((m) => [m.metodo, m.total]),
  [["Otro", 7_000]],
);

// Un cobro viejo sin método registrado tampoco.
const sinMetodo = totalesPorMetodo([{ ...cuota(1, "Pagado", "2026-06-09", 3_000, 1), metodoPagoId: null }], METODOS);
assert.deepEqual(
  sinMetodo.map((m) => [m.metodo, m.total]),
  [["Sin registrar", 3_000]],
);

// ── Lo que entra en la caja es lo ABONADO, no lo esperado ──────────────────
//
// Un cobro parcial entró por menos de lo que decía la cuota. Sumando el
// esperado, el cierre le reclamaba al cobrador plata que el cliente no pagó.
const parcial = cuota(1, "Pagado", "2026-06-09", 30_000, 1, 1, 12_000);
const [conParcial] = cierrePorCobrador([parcial], [COBRADORES[0]], HOY, METODOS);
assert.equal(conParcial.aEntregar, 12_000, "entra lo que el cliente pagó");
assert.equal(conParcial.items[0].monto, 12_000);

const balanceParcial = balanceDelPeriodo([parcial], HOY, METODOS);
assert.equal(balanceParcial.esperado, 30_000, "lo esperado sigue siendo la cuota entera");
assert.equal(balanceParcial.cobrado, 12_000);
assert.equal(
  balanceParcial.porMetodo.reduce((s, m) => s + m.total, 0),
  balanceParcial.cobrado,
  "el desglose global también cierra",
);

console.log("✓ agregados.ts — todos los chequeos pasan");

// ── El cartel de deuda no puede contar lo que todavía no venció ───────────
//
// El cobrador puede marcar "no pude cobrar" ANTES del vencimiento: pasó, el
// cliente no estaba, y lo deja registrado. Esa cuota queda `Atrasado` con
// fecha futura.
//
// Se vio en producción: una cuota que vencía en 7 días sumaba al cartel
// "6 cuotas en deuda · $ 210.000" y mostraba "-7 días" al lado.
const atrasadaFutura = { ...cuota(1, "Atrasado", "2026-06-20", 30_000), whatsappEnviado: true };
const atrasadaVencida = cuota(1, "Atrasado", "2026-06-05", 30_000);
const vencidaSinVisitar = cuota(1, "Pendiente", "2026-06-01", 30_000);
const alDia = cuota(1, "Pendiente", "2026-06-30", 30_000);

const deuda = cuotasEnDeuda([atrasadaFutura, atrasadaVencida, vencidaSinVisitar, alDia], HOY);

assert.equal(deuda.length, 2, "solo las dos que ya vencieron");
assert.ok(
  !deuda.some((c) => c.id === atrasadaFutura.id),
  "una atrasada con fecha futura no es deuda todavía",
);
assert.equal(
  deuda.reduce((s, c) => s + c.montoEsperado, 0),
  60_000,
  "el total no puede inflarse con una cuota que no venció",
);
assert.deepEqual(
  deuda.map((c) => c.fechaAcordada),
  ["2026-06-01", "2026-06-05"],
  "de la más vieja a la más nueva: primero lo que más urge",
);

// La del día de hoy sí cuenta si no se cobró: venció hoy.
assert.equal(cuotasEnDeuda([cuota(1, "Atrasado", HOY, 10_000)], HOY).length, 1);

console.log("✓ agregados.ts — el cartel de deuda solo cuenta lo vencido");
