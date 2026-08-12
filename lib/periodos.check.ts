// Chequeo de lib/periodos.ts — `node lib/periodos.check.ts`
//
// Un borde mal calculado deja cobros afuera del cierre sin que nadie lo note:
// los totales dan menos y parecen datos, no un bug.
import assert from "node:assert/strict";
import { periodoDeRango, rangoDePeriodo } from "./periodos.ts";

// Miércoles 12 de agosto de 2026.
const HOY = "2026-08-12";

assert.deepEqual(rangoDePeriodo("hoy", HOY), { desde: HOY, hasta: HOY });

// La semana va de lunes a domingo, no de domingo a sábado.
assert.deepEqual(rangoDePeriodo("semana", HOY), { desde: "2026-08-10", hasta: "2026-08-16" });

// Un domingo pertenece a la semana que arrancó el lunes anterior.
assert.deepEqual(rangoDePeriodo("semana", "2026-08-16"), {
  desde: "2026-08-10",
  hasta: "2026-08-16",
});
// Y un lunes es el primer día de la suya.
assert.deepEqual(rangoDePeriodo("semana", "2026-08-10"), {
  desde: "2026-08-10",
  hasta: "2026-08-16",
});

// El mes completo, hasta el último día real.
assert.deepEqual(rangoDePeriodo("mes", HOY), { desde: "2026-08-01", hasta: "2026-08-31" });
assert.deepEqual(rangoDePeriodo("mes", "2026-02-05"), { desde: "2026-02-01", hasta: "2026-02-28" });
assert.deepEqual(rangoDePeriodo("mes", "2024-02-05"), {
  desde: "2024-02-01",
  hasta: "2024-02-29",
});

assert.deepEqual(rangoDePeriodo("mesPasado", HOY), { desde: "2026-07-01", hasta: "2026-07-31" });
// En enero, el mes pasado es diciembre del año anterior.
assert.deepEqual(rangoDePeriodo("mesPasado", "2026-01-15"), {
  desde: "2025-12-01",
  hasta: "2025-12-31",
});

// Los últimos 3 incluyen el actual: junio, julio y lo que va de agosto.
assert.deepEqual(rangoDePeriodo("tresMeses", HOY), { desde: "2026-06-01", hasta: HOY });
// Cruzando el año.
assert.deepEqual(rangoDePeriodo("tresMeses", "2026-02-10"), {
  desde: "2025-12-01",
  hasta: "2026-02-10",
});

assert.deepEqual(rangoDePeriodo("anio", HOY), { desde: "2026-01-01", hasta: "2026-12-31" });

/* ── el chip se vuelve a marcar solo al recargar ── */
assert.equal(periodoDeRango({ desde: HOY, hasta: HOY }, HOY), "hoy");
assert.equal(periodoDeRango({ desde: "2026-08-10", hasta: "2026-08-16" }, HOY), "semana");
assert.equal(periodoDeRango({ desde: "2026-07-01", hasta: "2026-07-31" }, HOY), "mesPasado");
assert.equal(
  periodoDeRango({ desde: "2026-03-03", hasta: "2026-04-04" }, HOY),
  "personalizado",
  "un rango que no coincide con ninguno queda como personalizado",
);

console.log("✓ periodos.ts OK");
