// ════════════════════════════════════════════════════════════════
//  Modelos de datos alineados al esquema real de la DB (SQL_21-7)
//  Tablas: Clientes, Referentes, Cobradores, Telefonos, Notas,
//  Cuenta/Roles, Localidades_y_regiones, Cuenta_Corriente,
//  Plan_de_pagos, Pagos_por_realizar, Pagos_realizados,
//  Advertencias_y_retrasos
// ════════════════════════════════════════════════════════════════

/**
 * Estado de la cuota, tal como lo guarda `Pagos_por_realizar.Estado`.
 *
 * Los tres de la maqueta no viven acá: `Incomunicado` es una advertencia,
 * `Adelanto` se deduce del monto cobrado y `Recargo` sale de una advertencia.
 *
 * `Atrasado` NO es lo mismo que vencido: vencido lo dice el calendario
 * (pendiente + fecha pasada), atrasado lo pone el cobrador cuando fue y no
 * pudo cobrar. Una cuota que nadie visitó hace meses está vencida pero no
 * atrasada, y esa diferencia es lo que separa una gestión fallida de una
 * cuota abandonada.
 */
export type PagoEstado = "Pendiente" | "Pagado" | "Atrasado";

/** Plan_de_pagos.Status */
export type PlanStatus = "Activo" | "Completado" | "Incumplido" | "Refinanciado";

/**
 * `Clientes.status`. **No es la baja del cliente** — eso es `Clientes.Activo`,
 * que maneja el borrado lógico (`DELETE /clientes`). Esta columna es una
 * etiqueta libre que la base trae en NULL para todas las filas y que el panel
 * solo muestra: no se edita desde el formulario.
 */
export type ClienteStatus = "Activo" | "Inactivo";

export interface Localidad {
  id: number;
  nombre: string;
} 

/** Campos compartidos por Clientes / Referentes / Cobradores en la DB */
export interface PersonaBase {
  id: number;
  dni: string;
  nombreCompleto: string;
  email: string | null;
  codigoPostal: string | null;
  direccion: string | null;
  casaODeptoDirecc1: string | null;
  direccionLaboralOAlternativa: string | null;
  casaODeptoDirecc2: string | null;
  img: string | null;
  fechaDeNacimiento: string | null; // YYYY-MM-DD
  idLocalidad: number | null;
}

export interface Cliente extends PersonaBase {
  /** ubicacion_geografica_de_destino_de_cobro */
  ubicacionCobro: string | null;
  status: ClienteStatus;
}

export type Referente = PersonaBase;

export type Cobrador = PersonaBase;

/** Telefonos es polimórfica (id_tabla + id_entidad): una entidad tiene N teléfonos */
export interface Telefono {
  id: number;
  numero: string;
}

export interface Nota {
  id: number;
  idCliente: number;
  nota: string;
  fechaDeCreacion: string; // YYYY-MM-DD
  fechaUltimaEdicion: string | null;
}

export interface CuentaCorriente {
  id: number;
  idCliente: number;
  fechaDeCreacion: string;
}

export interface PlanDePagos {
  id: number;
  idCuentaCorriente: number;
  nombre: string;
  montoTotal: number;
  status: PlanStatus;
}

export interface PagoPorRealizar {
  id: number;
  idPlanDePago: number;
  fechaAcordada: string; // YYYY-MM-DD
  montoEsperado: number;
  /** false → el admin lo ve como cobro fuera de rango */
  dentroRango: boolean | null;
  estado: PagoEstado;
}

export interface PagoRealizado {
  id: number;
  idPago: number;
  /** Quién cobró realmente (≠ asignado ⇒ asistencia) */
  idCobrador: number;
  concepto: string;
  fechaDePago: string;
}

// ── Auth (tablas Cuenta / Roles / Cuenta_Cobrador) ──

export interface Cuenta {
  id: number;
  nombreDeUsuario: string;
  rol: string;
  /** Roles.id_Roles — 1 admin, 2 cobrador (config/config.php de la API) */
  rolId: number;
}

