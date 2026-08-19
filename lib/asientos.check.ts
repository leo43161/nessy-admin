// Chequeo de lib/asientos.ts — `npm run check`
//
// Es el extracto que el cliente recibe por escrito: si el saldo corrido no
// cierra con el pie del PDF, o si una fila roja muestra un número que no es lo
// que dice ser, el cliente lee que debe una plata que no debe.
import assert from "node:assert/strict";
import { asientosDelPlan } from "./asientos.ts";
import type { EstadoDeCuentaPlan } from "@/types";

/**
 * El caso reportado, tal cual salió de producción (cliente 124, plan 40):
 *
 *   plan de 150.000 en 5 cuotas semanales de 30.000 desde el 19/08
 *   · 19/08 cobrada
 *   · 19/08 advertencia "No estaba en el domicilio", SIN recargo
 *   · 26/08 atrasada
 *
 * Salían DOS filas rojas seguidas, las dos con 120.000 en la columna SALDO.
 * El cliente las leyó como dos advertencias de 120.000 sobre una cuota de
 * 30.000.
 */
const PLAN: EstadoDeCuentaPlan = {
  planId: 40,
  nombre: "150.000 por 5 cuotas semanales de 30.000",
  status: "Activo",
  montoTotal: 150000,
  cuotasTotales: 5,
  cuotasPagadas: 1,
  pagado: 30000,
  pendiente: 120000,
  vencido: 30000,
  proximaCuota: null,
  movimientos: [
    { fecha: "2026-08-19", concepto: "Cuota cobrada", monto: 30000, estado: "Pagado" },
    {
      fecha: "2026-08-19",
      concepto: "No estaba en el domicilio",
      monto: 0,
      estado: "Recargo",
    },
    { fecha: "2026-08-26", concepto: "Cuota", monto: 30000, estado: "Atrasado" },
  ],
};

const filas = asientosDelPlan(PLAN);
const alarmas = filas.filter((f) => f.alarma);

// 1. Una sola fila roja, no dos: la advertencia sin recargo no movió plata.
assert.equal(alarmas.length, 1, "una advertencia sin recargo no genera una fila propia");
assert.equal(alarmas[0].concepto, "CUOTA ATRASADA", "la fila roja dice qué es");

// 2. SALDO ANTERIOR + ALTA PLAN + las dos cuotas = 4 filas.
assert.equal(filas.length, 4);
assert.equal(filas[0].concepto, "SALDO ANTERIOR");
assert.equal(filas[1].debito, 150000, "el alta del plan es el débito por el total");

// 3. El saldo de la última fila tiene que cerrar con lo que el PDF imprime
//    abajo como SALDO PENDIENTE. Si no, la tabla se contradice con su pie.
assert.equal(filas.at(-1)!.saldo, PLAN.pendiente, "el saldo corrido cierra con plan.pendiente");

// 4. La cuota cobrada acredita; la atrasada no mueve nada.
assert.equal(filas[2].credito, 30000);
assert.equal(filas[3].credito, null);
assert.equal(filas[3].debito, null);

// 5. Las cuotas se numeran 1, 2… sin contar recargos.
assert.deepEqual(
  filas.slice(2).map((f) => f.cuota),
  ["1", "2"],
);

// ── Un recargo de verdad (con monto) SÍ es un débito ──────────────────────
//
// Antes no sumaba ni restaba, así que el extracto terminaba en un saldo
// distinto del `saldo_deudor` que devuelve la API (que sí suma los recargos).
const CON_RECARGO: EstadoDeCuentaPlan = {
  ...PLAN,
  pendiente: 125000,
  movimientos: [
    { fecha: "2026-08-19", concepto: "Cuota cobrada", monto: 30000, estado: "Pagado" },
    { fecha: "2026-08-20", concepto: "Mora", monto: 5000, estado: "Recargo" },
    { fecha: "2026-08-26", concepto: "Cuota", monto: 30000, estado: "Atrasado" },
  ],
};

const conRecargo = asientosDelPlan(CON_RECARGO);
const filaRecargo = conRecargo.find((f) => f.concepto === "MORA")!;

assert.equal(filaRecargo.debito, 5000, "un recargo con monto va en la columna DEBITOS");
assert.equal(filaRecargo.cuota, "", "un recargo no es una cuota: no lleva número");
assert.equal(filaRecargo.alarma, true, "un recargo sí va en rojo");
assert.equal(
  conRecargo.at(-1)!.saldo,
  CON_RECARGO.pendiente,
  "el recargo suma al saldo, como lo suma la API",
);

// ── Orden ─────────────────────────────────────────────────────────────────
// El asiento va del más viejo al más nuevo aunque la API los mande al revés.
const desordenado = asientosDelPlan({
  ...PLAN,
  movimientos: [...PLAN.movimientos].reverse(),
});
assert.equal(desordenado[1].fecha, "19/08/26", "el ALTA PLAN se fecha con el movimiento más viejo");
assert.deepEqual(
  desordenado.map((f) => f.saldo),
  filas.map((f) => f.saldo),
  "el orden de entrada no puede cambiar el saldo corrido",
);

// ── La columna DEBITOS tiene que sumar el saldo ───────────────────────────
//
// Es la cuadratura del extracto: el plan se debita entero en el alta y cada
// recargo suma; los créditos restan. Si la columna no cuadra, el cliente que
// hace la cuenta a mano no le da y llama.
//
// Acá se cayó la fila "PROXIMA CUOTA A VENCER": repetía al pie una cuota que
// ya estaba listada arriba, con su importe en DEBITOS pero sin mover el
// saldo. Y la numeraba `cuotasPagadas + 1`, que con cuotas atrasadas no es la
// próxima sino la más vieja de las que se deben.
const suma = (f: (a: (typeof conRecargo)[number]) => number | null) =>
  conRecargo.reduce((s, a) => s + (f(a) ?? 0), 0);

assert.equal(
  suma((a) => a.debito) - suma((a) => a.credito),
  CON_RECARGO.pendiente,
  "debitos - creditos tiene que dar el saldo pendiente",
);

// Con cuotas atrasadas, ninguna fila puede anunciar una cuota que ya venció
// como si fuera la que viene.
assert.ok(
  !filas.some((f) => f.concepto.includes("PROXIMA")),
  "el asiento no repite la próxima cuota: ya está en la tabla",
);

console.log("✓ asientos.ts OK");
