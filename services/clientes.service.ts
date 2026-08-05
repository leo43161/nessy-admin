import { api, USE_MOCK } from "@/services/api";
import {
  buildEstadoDeCuenta,
  delay,
  getDb,
  getLocalidadNombre,
  getTelefonos,
  nextId,
  saveDb,
  toClienteListado,
} from "@/services/mock/db";
import { aCliente, type FilaCliente } from "@/services/mapear";
import { getCobradores } from "@/services/cobradores.service";
import type {
  Cliente,
  ClienteDetalle,
  ClienteListado,
  ClientePayload,
  EstadoDeCuenta,
  FiltroClientes,
  ReferenteDeCliente,
} from "@/types";

/** Clientes según filtros (cobrador null = todos) */
export async function getClientes(filtro: FiltroClientes): Promise<ClienteListado[]> {
  if (USE_MOCK) {
    const db = getDb();
    const clientes = db.clientes
      .filter((c) => {
        if (filtro.cobradorId == null) return true;
        return db.clienteCobrador.some(
          (cc) => cc.idCliente === c.id && cc.idCobrador === filtro.cobradorId,
        );
      })
      .filter((c) => (filtro.localidadId == null ? true : c.idLocalidad === filtro.localidadId))
      .map((c) => toClienteListado(db, c));
    return delay(clientes);
  }
  // `/clientes` todavía no acepta filtros (tarea C.2) ni devuelve el cobrador
  // asignado: la cartera vive en `/cliente_cobrador`, que se pide por cobrador.
  //
  // ponytail: una llamada por cobrador. Con la cartera actual son dos; si
  // crecen, hace falta un endpoint que devuelva todas las asignaciones juntas
  // (o que `/clientes` traiga el cobrador cruzado, que es lo que ya hace
  // `/cuotas` con su LEFT JOIN agrupado).
  const [resClientes, cobradores] = await Promise.all([
    api.get<{ total: number; clientes: FilaCliente[] }>("/clientes"),
    getCobradores(),
  ]);

  const carteras = await Promise.all(
    cobradores.map(async (cob) => {
      const { data } = await api.get<{ clientes: { id_Clientes: number }[] }>("/cliente_cobrador", {
        params: { id_cobrador: cob.id },
      });
      return data.clientes.map((c) => [c.id_Clientes, cob] as const);
    }),
  );
  const asignado = new Map(carteras.flat());

  return resClientes.data.clientes
    .map((f) => {
      const cob = asignado.get(f.id_Clientes);
      return aCliente(f, cob?.id, cob?.nombreCompleto);
    })
    .filter((c) => filtro.cobradorId == null || c.cobradorAsignadoId === filtro.cobradorId)
    .filter((c) => filtro.localidadId == null || c.idLocalidad === filtro.localidadId);
}

/** Referentes del cliente: de la tabla Referentes + clientes que lo referencian */
function getReferentesDeCliente(clienteId: number): ReferenteDeCliente[] {
  const db = getDb();
  const desdeTabla: ReferenteDeCliente[] = db.referenteCliente
    .filter((rc) => rc.idCliente === clienteId)
    .map((rc) => db.referentes.find((r) => r.id === rc.idReferente))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      tipo: "Referente",
      id: r.id,
      dni: r.dni,
      nombreCompleto: r.nombreCompleto,
      direccion: r.direccion,
      localidadNombre: getLocalidadNombre(db, r.idLocalidad),
      telefonos: getTelefonos(db, "Referentes", r.id),
    }));

  const desdeClientes: ReferenteDeCliente[] = db.clienteClienteReferente
    .filter((cr) => cr.idTitular === clienteId)
    .map((cr) => db.clientes.find((c) => c.id === cr.idReferente))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      tipo: "Cliente",
      id: c.id,
      dni: c.dni,
      nombreCompleto: c.nombreCompleto,
      direccion: c.direccion,
      localidadNombre: getLocalidadNombre(db, c.idLocalidad),
      telefonos: getTelefonos(db, "Clientes", c.id),
    }));

  return [...desdeTabla, ...desdeClientes];
}

