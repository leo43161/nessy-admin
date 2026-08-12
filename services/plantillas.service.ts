import { api } from "@/services/api";

/**
 * Plantillas de mensaje (`Plantillas_de_mensajes`).
 *
 * Son los textos que el admin le manda al cliente por WhatsApp. Las escribe él
 * mismo: el sistema no trae ninguna, porque cada cartera habla distinto.
 *
 * En el texto se pueden usar comodines, que `aplicarPlantilla` reemplaza con
 * los datos del cliente y de la cuota antes de abrir el chat.
 */
export interface Plantilla {
  id: number;
  titulo: string;
  mensaje: string;
}

interface FilaPlantilla {
  id_Plantillas_de_mensajes: number;
  Titulo: string | null;
  Mensaje: string | null;
}

export async function getPlantillas(): Promise<Plantilla[]> {
  const { data } = await api.get<{ total: number; plantillas: FilaPlantilla[] }>("/plantillas");

  return data.plantillas.map((f) => ({
    id: f.id_Plantillas_de_mensajes,
    titulo: f.Titulo ?? "—",
    mensaje: f.Mensaje ?? "",
  }));
}

export async function crearPlantilla(titulo: string, mensaje: string): Promise<void> {
  await api.post("/plantillas", { Titulo: titulo, Mensaje: mensaje });
}

export async function editarPlantilla(
  id: number,
  titulo: string,
  mensaje: string,
): Promise<void> {
  await api.put("/plantillas", { id, Titulo: titulo, Mensaje: mensaje });
}

/** Baja lógica: `Activo = 0`. Nunca se borra. */
export async function eliminarPlantilla(id: number): Promise<void> {
  await api.delete("/plantillas", { data: { id } });
}

