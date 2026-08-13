// Chequeo de services/mapear.ts —  `npm run check`
//
// Las filas de abajo son capturas literales de la API en producción
// (https://tucucompras.com.ar/fv1, 2026-08-05), no invenciones. Cubre lo que
// muerde de verdad al traducir: los DECIMAL que llegan como string, los
// tinyint que no son booleanos, el estado "Atrasado" que el front no tiene,
// y los NULL que el tipo declara obligatorios.
import assert from "node:assert/strict";
import {
  aBooleanoNullable,
  aCliente,
  aCobrador,
  aCuota,
  aEstadoCuota,
  aNumero,
  aPlan,
  aTelefonos,
  type FilaCliente,
  type FilaCobrador,
  type FilaCuota,
  type FilaPlan,
} from "./mapear.ts";
import type { ClienteListado } from "../types/index.ts";

// ── Fila real de GET /cuotas ────────────────────────────────────────
const FILA_CUOTA: FilaCuota = {
  id_Pagos_por_realizar: 101,
  id_Plan_de_pago: 12,
  fecha_acordada: "2026-05-04",
  Monto_esperado: "75000.00",
  Estado: "Pagado",
  Dentro_Rango: null,
  WhatsApp_Enviado: null,
  vencida: 0,
  plan_nombre: "Préstamo de Mercadería (May)",
  plan_status: "Completado",
  plan_monto_total: "150000.00",
  id_Clientes: 105,
  cliente_nombre: "Kiosco El Milagro",
  cliente_dni: null,
  cliente_direccion: "Av. Mate de Luna 2500",
  cliente_ubicacion: null,
  id_cobrador_asignado: 5,
  cobradores_asignados: "5",
  cobrador_asignado_nombre: "Juan Pérez",
  id_cobrador_cobro: 5,
  monto_abonado: "75000.00",
  fecha_de_pago: "2026-05-04 10:00:00",
  id_metodo_de_pago: 1,
};

// ── Fila real de GET /clientes (comercio sin DNI y sin status) ──────
const FILA_CLIENTE: FilaCliente = {
  id_Clientes: 105,
  DNI: null,
  Nombre_completo: "Kiosco El Milagro",
  email: null,
  codigo_postal: null,
  direccion: "Av. Mate de Luna 2500",
  casa_o_dpt_direcc_1: null,
  direccion_laboral_o_alternativa: null,
  casa_o_dpt_direcc_2: null,
  ubicacion_geografica_de_destino_de_cobro: null,
  img: null,
  status: null,
  fecha_de_nacimiento: null,
  id_localidad: 1,
  nombre_localidad: "San Miguel de Tucumán",
  id_Cuenta_Corriente: 88,
  telefonos: ["381-555-1234"],
};

const FILA_COBRADOR: FilaCobrador = {
  id_Cobradores: 5,
  DNI: null,
  Nombre_completo: "Juan Pérez",
  email: null,
  codigo_postal: null,
  direccion: null,
  casa_o_dpt_direcc_1: null,
  direccion_laboral_o_alternativa: null,
  casa_o_dpt_direcc_2: null,
  img: null,
  fecha_de_nacimiento: null,
  id_localidad: null,
};

const FILA_PLAN: FilaPlan = {
  id_Plan_de_pagos: 12,
  Nombre: "Préstamo de Mercadería (May)",
  Monto_total: "150000.00",
  Status: "Completado",
  id_cliente: 105,
  id_Cuenta_Corriente: 88,
};

// ── DECIMAL llega como string ───────────────────────────────────────
assert.equal(aNumero("75000.00"), 75000, "los DECIMAL vienen como string");
assert.equal(aNumero(null), 0, "NULL suma 0, no NaN");
assert.equal(aNumero(""), 0);
assert.equal(aNumero("no-es-un-numero"), 0, "basura no puede propagar NaN a los totales");
// Si esto se rompiera, el cierre de caja concatenaría en vez de sumar.
assert.equal(aNumero("75000.00") + aNumero("75000.00"), 150000);

