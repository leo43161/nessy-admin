// Chequeo de lib/cumplimiento.ts — `node lib/cumplimiento.check.ts`
//
// Este número va impreso en el PDF que recibe el cliente: si está mal, se lo
// estamos afirmando por escrito.
import assert from "node:assert/strict";
import { calcularCumplimiento } from "./cumplimiento.ts";
import type { EstadoDeCuenta, EstadoDeCuentaMovimiento } from "../types/index.ts";

const HOY = "2026-08-12";

const mov = (
  fecha: string,
  estado: EstadoDeCuentaMovimiento["estado"],
  monto = 1000,
): EstadoDeCuentaMovimiento => ({ fecha, estado, monto, concepto: "Cuota" });

const ec = (movimientos: EstadoDeCuentaMovimiento[]): EstadoDeCuenta => ({
  clienteId: 1,
  clienteNombre: "Test",
  generadoEl: HOY,
  totalPagado: 0,
  saldoPendiente: 0,
  totalVencido: 0,
  planes: [
    {
      planId: 1,
      nombre: "Plan",
      status: "Activo",
      montoTotal: 0,
      cuotasTotales: 0,
      cuotasPagadas: 0,
      pagado: 0,
      pendiente: 0,
      vencido: 0,
      proximaCuota: null,
      movimientos,
    },
  ],
});

/* ── al día: nada vencido ── */
const alDia = calcularCumplimiento(
  ec([mov("2026-07-10", "Pagado"), mov("2026-08-10", "Pagado"), mov("2026-09-10", "Pendiente")]),
  HOY,
);
assert.equal(alDia.cuotasTotales, 3);
assert.equal(alDia.cuotasPagadas, 2);
assert.equal(alDia.cuotasAtrasadas, 0);
assert.equal(alDia.efectividad, 100, "una cuota futura sin pagar no es un atraso");

/* ── una de cuatro vencida ── */
const conAtraso = calcularCumplimiento(
  ec([
    mov("2026-06-10", "Pagado"),
    mov("2026-07-10", "Pendiente"), // vencida
    mov("2026-08-10", "Pagado"),
    mov("2026-09-10", "Pendiente"),
  ]),
  HOY,
);
assert.equal(conAtraso.cuotasAtrasadas, 1);
assert.equal(conAtraso.efectividad, 75);

/* ── todo vencido ── */
const todoMal = calcularCumplimiento(
  ec([mov("2026-01-10", "Pendiente"), mov("2026-02-10", "Pendiente")]),
  HOY,
);
assert.equal(todoMal.efectividad, 0);

/* ── cliente nuevo, sin cuotas ── */
assert.equal(calcularCumplimiento(ec([]), HOY).efectividad, 100, "sin cuotas no debe nada");

/* ── las advertencias salen aparte y no ensucian el porcentaje ── */
const conAdvertencia = calcularCumplimiento(
  ec([
    mov("2026-07-10", "Pagado"),
    { fecha: "2026-07-15", concepto: "Cliente incomunicado", monto: 500, estado: "Recargo" },
  ]),
  HOY,
);
assert.equal(conAdvertencia.cuotasTotales, 1, "una advertencia no es una cuota");
assert.equal(conAdvertencia.efectividad, 100);
assert.deepEqual(conAdvertencia.advertencias, [
  { fecha: "2026-07-15", motivo: "Cliente incomunicado", recargo: 500 },
]);

/* ── el porcentaje se redondea a un decimal, no a un número interminable ── */
const tercios = calcularCumplimiento(
  ec([mov("2026-01-01", "Pendiente"), mov("2026-01-02", "Pagado"), mov("2026-01-03", "Pagado")]),
  HOY,
);
assert.equal(tercios.efectividad, 66.7);

console.log("✓ cumplimiento.ts OK");
