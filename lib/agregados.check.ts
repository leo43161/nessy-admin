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
  performancePorCobrador,
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
): CobroDelDia {
  seq++;
  return {
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
      direccion: null,
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
assert.equal(estadoVisible(atrasada, HOY), "Atrasado");
assert.equal(
  estadoVisible({ ...atrasada, fechaAcordada: "2099-01-01" }, HOY),
  "Atrasado",
  "atrasada sigue siendo atrasada aunque la fecha no haya pasado: la marcó una persona",
);

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

console.log("✓ agregados.ts — todos los chequeos pasan");