export interface LoginPayload {
  usuario: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  cuenta: Cuenta;
  /** null para el admin: su cuenta no está ligada a ningún cobrador */
  cobrador: Cobrador | null;
}

// ── View models (lo que arman los SP / endpoints para la UI) ──

/** Cobro del día: pago por realizar + plan + cliente + cobrador asignado */
export interface CobroDelDia {
  id: number; // id del pago por realizar
  planId: number;
  planNombre: string;
  fechaAcordada: string;
  montoEsperado: number;
  estado: PagoEstado;
  dentroRango: boolean | null;
  /** `Pagos_por_realizar.WhatsApp_Enviado`: si ya se le mandó el comprobante */
  whatsappEnviado: boolean;
  cobradorAsignadoId: number;
  cobradorAsignadoNombre: string;
  /** Quién lo cobró, si ya se registró (≠ asignado ⇒ asistencia) */
  cobradoPorId: number | null;
  cobradoPorNombre: string | null;
  cliente: ClienteListado;
}

/** Cliente resumido para listados */
export interface ClienteListado {
  id: number;
  dni: string;
  nombreCompleto: string;
  status: ClienteStatus;
  direccion: string | null;
  ubicacionCobro: string | null;
  idLocalidad: number | null;
  localidadNombre: string | null;
  telefonos: Telefono[];
  cobradorAsignadoId: number | null;
  cobradorAsignadoNombre: string | null;
}

/** Referente de un cliente: puede ser de la tabla Referentes o un cliente-referente */
export interface ReferenteDeCliente {
  tipo: "Referente" | "Cliente";
  id: number;
  dni: string;
  nombreCompleto: string;
  direccion: string | null;
  localidadNombre: string | null;
  telefonos: Telefono[];
}

/** Detalle completo para el modal de cliente */
export interface ClienteDetalle {
  cliente: Cliente;
  localidadNombre: string | null;
  telefonos: Telefono[];
  cobradorAsignadoNombre: string | null;
  referentes: ReferenteDeCliente[];
  notas: Nota[];
  estadoDeCuenta: EstadoDeCuenta;
}

/** Estado de cuenta del cliente (para mostrar y compartir) */
export interface EstadoDeCuenta {
  clienteId: number;
  clienteNombre: string;
  generadoEl: string;
  planes: EstadoDeCuentaPlan[];
  totalPagado: number;
  saldoPendiente: number;
  totalVencido: number;
}

export interface EstadoDeCuentaPlan {
  planId: number;
  nombre: string;
  status: PlanStatus;
  montoTotal: number;
  cuotasTotales: number;
  cuotasPagadas: number;
  pagado: number;
  pendiente: number;
  vencido: number;
  /** `cuotaId` es `Pagos_por_realizar.id`: es lo que recibe POST /cobros */
  proximaCuota: { cuotaId: number | null; fecha: string; monto: number } | null;
  /** Últimos movimientos del plan (cuotas con estado registrado) */
  movimientos: EstadoDeCuentaMovimiento[];
}

/**
 * `/estado_cuenta` mezcla cuotas y advertencias en la misma lista, así que un
 * movimiento puede ser un recargo aunque una cuota no pueda serlo (N.2).
 */
export type MovimientoEstado = PagoEstado | "Recargo";

export interface EstadoDeCuentaMovimiento {
  fecha: string;
  concepto: string;
  monto: number;
  estado: MovimientoEstado;
}

// ════════════════════════════════════════════════════════════════
//  Vista del ADMIN
//  La maqueta HTML trabajaba con un esquema propio en inglés. Acá se
//  usa el modelo real; el mapeo es:
//    do_payments              → CobroDelDia (Pagos_por_realizar)
//    special_case_cobrador_id → cobradoPorId ≠ cobradorAsignadoId
//    Overdue                  → derivado: Pendiente + fecha pasada
//    Unreachable              → una advertencia sobre el plan, no un estado
//    Refinanced               → PlanDePagos.status, no es estado de cuota
// ════════════════════════════════════════════════════════════════

