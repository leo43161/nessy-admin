import { api } from "@/services/api";
import {
  aCliente,
  aClienteDetalle,
  aNota,
  deCliente,
  type FilaCliente,
  type FilaNota,
  type RespuestaEstadoCuenta,
} from "@/services/mapear";
import { getCobradores } from "@/services/cobradores.service";
import type {
  ClienteDetalle,
  ClienteListado,
  ClientePayload,
  FiltroClientes,
  Nota,
} from "@/types";

/**
 * Clientes con su cobrador asignado.
 *
 * `/clientes` no acepta filtros (tarea C.2) ni devuelve el cobrador: la cartera
 * vive en `/cliente_cobrador`, que se pide por cobrador. Así que se traen las
 * dos cosas y se cruzan acá.
 *
 * ponytail: una llamada por cobrador. Con la cartera actual son dos; si crece,
 * hace falta que `/clientes` traiga el cobrador cruzado, que es justo lo que ya
 * hace `/cuotas` con su LEFT JOIN agrupado.
 */
export async function getClientes(filtro: FiltroClientes): Promise<ClienteListado[]> {
  const [res, asignado] = await Promise.all([
    api.get<{ total: number; clientes: FilaCliente[] }>("/clientes"),
    cartera(),
  ]);

  return res.data.clientes
    .map((f) => {
      const cob = asignado.get(f.id_Clientes);
      return aCliente(f, cob?.id, cob?.nombre);
    })
    .filter((c) => filtro.cobradorId == null || c.cobradorAsignadoId === filtro.cobradorId)
    .filter((c) => filtro.localidadId == null || c.idLocalidad === filtro.localidadId);
}

/** Mapa id_cliente → cobrador asignado, armado desde `/cliente_cobrador`. */
async function cartera(): Promise<Map<number, { id: number; nombre: string }>> {
  const cobradores = await getCobradores();

  const porCobrador = await Promise.all(
    cobradores.map(async (cob) => {
      const { data } = await api.get<{ clientes: { id_Clientes: number }[] }>("/cliente_cobrador", {
        params: { id_cobrador: cob.id },
      });
      return data.clientes.map(
        (c) => [c.id_Clientes, { id: cob.id, nombre: cob.nombreCompleto }] as const,
      );
    }),
  );

  return new Map(porCobrador.flat());
}

/**
 * Ficha del cliente para el modal de gestión.
 *
 * El id va por query string: `/clientes/7` no existe — este router lee el
 * segundo segmento como nombre de método y responde "Método '7' no encontrado".
 */
export async function getClienteDetalle(clienteId: number): Promise<ClienteDetalle> {
  const [resCliente, resEstado, resNotas, asignado] = await Promise.all([
    api.get<{ total: number; clientes: FilaCliente[] }>("/clientes", { params: { id: clienteId } }),
    api.get<RespuestaEstadoCuenta>("/estado_cuenta", { params: { id_cliente: clienteId } }),
    api.get<{ total: number; notas: FilaNota[] }>("/notas", { params: { id_cliente: clienteId } }),
    cartera(),
  ]);

  const fila = resCliente.data.clientes[0];
  if (!fila) throw new Error("Cliente no encontrado.");

  return aClienteDetalle(
    fila,
    resEstado.data,
    resNotas.data.notas.map(aNota),
    asignado.get(clienteId)?.nombre ?? null,
    new Date().toISOString().slice(0, 10),
  );
}

// ── Modo gestión (alta / edición / baja) ───────────────────────────────

/**
 * Alta o edición. El id en el payload decide cuál de las dos.
 *
 * La API devuelve solo el id, no el cliente completo, así que se relee para
 * que el store reciba la fila ya cruzada con su cobrador.
 *
 * Los teléfonos van en el mismo request y reemplazan la lista entera: lo que
 * no se mande se da de baja (es lo que hace sp_EditarTelefonos).
 */
export async function guardarCliente(payload: ClientePayload): Promise<ClienteListado> {
  const cuerpo = deCliente(payload);

  const { data } = payload.id
    ? await api.put<{ id_Clientes: number }>("/clientes", cuerpo)
    : await api.post<{ id_Clientes: number }>("/clientes", cuerpo);

  const id = data.id_Clientes;

  // La asignación de cobrador no es parte de /clientes: vive en su endpoint.
  //
  // /asignar y no POST /cliente_cobrador: el POST agrega y no saca, así que al
  // cambiarle el cobrador el cliente quedaba activo en las dos carteras y le
  // aparecía a los dos cobradores. /asignar deja una sola asignación viva.
  if (payload.cobradorId != null) {
    await asignarCobrador(id, payload.cobradorId);
  }

  const clientes = await getClientes({ cobradorId: null, localidadId: null });
  const guardado = clientes.find((c) => c.id === id);
  if (!guardado) throw new Error("El cliente se guardó pero no se pudo releer.");

  return guardado;
}

/**
 * Notas de un cliente.
 *
 * Van en todos los modales del cliente: son el contexto que explica por qué
 * ese cliente está como está. `getClienteDetalle` ya las trae, así que esto es
 * para los modales que no cargan la ficha entera.
 */
export async function getNotasDeCliente(clienteId: number): Promise<Nota[]> {
  const { data } = await api.get<{ total: number; notas: FilaNota[] }>("/notas", {
    params: { id_cliente: clienteId },
  });
  return data.notas.map(aNota);
}

/**
 * Cambia el cobrador de un cliente.
 *
 * Un cliente tiene un solo cobrador: el endpoint lo saca del que lo tenía y lo
 * pone en el nuevo en una sola operación, sin pasar por "sin cobrador".
 */
export async function asignarCobrador(idCliente: number, idCobrador: number): Promise<void> {
  await api.post("/cliente_cobrador/asignar", {
    id_cliente: idCliente,
    id_cobrador: idCobrador,
  });
}

/** Baja lógica (`Activo = 0`). La API no borra nunca. */
export async function eliminarCliente(id: number): Promise<number> {
  await api.delete("/clientes", { data: { id } });
  return id;
}
