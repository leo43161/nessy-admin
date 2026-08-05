/**
 * Traducción API → tipos del front.
 *
 * La API devuelve las columnas de la base tal cual salen del SP: nombres
 * mezclados (`id_Pagos_por_realizar`, `Monto_esperado`, `cliente_nombre`) y
 * capitalización inconsistente. Los tipos del front son camelCase. Este
 * archivo es el único lugar donde conviven las dos convenciones.
 *
 * Las funciones son puras: reciben la fila cruda y devuelven el tipo. El
 * fetch y el join viven en los servicios. Su chequeo: `npm run check`.
 */
import type {
  ClienteListado,
  Cobrador,
  CobroDelDia,
  PagoEstado,
  PlanListado,
  PlanStatus,
  Telefono,
} from "@/types";

/** Fila de GET /cuotas */
export interface FilaCuota {
  id_Pagos_por_realizar: number;
  id_Plan_de_pago: number;
  fecha_acordada: string;
  Monto_esperado: string;
  Estado: string;
  Dentro_Rango: number | null;
  vencida: number;
  plan_nombre: string | null;
  plan_status: string | null;
  plan_monto_total: string | null;
  id_Clientes: number;
  cliente_nombre: string | null;
  cliente_dni: string | null;
  cliente_direccion: string | null;
  cliente_ubicacion: string | null;
  id_cobrador_asignado: number | null;
  /** GROUP_CONCAT de los cobradores activos del cliente. Es "5" salvo cuando
   *  `sp_EditarCliente-Cobrador` dejó dos asignaciones vivas ("5,7"): ahí
   *  `id_cobrador_asignado` es el menor de los dos. */
  cobradores_asignados: string | null;
  cobrador_asignado_nombre: string | null;
  id_cobrador_cobro: number | null;
  monto_abonado: string | null;
  fecha_de_pago: string | null;
  id_metodo_de_pago: number | null;
}

/** Fila de GET /clientes */
export interface FilaCliente {
  id_Clientes: number;
  DNI: string | null;
  Nombre_completo: string | null;
  email: string | null;
  codigo_postal: string | null;
  direccion: string | null;
  casa_o_dpt_direcc_1: string | null;
  direccion_laboral_o_alternativa: string | null;
  casa_o_dpt_direcc_2: string | null;
  ubicacion_geografica_de_destino_de_cobro: string | null;
  img: string | null;
  status: string | null;
  fecha_de_nacimiento: string | null;
  id_localidad: number | null;
  nombre_localidad: string | null;
  id_Cuenta_Corriente: number | null;
  telefonos?: string[];
}

/** Fila de GET /cobradores */
export interface FilaCobrador {
  id_Cobradores: number;
  DNI: string | null;
  Nombre_completo: string | null;
  email: string | null;
  codigo_postal: string | null;
  direccion: string | null;
  casa_o_dpt_direcc_1: string | null;
  direccion_laboral_o_alternativa: string | null;
  casa_o_dpt_direcc_2: string | null;
  img: string | null;
  fecha_de_nacimiento: string | null;
  id_localidad: number | null;
  telefonos?: string[];
  clientes_asignados?: number;
}

/** Fila de GET /planes */
export interface FilaPlan {
  id_Plan_de_pagos: number;
  Nombre: string | null;
  Monto_total: string | null;
  Status: string | null;
  id_cliente: number;
  id_Cuenta_Corriente: number | null;
}

/**
 * Las columnas DECIMAL viajan como string ("75000.00"): mysqli las devuelve
 * así y json_encode las deja tal cual. Si no se convierten, cualquier suma
 * del cierre de caja termina concatenando.
 */
