// Chequeo de lib/cronograma.ts — `node lib/cronograma.check.ts`
//
// Esto es lo que el admin lee antes de apretar Guardar / Refinanciar / Renovar
// / Reestructurar. Si la previa miente, se reescribe el cronograma de un
// cliente con números que nadie revisó, y las cuotas viejas ya están dadas de
// baja: no hay vuelta atrás desde el panel.
//
// Lo que se comprueba es que cada operación replique la regla de QUIEN
// REALMENTE ESCRIBE:
//
//   los 3 SP    cantidad = FLOOR(total / cuota); si sobra resto, una más chica
//               al final. La primera fecha la decide el SP, distinta en cada uno.
//   editar      pasa por PUT /cuotas con fecha y monto de cada cuota, así que
//               reparte parejo y la última absorbe los centavos.
import assert from "node:assert/strict";
import {
  aRepartirAlEditar,
  cantidadPara,
  cuotasSegunSP,
  partirPorEstado,
  primeraFechaNueva,
  resolverPar,
  seDanDeBaja,
  sobreviven,
  type CuotaExistente,
} from "./cronograma.ts";

const suma = (cs: { monto: number }[]) =>
  Math.round(cs.reduce((t, c) => t + c.monto, 0) * 100) / 100;

/* ── el corte por estado ── */

const plan: CuotaExistente[] = [
  { fecha: "2026-07-01", monto: 10000, estado: "Pagado" },
  { fecha: "2026-07-08", monto: 10000, estado: "Pagado" },
  { fecha: "2026-07-15", monto: 10000, estado: "Atrasado" },
  { fecha: "2026-07-22", monto: 10000, estado: "Pendiente" },
  { fecha: "2026-07-29", monto: 10000, estado: "Pendiente" },
];

const corte = partirPorEstado(plan);
assert.equal(corte.cobrado, 20000);
assert.equal(corte.atrasado, 10000);
assert.equal(corte.pendiente, 20000);
assert.equal(corte.pendientes.length, 2);
console.log("✓ cronograma.ts — el corte separa pagado / atrasado / pendiente");

/* ── qué se da de baja en cada operación ── */

// Editar pasa por sp_Editar-PagoPorRealizar, que filtra Estado = 'Pendiente':
// la atrasada del 15/07 sobrevive con su fecha, que es de donde sale la mora.
assert.deepEqual(
  seDanDeBaja("editar", corte).map((c) => c.fecha),
  ["2026-07-22", "2026-07-29"],
);
assert.ok(sobreviven("editar", corte).some((c) => c.estado === "Atrasado"));

// Refinanciar y reestructurar filtran IN ('Pendiente','Atrasado'): solo queda
// lo pagado.
for (const op of ["refinanciar", "reestructurar"] as const) {
  assert.equal(seDanDeBaja(op, corte).length, 3, `${op} da de baja pendientes Y atrasadas`);
  assert.ok(
    sobreviven(op, corte).every((c) => c.estado === "Pagado"),
    `después de ${op} solo pueden quedar cuotas pagadas`,
  );
}

// Renovar no toca nada: acopla al final.
assert.equal(seDanDeBaja("renovar", corte).length, 0);
assert.equal(sobreviven("renovar", corte).length, plan.length);
console.log("✓ cronograma.ts — cada operación da de baja lo que da de baja su SP");

/* ── la regla del SP: enteras + resto, y la última es la CHICA ── */

// 100.000 en cuotas de 30.000 → 3 de 30.000 y una de 10.000. Nunca 3 de 33.333.
const spResto = cuotasSegunSP(100000, 30000, "2026-08-01", 7);
assert.equal(spResto.length, 4);
assert.deepEqual(
  spResto.map((c) => c.monto),
  [30000, 30000, 30000, 10000],
);
assert.equal(suma(spResto), 100000);
assert.ok(
  spResto[spResto.length - 1].monto < spResto[0].monto,
  "la última tiene que ser la chica, como en los SP",
);

// División exacta: no aparece una quinta cuota de cero.
const spExacto = cuotasSegunSP(90000, 30000, "2026-08-01", 7);
assert.equal(spExacto.length, 3);
assert.equal(suma(spExacto), 90000);

