// Chequeo de lib/estado-cuenta-por-plan.ts — `node lib/estado-cuenta-por-plan.check.ts`
//
// Los totales que devuelve esto van impresos en el PDF que recibe el cliente.
// Si quedan los de la cuenta entera en un PDF de un solo plan, le estamos
// afirmando por escrito que debe plata que ese plan no le reclama.
import assert from "node:assert/strict";
import { soloElPlan } from "./estado-cuenta-por-plan.ts";
import type { EstadoDeCuenta, EstadoDeCuentaPlan } from "../types/index.ts";

const plan = (
  planId: number,
  pagado: number,
  pendiente: number,
  vencido: number,
): EstadoDeCuentaPlan => ({
  planId,
  nombre: `Plan ${planId}`,
  status: "Activo",
  montoTotal: pagado + pendiente,
  cuotasTotales: 4,
  cuotasPagadas: 1,
  pagado,
  pendiente,
  vencido,
  proximaCuota: null,
  movimientos: [],
});

const cuenta: EstadoDeCuenta = {
  clienteId: 7,
  clienteNombre: "Test",
  generadoEl: "2026-08-18",
  planes: [plan(1, 1000, 500, 0), plan(2, 2000, 800, 300), plan(3, 0, 400, 400)],
  totalPagado: 3000,
  saldoPendiente: 1700,
  totalVencido: 700,
};

// Sin planId no se toca nada: es el mismo objeto, no una copia.
assert.equal(soloElPlan(cuenta), cuenta);
assert.equal(soloElPlan(cuenta, undefined), cuenta);

// Un plan: queda ese solo Y los totales se recalculan sobre él.
const dos = soloElPlan(cuenta, 2);
assert.deepEqual(
  dos.planes.map((p) => p.planId),
  [2],
);
assert.equal(dos.totalPagado, 2000);
assert.equal(dos.saldoPendiente, 800);
assert.equal(dos.totalVencido, 300);

// El plan sin vencido no arrastra el vencido de los otros: si arrastrara, el
// PDF saldría con el resaltador rojo sobre un plan que está al día.
const uno = soloElPlan(cuenta, 1);
assert.equal(uno.totalVencido, 0);
assert.equal(uno.totalPagado, 1000);
assert.equal(uno.saldoPendiente, 500);

// Los datos del cliente no se pierden en el recorte.
assert.equal(uno.clienteId, 7);
assert.equal(uno.clienteNombre, "Test");
assert.equal(uno.generadoEl, "2026-08-18");

// La cuenta original queda intacta: el panel la sigue mostrando entera
// después de generar un PDF de un plan.
assert.equal(cuenta.planes.length, 3);
assert.equal(cuenta.totalPagado, 3000);

// Un id que no existe devuelve la cuenta completa, no un PDF en cero.
assert.equal(soloElPlan(cuenta, 999), cuenta);

// La suma de los recortes tiene que dar la cuenta entera: si no, hay plata
// que se cuenta dos veces o que no aparece en ningún PDF.
const porPlan = cuenta.planes.map((p) => soloElPlan(cuenta, p.planId));
assert.equal(
  porPlan.reduce((a, ec) => a + ec.totalPagado, 0),
  cuenta.totalPagado,
);
assert.equal(
  porPlan.reduce((a, ec) => a + ec.saldoPendiente, 0),
  cuenta.saldoPendiente,
);
assert.equal(
  porPlan.reduce((a, ec) => a + ec.totalVencido, 0),
  cuenta.totalVencido,
);

console.log("✓ estado-cuenta-por-plan.ts OK");
