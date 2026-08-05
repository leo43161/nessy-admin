import { api, USE_MOCK } from "@/services/api";
import { delay, getDb } from "@/services/mock/db";
import type { Cobrador, Localidad } from "@/types";

/** Lista de cobradores (para asistencias / "cobrado por otro cobrador") */
export async function getCobradores(): Promise<Cobrador[]> {
  if (USE_MOCK) {
    return delay(getDb().cobradores, 100);
  }
  const { data } = await api.get<Cobrador[]>("/cobradores");
  return data;
}

/** Localidades y regiones (para los filtros) */
export async function getLocalidades(): Promise<Localidad[]> {
  if (USE_MOCK) {
    return delay(getDb().localidades, 100);
  }
  const { data } = await api.get<Localidad[]>("/localidades");
  return data;
}
