// Chequeo de lib/cuotas.ts — `node lib/cuotas.check.ts`
//
// Es plata y son fechas de vencimiento: un centavo mal repartido deja planes
// que nunca cierran, y un día mal calculado le cambia el vencimiento al cliente.
import assert from "node:assert/strict";
import {
  calcularResumen,
  cuotasNecesarias,
  diasEntre,
  duracionEnPalabras,
  fechasDeCuotas,
  montoPorCuota,
  repartir,
  sumarMeses,
  totalConInteres,
} from "./cuotas.ts";

/* ── interés ── */
assert.equal(totalConInteres(100_000, 25), 125_000);
assert.equal(totalConInteres(100_000, 0), 100_000, "sin interés el total no cambia");
assert.equal(totalConInteres(25_000, 33.5), 33_375);

/* ── el monto por cuota manda sobre la cantidad ── */
assert.equal(cuotasNecesarias(25_000, 5_000), 5, "el caso del pedido: 25.000 en cuotas de 5.000");
assert.equal(cuotasNecesarias(100_000, 20_000), 5);
// Lo que sobra es una cuota más chica, no una cuota menos.
assert.equal(cuotasNecesarias(105_000, 20_000), 6);
assert.equal(cuotasNecesarias(25_000, 0), 0, "sin monto no hay cuotas");

/* ── y al revés: cantidad → monto ── */
assert.equal(montoPorCuota(25_000, 12), 2_083.33, "el otro caso del pedido");
assert.equal(montoPorCuota(100_000, 5), 20_000);

/* ── el reparto tiene que cerrar EXACTO ── */
const doce = repartir(25_000, 12);
assert.equal(doce.length, 12);
assert.equal(
  doce.reduce((s, c) => s + c, 0).toFixed(2),
  "25000.00",
  "el cronograma tiene que sumar el total: para eso existe el monto por cuota",
);
assert.equal(doce[0], 2_083.33, "todas iguales…");
assert.equal(doce[11], 2_083.37, "…menos la última, que se come la diferencia");

// Un caso que divide exacto no debe tocar la última.
const cinco = repartir(100_000, 5);
assert.deepEqual(cinco, [20_000, 20_000, 20_000, 20_000, 20_000]);

// Un solo pago.
assert.deepEqual(repartir(7_777.77, 1), [7_777.77]);

/* ── fechas: mensual cae el MISMO día del mes ── */
assert.deepEqual(fechasDeCuotas({ periodo: "Mensual", cada: 1, primeraFecha: "2026-01-10" }, 4), [
  "2026-01-10",
  "2026-02-10",
  "2026-03-10",
  "2026-04-10",
]);

// El 31 no existe en febrero: cae al último día, pero marzo vuelve al 31.
assert.deepEqual(fechasDeCuotas({ periodo: "Mensual", cada: 1, primeraFecha: "2026-01-31" }, 3), [
  "2026-01-31",
  "2026-02-28",
  "2026-03-31",
]);
assert.equal(sumarMeses("2024-01-31", 1), "2024-02-29", "2024 es bisiesto");

// Fin de año.
assert.equal(sumarMeses("2026-12-15", 1), "2027-01-15");

/* ── el resto de los períodos ── */
assert.deepEqual(fechasDeCuotas({ periodo: "Quincenal", cada: 1, primeraFecha: "2026-08-01" }, 3), [
  "2026-08-01",
  "2026-08-16",
  "2026-08-31",
]);
assert.deepEqual(fechasDeCuotas({ periodo: "Semanal", cada: 1, primeraFecha: "2026-08-03" }, 3), [
  "2026-08-03",
  "2026-08-10",
  "2026-08-17",
]);
// Cada 2 semanas.
assert.deepEqual(fechasDeCuotas({ periodo: "Semanal", cada: 2, primeraFecha: "2026-08-03" }, 3), [
  "2026-08-03",
  "2026-08-17",
  "2026-08-31",
]);
// Cada día, y cada 3 días.
assert.deepEqual(fechasDeCuotas({ periodo: "Diaria", cada: 1, primeraFecha: "2026-08-30" }, 3), [
  "2026-08-30",
  "2026-08-31",
  "2026-09-01",
]);
assert.deepEqual(fechasDeCuotas({ periodo: "Diaria", cada: 3, primeraFecha: "2026-08-01" }, 3), [
  "2026-08-01",
  "2026-08-04",
  "2026-08-07",
]);

/* ── el cronograma completo ── */
const r = calcularResumen(100_000, 25, 5, {
  periodo: "Mensual",
  cada: 1,
  primeraFecha: "2026-08-10",
});
assert.equal(r.totalFinanciado, 125_000);
assert.equal(r.cuotas.length, 5);
assert.equal(r.cuotas[0].monto, 25_000);
assert.equal(r.ultimaFecha, "2026-12-10");
assert.equal(
  r.cuotas.reduce((s, c) => s + c.monto, 0),
  125_000,
);

// Fechas a mano: mandan sobre el período, y se ordenan.
const manual = calcularResumen(
  30_000,
  0,
  99,
  { periodo: "Mensual", cada: 1, primeraFecha: "2026-08-10" },
  ["2026-09-05", "2026-08-15", "2026-10-01"],
);
assert.deepEqual(
  manual.cuotas.map((c) => c.fecha),
  ["2026-08-15", "2026-09-05", "2026-10-01"],
  "las fechas cargadas a mano se ordenan y le ganan a la cantidad calculada",
);
assert.equal(manual.cuotas.length, 3);
assert.equal(manual.cuotas[0].monto, 10_000);

/* ── duración ── */
assert.equal(diasEntre("2026-08-10", "2026-12-10"), 122);
assert.equal(duracionEnPalabras(122), "4 meses y 2 días");
assert.equal(duracionEnPalabras(60), "2 meses");
assert.equal(duracionEnPalabras(1), "1 día");
assert.equal(duracionEnPalabras(0), "un solo pago");

console.log("✓ cuotas.ts OK");