export function aNumero(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** tinyint(1) → boolean. `null` se conserva: "no se sabe" ≠ "fue fuera de rango". */
export function aBooleanoNullable(v: number | null | undefined): boolean | null {
  return v == null ? null : v === 1;
}

/**
 * La API manda los tres estados de la base: Pendiente, Pagado, Atrasado.
 *
 * `Atrasado` se traduce a `Pendiente` a propósito. El front deriva "Vencido"
 * con esVencido() (pendiente + fecha pasada), que es exactamente lo que
 * significa un atrasado, y así `ESTADO[...]` no recibe una clave que no
 * tiene y rompa el chip.
 *
 * ponytail: los tres estados de la maqueta (Incomunicado, Adelanto, Recargo)
 * siguen en el tipo PagoEstado y ya no pueden llegar de la API. Sacarlos es
 * la tarea N.4 y toca componentes, no solo este archivo.
 */
export function aEstadoCuota(estado: string | null): PagoEstado {
  if (estado === "Pagado") return "Pagado";
  return "Pendiente";
}

const PLAN_STATUSES: PlanStatus[] = ["Activo", "Completado", "Incumplido", "Refinanciado"];

export function aPlanStatus(status: string | null): PlanStatus {
  return PLAN_STATUSES.includes(status as PlanStatus) ? (status as PlanStatus) : "Activo";
}

/**
 * `Telefonos` es polimórfica y la API la aplana a un array de strings: manda
 * el número sin el id de la fila. El id se sintetiza con el índice, que
 * alcanza para las keys de React — no sirve para editar el teléfono.
 */
export function aTelefonos(numeros: string[] | undefined): Telefono[] {
  return (numeros ?? []).map((numero, i) => ({ id: i + 1, numero }));
}

export function aCliente(f: FilaCliente, cobradorId?: number, cobradorNombre?: string): ClienteListado {
  return {
    id: f.id_Clientes,
    // Hay comercios cargados sin DNI ("Kiosco El Milagro"). Es la definición
    // de negocio N.3, todavía abierta: el tipo lo exige y la base no.
    dni: f.DNI ?? "",
    nombreCompleto: f.Nombre_completo ?? "—",
    // La columna existe pero en producción está en NULL para todas las filas.
    status: f.status === "Inactivo" || f.status === "Moroso" ? f.status : "Activo",
    direccion: f.direccion,
    ubicacionCobro: f.ubicacion_geografica_de_destino_de_cobro,
    idLocalidad: f.id_localidad,
    localidadNombre: f.nombre_localidad,
    telefonos: aTelefonos(f.telefonos),
    cobradorAsignadoId: cobradorId ?? null,
    cobradorAsignadoNombre: cobradorNombre ?? null,
  };
}

export function aCobrador(f: FilaCobrador): Cobrador {
  return {
    id: f.id_Cobradores,
    dni: f.DNI ?? "",
    nombreCompleto: f.Nombre_completo ?? "—",
    email: f.email,
    codigoPostal: f.codigo_postal,
    direccion: f.direccion,
    casaODeptoDirecc1: f.casa_o_dpt_direcc_1,
    direccionLaboralOAlternativa: f.direccion_laboral_o_alternativa,
    casaODeptoDirecc2: f.casa_o_dpt_direcc_2,
    img: f.img,
    fechaDeNacimiento: f.fecha_de_nacimiento,
    idLocalidad: f.id_localidad,
  };
}

/**
 * Cuota → CobroDelDia.
 *
 * `/cuotas` trae del cliente solo nombre, DNI, dirección y ubicación. Los
 * otros cuatro campos que la UI lee (status, teléfonos, localidad) salen de
 * `/clientes`, y el nombre de quién cobró de `/cobradores`: por eso los dos
 * mapas. Si un id no está en el mapa se cae al dato que vino en la fila.
 */
export function aCuota(
  f: FilaCuota,
  clientes: Map<number, ClienteListado>,
  cobradores: Map<number, string>,
): CobroDelDia {
  const enriquecido = clientes.get(f.id_Clientes);

  const cliente: ClienteListado = enriquecido
    ? {
        ...enriquecido,
        cobradorAsignadoId: f.id_cobrador_asignado,
        cobradorAsignadoNombre: f.cobrador_asignado_nombre,
      }
    : aCliente(
        {
          id_Clientes: f.id_Clientes,
          DNI: f.cliente_dni,
          Nombre_completo: f.cliente_nombre,
          email: null,
          codigo_postal: null,
          direccion: f.cliente_direccion,
          casa_o_dpt_direcc_1: null,
          direccion_laboral_o_alternativa: null,
          casa_o_dpt_direcc_2: null,
          ubicacion_geografica_de_destino_de_cobro: f.cliente_ubicacion,
          img: null,
          status: null,
          fecha_de_nacimiento: null,
          id_localidad: null,
          nombre_localidad: null,
          id_Cuenta_Corriente: null,
        },
        f.id_cobrador_asignado ?? undefined,
        f.cobrador_asignado_nombre ?? undefined,
      );

  return {
    id: f.id_Pagos_por_realizar,
    planId: f.id_Plan_de_pago,
    planNombre: f.plan_nombre ?? "—",
    fechaAcordada: f.fecha_acordada,
    montoEsperado: aNumero(f.Monto_esperado),
    estado: aEstadoCuota(f.Estado),
    dentroRango: aBooleanoNullable(f.Dentro_Rango),
    // El kanban agrupa por cobrador: sin asignación la cuota quedaría fuera
    // de toda columna, así que 0 es la columna "sin asignar".
    cobradorAsignadoId: f.id_cobrador_asignado ?? 0,
    cobradorAsignadoNombre: f.cobrador_asignado_nombre ?? "Sin asignar",
    cobradoPorId: f.id_cobrador_cobro,
    cobradoPorNombre:
      f.id_cobrador_cobro == null ? null : (cobradores.get(f.id_cobrador_cobro) ?? "—"),
    cliente,
  };
}

/**
 * Plan → PlanListado.
 *
 * `/planes` no trae el nombre del cliente ni el avance de cuotas; las cuotas
 * salen de `/cuotas` y el nombre de `/clientes`. Es la misma agregación en el
 * cliente que ya hace lib/agregados.ts.
 */
export function aPlan(
  f: FilaPlan,
  cuotasDelPlan: CobroDelDia[],
  clientes: Map<number, ClienteListado>,
): PlanListado {
  const cliente = clientes.get(f.id_cliente);
  const cobradas = cuotasDelPlan.filter((c) => c.estado === "Pagado");

  return {
    id: f.id_Plan_de_pagos,
    nombre: f.Nombre ?? "—",
    status: aPlanStatus(f.Status),
    montoTotal: aNumero(f.Monto_total),
    clienteId: f.id_cliente,
    clienteNombre: cliente?.nombreCompleto ?? "—",
    cobradorNombre: cliente?.cobradorAsignadoNombre ?? null,
    cuotasTotales: cuotasDelPlan.length,
    cuotasCobradas: cobradas.length,
    pagado: cobradas.reduce((s, c) => s + c.montoEsperado, 0),
  };
}
