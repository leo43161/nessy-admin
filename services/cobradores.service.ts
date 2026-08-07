import { api } from "@/services/api";
import { aCobrador, type FilaCobrador } from "@/services/mapear";
import type { Cobrador, Localidad } from "@/types";

/** Lista de cobradores (para asistencias / "cobrado por otro cobrador") */
export async function getCobradores(): Promise<Cobrador[]> {
  const { data } = await api.get<{ total: number; cobradores: FilaCobrador[] }>("/cobradores");
  return data.cobradores.map(aCobrador);
}

/** Localidades y regiones (para los filtros) */
export async function getLocalidades(): Promise<Localidad[]> {
  // Los catálogos quedaron bajo /catalogos, no en /localidades: son dos
  // SELECT idénticos y no justificaban dos controladores (tarea 1.9).
  // Este endpoint ya devuelve {id, nombre}: no necesita mapper.
  const { data } = await api.get<{ total: number; localidades: Localidad[] }>(
    "/catalogos/localidades",
  );
  return data.localidades;
}