// `cantidadPara` tiene que dar lo mismo que generar y contar: es el número que
// se muestra antes de que haya fechas.
for (const [total, cuota] of [
  [100000, 30000],
  [90000, 30000],
  [1680000, 15000],
  [717000, 19916.66],
] as const) {
  assert.equal(
    cantidadPara(total, cuota),
    cuotasSegunSP(total, cuota, "2026-08-01", 7).length,
    `cantidadPara(${total}, ${cuota}) tiene que coincidir con las cuotas generadas`,
  );
}
console.log("✓ cronograma.ts — la regla del SP: enteras + resto, la última más chica");

/* ── las fechas corren de a `frecuenciaDias` ── */

assert.deepEqual(
  cuotasSegunSP(45000, 15000, "2026-08-01", 7).map((c) => c.fecha),
  ["2026-08-01", "2026-08-08", "2026-08-15"],
);
console.log("✓ cronograma.ts — los vencimientos corren de a frecuenciaDias");

/* ── el par monto ↔ cantidad ── */

// Manda el monto: la cantidad sale de la regla que corresponda.
assert.deepEqual(resolverPar(100000, { monto: "30000", cantidad: "", manda: "monto" }, true), {
  montoCuota: 30000,
  cantidad: 4,
});

// Manda la cantidad, sin regla de SP: monto = total / cantidad, clavado.
assert.deepEqual(resolverPar(90000, { monto: "", cantidad: "3", manda: "cantidad" }, false), {
  montoCuota: 30000,
  cantidad: 3,
});

// Manda la cantidad CON regla de SP: pedir 3 de algo que no divide exacto
// puede dar 3 igual, porque el monto se redondea hacia arriba en centavos.
const pedido = resolverPar(100000, { monto: "", cantidad: "3", manda: "cantidad" }, true);
assert.equal(
  pedido.cantidad,
  cuotasSegunSP(100000, pedido.montoCuota, "2026-08-01", 7).length,
  "lo que dice el resumen tiene que ser lo que se va a generar",
);

// Sin datos no se inventa nada.
assert.deepEqual(resolverPar(0, { monto: "30000", cantidad: "", manda: "monto" }, true), {
  montoCuota: 0,
  cantidad: 0,
});
assert.deepEqual(resolverPar(100000, { monto: "0", cantidad: "", manda: "monto" }, true), {
  montoCuota: 0,
  cantidad: 0,
});
console.log("✓ cronograma.ts — monto ↔ cantidad se derivan sin contradecirse");

/* ── dónde arranca cada operación ── */

const HOY = "2026-08-21";

// Refinanciar: la fecha que eligió el admin.
assert.equal(primeraFechaNueva("refinanciar", plan, 7, "2026-09-01", HOY), "2026-09-01");

// Renovar: se acopla DESPUÉS de la última agendada (29/07 + 7 = 05/08).
assert.equal(primeraFechaNueva("renovar", plan, 7, "", HOY), "2026-08-05");

// Reestructurar: la más vieja de las impagas — la ATRASADA del 15/07, no la
// primera pendiente. Es lo que hace MIN(fecha_acordada) sobre las no pagadas.
assert.equal(primeraFechaNueva("reestructurar", plan, 7, "", HOY), "2026-07-15");

// Reestructurar sin impagas: cae en HOY, como el IFNULL del SP.
assert.equal(
  primeraFechaNueva("reestructurar", [{ fecha: "2026-07-01", monto: 1, estado: "Pagado" }], 7, "", HOY),
  HOY,
);

// Renovar sin cronograma: no hay final donde acoplar. La previa no inventa una
// fecha — la API contesta 409 en ese caso.
assert.equal(primeraFechaNueva("renovar", [], 7, "", HOY), null);
console.log("✓ cronograma.ts — cada operación arranca donde arranca su SP");

/* ── editar: qué queda para repartir ── */

// Total nuevo 120.000 sobre un plan con 20.000 cobrados y 10.000 atrasados:
// las pendientes nuevas cubren 90.000.
assert.equal(aRepartirAlEditar(120000, corte), 90000);

// Bajar el total por debajo de lo intocable no deja nada que repartir: el
// diálogo tiene que frenar en vez de generar cuotas negativas.
assert.ok(aRepartirAlEditar(25000, corte) < 0);
console.log("✓ cronograma.ts — editar reparte solo lo que no está cobrado ni atrasado");

console.log("✓ cronograma.ts OK");