/** Detalle completo para el modal de cliente */
export async function getClienteDetalle(clienteId: number): Promise<ClienteDetalle> {
  if (USE_MOCK) {
    const db = getDb();
    const cliente = db.clientes.find((c) => c.id === clienteId);
    if (!cliente) throw new Error("Cliente no encontrado.");
    const cobrador = db.clienteCobrador.find((cc) => cc.idCliente === clienteId);
    const detalle: ClienteDetalle = {
      cliente,
      localidadNombre: getLocalidadNombre(db, cliente.idLocalidad),
      telefonos: getTelefonos(db, "Clientes", clienteId),
      cobradorAsignadoNombre:
        db.cobradores.find((c) => c.id === cobrador?.idCobrador)?.nombreCompleto ?? null,
      referentes: getReferentesDeCliente(clienteId),
      notas: db.notas
        .filter((n) => n.idCliente === clienteId)
        .sort((a, b) => b.fechaDeCreacion.localeCompare(a.fechaDeCreacion) || b.id - a.id),
      estadoDeCuenta: buildEstadoDeCuenta(db, clienteId),
    };
    return delay(detalle, 250);
  }
  const { data } = await api.get<ClienteDetalle>(`/clientes/${clienteId}`);
  return data;
}

/** Estado de cuenta del cliente (para compartir tras cobrar) */
export async function getEstadoDeCuenta(clienteId: number): Promise<EstadoDeCuenta> {
  if (USE_MOCK) {
    return delay(buildEstadoDeCuenta(getDb(), clienteId), 200);
  }
  const { data } = await api.get<EstadoDeCuenta>(`/clientes/${clienteId}/estado-de-cuenta`);
  return data;
}

// ── Modo gestión (alta / edición / baja) ───────────────────────────────

/**
 * Alta o edición de cliente, con teléfonos y cobrador en el mismo request.
 *
 * Reproduce lo que ya hace `POST/PUT /clientes` en la API (controllers/
 * clientes.php, tarea 1.1): DNI único, la lista de teléfonos reemplaza
 * la anterior completa, y el alta crea también la Cuenta_Corriente.
 */
export async function guardarCliente(payload: ClientePayload): Promise<ClienteListado> {
  if (USE_MOCK) {
    const db = getDb();

    const dniRepetido = db.clientes.find(
      (c) => c.dni === payload.dni.trim() && c.id !== payload.id,
    );
    if (dniRepetido) {
      throw new Error(`El DNI ${payload.dni} ya lo tiene ${dniRepetido.nombreCompleto}.`);
    }

    const campos = {
      dni: payload.dni.trim(),
      nombreCompleto: payload.nombreCompleto.trim(),
      email: payload.email,
      direccion: payload.direccion,
      ubicacionCobro: payload.ubicacionCobro,
      idLocalidad: payload.idLocalidad,
      status: payload.status,
    };

    let cliente: Cliente;
    if (payload.id) {
      const existente = db.clientes.find((c) => c.id === payload.id);
      if (!existente) throw new Error("Cliente no encontrado.");
      Object.assign(existente, campos);
      cliente = existente;
    } else {
      cliente = {
        id: nextId(db.clientes),
        codigoPostal: null,
        casaODeptoDirecc1: null,
        direccionLaboralOAlternativa: null,
        casaODeptoDirecc2: null,
        img: null,
        fechaDeNacimiento: null,
        ...campos,
      };
      db.clientes.push(cliente);
      // sp_CrearClientes es transaccional: el cliente nace con su cuenta corriente
      db.cuentasCorrientes.push({ id: nextId(db.cuentasCorrientes), idCliente: cliente.id });
    }

    // Los teléfonos se reemplazan por completo (igual que sp_EditarTelefonos)
    db.telefonos = db.telefonos.filter(
      (t) => !(t.tabla === "Clientes" && t.idEntidad === cliente.id),
    );
    for (const numero of payload.telefonos.map((n) => n.trim()).filter(Boolean)) {
      db.telefonos.push({
        id: nextId(db.telefonos),
        tabla: "Clientes",
        idEntidad: cliente.id,
        numero,
      });
    }

    // Cliente_Cobrador: un cobrador asignado por cliente
    db.clienteCobrador = db.clienteCobrador.filter((cc) => cc.idCliente !== cliente.id);
    if (payload.cobradorId != null) {
      db.clienteCobrador.push({ idCliente: cliente.id, idCobrador: payload.cobradorId });
    }

    saveDb();
    return delay(toClienteListado(db, cliente), 300);
  }

  const { data } = payload.id
    ? await api.put<ClienteListado>("/clientes", payload)
    : await api.post<ClienteListado>("/clientes", payload);
  return data;
}

/** Baja lógica (Activo = 0). El historial de planes y pagos queda intacto. */
export async function eliminarCliente(id: number): Promise<number> {
  if (USE_MOCK) {
    const db = getDb();
    db.clientes = db.clientes.filter((c) => c.id !== id);
    db.clienteCobrador = db.clienteCobrador.filter((cc) => cc.idCliente !== id);
    saveDb();
    return delay(id, 200);
  }
  await api.delete("/clientes", { data: { id } });
  return id;
}
