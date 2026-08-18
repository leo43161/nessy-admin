// Chequeo de lib/reestructura.ts — `node lib/reestructura.check.ts`
//
// Esto es lo que el admin lee antes de apretar "Refinanciar". Si miente, se
// reescribe el cronograma de un cliente con números que nadie revisó y las
// cuotas viejas ya están dadas de baja: no hay vuelta atrás desde el panel.
//
// Lo importante que se comprueba acá es que la previa dé LO MISMO que los
// stored procedures, que reparten así:
//
//     cantidad = FLOOR(total / cuota);  resto = total − cantidad × cuota
//     … cantidad cuotas de `cuota`, y una más por `resto` si resto > 0
import assert from "node:assert/strict";
import { calcularPrevia, totalAGenerar, type DatosPrevios } from "./reestructura.ts";

const base: DatosPrevios = {
  escenario: "reestructurar",
  deudaVieja: 0,
  interes: 0,
  capitalNuevo: 0,
  interesNuevo: 0,
  montoCuota: 0,
  frecuenciaDias: 7,
};

/** El reparto de los SP, replicado a mano para contrastar. */
function comoElSp(total: number, cuota: number): { cantidad: number; montos: number[] } {
  const redondear = (n: number) => Math.round(n * 100) / 100;
  const enteras = Math.floor(redondear(total) / redondear(cuota));
  const resto = redondear(total - enteras * cuota);

  const montos = Array.from({ length: enteras }, () => cuota);
  if (resto > 0) montos.push(resto);

  return { cantidad: montos.length, montos };
}

// ── El ejemplo del cliente, escenario 1 ────────────────────────────────────
// $180.000 de deuda al 80% = $324.000. Más $40.000 al 50% = $60.000.
// Gran total: $384.000.
const refin: DatosPrevios = {
  ...base,
  escenario: "refinanciar",
  deudaVieja: 180000,
  interes: 80,
  capitalNuevo: 40000,
  interesNuevo: 50,
  montoCuota: 12000,
};
assert.equal(totalAGenerar(refin), 384000);

const p1 = calcularPrevia(refin);
assert.equal(p1.cantidadCuotas, 32); // 384.000 / 12.000
assert.equal(p1.exacto, true);
assert.equal(p1.ultimaCuota, 12000);
assert.equal(p1.deudaFinal, 384000);
assert.equal(p1.diasTotales, 32 * 7);

// Refinanciar sin plata nueva: solo la penalización.
assert.equal(totalAGenerar({ ...refin, capitalNuevo: 0, interesNuevo: 0 }), 324000);

// Interés 0 es válido: refinanciar sin recargo no cambia el total.
assert.equal(totalAGenerar({ ...refin, interes: 0, capitalNuevo: 0 }), 180000);

// ── Escenario 2: renovación ────────────────────────────────────────────────
// $50.000 al 100% = $100.000 de deuda nueva, en cuotas de $20.000.
const renov: DatosPrevios = {
  ...base,
  escenario: "renovar",
  deudaVieja: 40000, // le quedaban 2 cuotas de 20.000
  interes: 100,
  capitalNuevo: 50000,
  montoCuota: 20000,
};
assert.equal(totalAGenerar(renov), 100000);

const p2 = calcularPrevia(renov);
assert.equal(p2.cantidadCuotas, 5);
// Renovar ACOPLA: la deuda vieja sigue en pie. Si esto diera 100.000 en vez de
// 140.000, el panel le estaría diciendo al admin que la deuda del cliente BAJÓ
// justo cuando le acaba de prestar más plata.
assert.equal(p2.deudaFinal, 140000);

// ── Escenario 3: reestructuración ──────────────────────────────────────────
// La deuda NO cambia: solo se reparte distinto.
const reest: DatosPrevios = {
  ...base,
  escenario: "reestructurar",
  deudaVieja: 60000,
  interes: 99, // se ignora a propósito en este escenario
  capitalNuevo: 99999,
  montoCuota: 15000,
};
assert.equal(totalAGenerar(reest), 60000);
assert.equal(calcularPrevia(reest).deudaFinal, 60000);
assert.equal(calcularPrevia(reest).cantidadCuotas, 4);

// ── La división que no da exacta ───────────────────────────────────────────
// 100.000 en cuotas de 30.000: tres de 30.000 y una de 10.000.
const inexacto = calcularPrevia({ ...base, deudaVieja: 100000, montoCuota: 30000 });
assert.equal(inexacto.cantidadCuotas, 4);
assert.equal(inexacto.exacto, false);
assert.equal(inexacto.ultimaCuota, 10000);
// La suma tiene que cerrar: 3 × 30.000 + 10.000 = 100.000. Si no cerrara, el
// cliente terminaría debiendo de más o de menos que lo pactado.
assert.equal(3 * 30000 + inexacto.ultimaCuota, 100000);

// ── La previa contra el reparto real de los SP ─────────────────────────────
// Es el chequeo que importa: si alguno de los dos lados cambia el redondeo,
// acá salta.
for (const [total, cuota] of [
  [384000, 12000],
  [100000, 30000],
  [60000, 15000],
  [100000, 20000],
  [1, 1],
  [999.99, 100],
  [12345.67, 1000],
  [50000, 7500],
] as const) {
  const previa = calcularPrevia({ ...base, deudaVieja: total, montoCuota: cuota });
  const sp = comoElSp(total, cuota);

  assert.equal(
    previa.cantidadCuotas,
    sp.cantidad,
    `cantidad distinta para ${total} en cuotas de ${cuota}`,
  );
  assert.equal(
    previa.ultimaCuota,
    sp.montos[sp.montos.length - 1],
    `última cuota distinta para ${total} en cuotas de ${cuota}`,
  );
  // Y el reparto del SP tiene que sumar el total, sin centavos perdidos.
  assert.equal(
    Math.round(sp.montos.reduce((a, m) => a + m, 0) * 100) / 100,
    total,
    `el reparto no suma ${total}`,
  );
}

// ── Bordes ────────────────────────────────────────────────────────────────
// Sin monto de cuota no hay cronograma. Es justo el caso que en el SP daría
// FLOOR(x/0) = NULL y dejaría el plan sin ninguna cuota: por eso la API lo
// rechaza con 400 antes de llamar.
assert.equal(calcularPrevia({ ...base, deudaVieja: 50000, montoCuota: 0 }).cantidadCuotas, 0);
// Sin deuda tampoco.
assert.equal(calcularPrevia({ ...base, deudaVieja: 0, montoCuota: 5000 }).cantidadCuotas, 0);

// Una cuota más grande que la deuda entera: una sola cuota, por la deuda.
const unaSola = calcularPrevia({ ...base, deudaVieja: 5000, montoCuota: 20000 });
assert.equal(unaSola.cantidadCuotas, 1);
assert.equal(unaSola.ultimaCuota, 5000);

console.log("✓ reestructura.ts OK");
