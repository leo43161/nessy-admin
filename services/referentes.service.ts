import { api } from "@/services/api";
import { aReferenteDeCliente, aTelefonos, type FilaReferente } from "@/services/mapear";
import type { ReferenteDeCliente, Telefono } from "@/types";

/**
 * Quién responde por un cliente.
 *
 * Son DOS vínculos distintos y no hay que mezclarlos:
 *
 *   /ref_cliente   garante externo — una fila de la tabla `Referentes`
 *   /cli_cliente   otro cliente de la cartera responde por este
 *
 * Los dos POST **reemplazan la lista completa**: para agregar uno hay que
 * mandar la lista con el nuevo incluido, y para sacarlo, sin él.
 */

export interface ReferenteSuelto {
  id: number;
  dni: string;
  nombreCompleto: string;
  telefonos: Telefono[];
}

/** Alta de un referente nuevo (tabla `Referentes`) */
export interface ReferentePayload {
  dni: string;
  nombreCompleto: string;
  direccion: string | null;
  telefonos: string[];
}

/** Todos los referentes existentes, para elegir de una lista */
export async function getReferentes(): Promise<ReferenteSuelto[]> {
  const { data } = await api.get<{ total: number; referentes: FilaReferente[] }>("/referentes");

  return data.referentes.map((f) => ({
    id: f.id_Referentes ?? 0,
    dni: f.DNI ?? "",
    nombreCompleto: f.Nombre_completo ?? "—",
    telefonos: aTelefonos(f.telefonos),
  }));
}

/** Crea un referente y devuelve su id, para poder vincularlo enseguida */
export async function crearReferente(payload: ReferentePayload): Promise<number> {
  const { data } = await api.post<{ id_Referentes: number }>("/referentes", {
    DNI: payload.dni,
    Nombre_completo: payload.nombreCompleto,
    direccion: payload.direccion,
    telefonos: payload.telefonos,
  });

  return data.id_Referentes;
}

/**
 * Garantes externos vinculados hoy al cliente.
 *
 * ⚠️ `/ref_cliente` dice QUIÉN responde por el cliente pero **no devuelve los
 * teléfonos**, y sin teléfono el botón de WhatsApp no sirve. El catálogo
 * completo sí los trae, así que se cruza por id.
 */
export async function getReferentesDeCliente(idCliente: number): Promise<ReferenteDeCliente[]> {
  const { data } = await api.get<{ referentes: FilaReferente[] }>("/ref_cliente", {
    params: { id_cliente: idCliente },
  });

  if (data.referentes.length === 0) return [];

  const todos = await getReferentes();
  const porId = new Map(todos.map((r) => [r.id, r.telefonos]));

  return data.referentes.map((f) => ({
    ...aReferenteDeCliente(f),
    telefonos: porId.get(f.id_Referentes ?? 0) ?? [],
  }));
}

/** Clientes que responden por este cliente. Mismo cruce, contra `/clientes`. */
export async function getClientesReferentes(idCliente: number): Promise<ReferenteDeCliente[]> {
  const { data } = await api.get<{ referentes: FilaReferente[] }>("/cli_cliente", {
    params: { id_cliente: idCliente },
  });

  if (data.referentes.length === 0) return [];

  const { data: catalogo } = await api.get<{ clientes: { id_Clientes: number; telefonos?: string[] }[] }>(
    "/clientes",
  );
  const porId = new Map(catalogo.clientes.map((c) => [c.id_Clientes, aTelefonos(c.telefonos)]));

  // La misma fila pero de la tabla Clientes: el mapper no distingue el origen,
  // así que el tipo se corrige acá.
  return data.referentes.map((f) => ({
    ...aReferenteDeCliente(f),
    tipo: "Cliente" as const,
    id: f.id_Clientes ?? 0,
    telefonos: porId.get(f.id_Clientes ?? 0) ?? [],
  }));
}

/** Reemplaza los garantes externos del cliente por esta lista */
export async function guardarReferentesDeCliente(
  idCliente: number,
  idsReferentes: number[],
): Promise<void> {
  await api.post("/ref_cliente", { id_cliente: idCliente, referentes: idsReferentes });
}

/** Reemplaza los clientes-garantes del cliente por esta lista */
export async function guardarClientesReferentes(
  idCliente: number,
  idsClientes: number[],
): Promise<void> {
  await api.post("/cli_cliente", { id_cliente: idCliente, referentes: idsClientes });
}