// ── tinyint(1) ──────────────────────────────────────────────────────
assert.equal(aBooleanoNullable(1), true);
assert.equal(aBooleanoNullable(0), false);
assert.equal(aBooleanoNullable(null), null, "sin ubicación no es lo mismo que fuera de rango");

// ── Estados: la base manda tres, el front no tiene "Atrasado" ───────
assert.equal(aEstadoCuota("Pagado"), "Pagado");
assert.equal(aEstadoCuota("Pendiente"), "Pendiente");
assert.equal(
  aEstadoCuota("Atrasado"),
  "Pendiente",
  "Atrasado cae en Pendiente: el front deriva Vencido por fecha y ESTADO[] no tiene esa clave",
);
assert.equal(aEstadoCuota(null), "Pendiente");

// ── Teléfonos: la API los aplana a string[] ─────────────────────────
assert.deepEqual(aTelefonos(["381-555-1234"]), [{ id: 1, numero: "381-555-1234" }]);
assert.deepEqual(aTelefonos(undefined), [], "un cliente sin teléfonos no puede romper el map");

// ── Cliente ─────────────────────────────────────────────────────────
const cliente = aCliente(FILA_CLIENTE, 5, "Juan Pérez");
assert.equal(cliente.dni, "", "hay comercios sin DNI en producción (N.3)");
assert.equal(cliente.status, "Activo", "la columna status está en NULL para todas las filas");
assert.equal(cliente.localidadNombre, "San Miguel de Tucumán");
assert.equal(cliente.telefonos.length, 1);
assert.equal(cliente.cobradorAsignadoNombre, "Juan Pérez");

// ── Cobrador ────────────────────────────────────────────────────────
assert.equal(aCobrador(FILA_COBRADOR).id, 5, "la PK es id_Cobradores, no id");
assert.equal(aCobrador(FILA_COBRADOR).nombreCompleto, "Juan Pérez");

// ── Cuota, con y sin contexto ───────────────────────────────────────
const CLIENTES = new Map<number, ClienteListado>([[105, cliente]]);
const COBRADORES = new Map<number, string>([[5, "Juan Pérez"]]);

const cuota = aCuota(FILA_CUOTA, CLIENTES, COBRADORES);
assert.equal(cuota.id, 101, "la PK es id_Pagos_por_realizar");
assert.equal(cuota.montoEsperado, 75000);
assert.equal(typeof cuota.montoEsperado, "number", "si queda string, agregados.ts concatena");
assert.equal(cuota.estado, "Pagado");
assert.equal(cuota.dentroRango, null);
assert.equal(cuota.cobradoPorId, 5);
assert.equal(cuota.cobradoPorNombre, "Juan Pérez", "el nombre sale de /cobradores, no de /cuotas");
assert.equal(cuota.cliente.telefonos.length, 1, "los teléfonos los aporta /clientes");
assert.equal(cuota.cliente.localidadNombre, "San Miguel de Tucumán");

// Sin contexto se cae a lo que trajo la fila, sin romper.
const suelta = aCuota(FILA_CUOTA, new Map(), new Map());
assert.equal(suelta.cliente.nombreCompleto, "Kiosco El Milagro");
assert.equal(suelta.cliente.telefonos.length, 0);
assert.equal(suelta.cobradoPorNombre, "—");

// Cuota sin cobrador asignado: tiene que caer en una columna, no desaparecer.
const huerfana = aCuota(
  { ...FILA_CUOTA, id_cobrador_asignado: null, cobrador_asignado_nombre: null },
  new Map(),
  new Map(),
);
assert.equal(huerfana.cobradorAsignadoId, 0);
assert.equal(huerfana.cobradorAsignadoNombre, "Sin asignar");

// ── Plan ────────────────────────────────────────────────────────────
const plan = aPlan(FILA_PLAN, [cuota, { ...cuota, id: 102, estado: "Pendiente" }], CLIENTES);
assert.equal(plan.montoTotal, 150000);
assert.equal(plan.cuotasTotales, 2);
assert.equal(plan.cuotasCobradas, 1);
assert.equal(plan.pagado, 75000, "solo suma las cobradas");
assert.equal(plan.clienteNombre, "Kiosco El Milagro");

console.log("✓ mapear.ts OK");