/** Filtro de fecha de la topbar: un día o un rango */
export interface RangoFechas {
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD (= desde en modo "día")
}

/** Estado que muestra la UI del admin: el de la cuota, más "Vencido" derivado */
export type EstadoVisible = PagoEstado | "Vencido";

/** Una columna del kanban de Operaciones */
export interface ColumnaCobrador {
  cobradorId: number;
  nombre: string;
  color: string;
  cobros: CobroDelDia[];
  montoEsperado: number;
  conteo: Record<EstadoVisible, number>;
}

/** Totales del período (tarjeta de Cierre) */
export interface BalancePeriodo {
  esperado: number;
  cobrado: number;
  pendiente: number;
  /** Vencido: lo que se esperaba y no entró */
  deficit: number;
  /** cobrado / esperado, en % */
  efectividad: number;
}

/** Una fila del ledger de cierre de un cobrador */
export interface LedgerItem {
  cobroId: number;
  clienteNombre: string;
  telefonos: Telefono[];
  monto: number;
  tipo: "propio" | "apoyo" | "vencido";
  /** En "apoyo": a qué cobrador se le cubrió la cuota */
  cubreA: string | null;
}

/** Cierre de caja de un cobrador en el período */
export interface CierreCobrador {
  cobradorId: number;
  nombre: string;
  color: string;
  /** Plata que tiene que entregar: sus cobros propios + los que cubrió */
  aEntregar: number;
  items: LedgerItem[];
}

/** Fila de "Tasa de éxito por cobrador" (Análisis) */
export interface PerformanceCobrador {
  cobradorId: number;
  nombre: string;
  color: string;
  /** (cobradas propias + con apoyo) / asignadas, en % */
  efectividad: number;
  cobradasPropias: number;
  cobradasConApoyo: number;
  fallidas: number;
  pendientes: number;
  total: number;
}

/** Fila de la tabla de cobros cruzados (Análisis) */
export interface CobroCruzado {
  cobroId: number;
  fecha: string;
  clienteNombre: string;
  asignadoA: string;
  cobradoPor: string;
  monto: number;
}

// ── Payloads hacia la API ──

export interface FiltroClientes {
  /** null → todos los clientes */
  cobradorId: number | null;
  localidadId: number | null;
}

/** Alta / edición de cliente (modo gestión). En edición, id presente. */
export interface ClientePayload {
  id?: number;
  dni: string;
  nombreCompleto: string;
  email: string | null;
  direccion: string | null;
  ubicacionCobro: string | null;
  idLocalidad: number | null;
  /** Reemplaza la lista completa, igual que sp_EditarTelefonos */
  telefonos: string[];
  /** Cobrador asignado en Cliente_Cobrador */
  cobradorId: number | null;
}

/** Alta / edición de plan de pagos (modo gestión) */
export interface PlanPayload {
  id?: number;
  idCliente: number;
  nombre: string;
  /**
   * Lo que el cliente debe: capital **más** interés.
   *
   * `Plan_de_pagos` no tiene columna de tasa ni de capital, así que el interés
   * se aplica antes de guardar y solo queda el total. El desglose no se
   * registra en ningún lado (decisión del dueño del proyecto).
   */
  montoTotal: number;
  status: PlanStatus;
  /** Solo en alta: el cronograma ya calculado, cuota por cuota */
  cuotas?: { fecha: string; monto: number }[];
}

/** Cada cuánto vence una cuota. Se traduce a un array de fechas para
 *  `sp_Crear-PagoPorRealizar`, que las recibe como JSON. */

/** Plan con sus totales, para el listado de gestión */
export interface PlanListado {
  id: number;
  nombre: string;
  status: PlanStatus;
  montoTotal: number;
  clienteId: number;
  clienteNombre: string;
  cobradorNombre: string | null;
  cuotasTotales: number;
  cuotasCobradas: number;
  pagado: number;
}
