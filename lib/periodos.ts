import type { RangoFechas } from "@/types";

/**
 * Los períodos de siempre, para no tener que tipear dos fechas cada vez.
 *
 * Todo se calcula a partir de "hoy" recibido por parámetro y no de `new Date()`
 * adentro, para que las funciones sean puras y se puedan chequear.
 *
 * La semana arranca el **lunes**: es la semana laboral del cobrador, no la
 * semana del calendario norteamericano que devuelve `getDay()`.
 */
export type PeriodoId =
  | "hoy"
  | "semana"
  | "mes"
  | "mesPasado"
  | "tresMeses"
  | "anio"
  | "personalizado";

export interface Preset {
  id: PeriodoId;
  label: string;
}

export const PRESETS: Preset[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Esta semana" },
  { id: "mes", label: "Este mes" },
  { id: "mesPasado", label: "Mes pasado" },
  { id: "tresMeses", label: "Últimos 3 meses" },
  { id: "anio", label: "Este año" },
  { id: "personalizado", label: "Rango" },
];

export function rangoDePeriodo(id: PeriodoId, hoy: string): RangoFechas {
  const d = new Date(`${hoy}T00:00:00`);
  const anio = d.getFullYear();
  const mes = d.getMonth();

  switch (id) {
    case "hoy":
      return { desde: hoy, hasta: hoy };

    case "semana": {
      // getDay() devuelve 0 para domingo: se corre para que la semana empiece
      // el lunes y el domingo quede como último día, no como primero.
      const diaDeSemana = (d.getDay() + 6) % 7;
      const lunes = new Date(anio, mes, d.getDate() - diaDeSemana);
      return { desde: aISO(lunes), hasta: aISO(new Date(anio, mes, d.getDate() - diaDeSemana + 6)) };
    }

    case "mes":
      return { desde: aISO(new Date(anio, mes, 1)), hasta: aISO(new Date(anio, mes + 1, 0)) };

    case "mesPasado":
      return { desde: aISO(new Date(anio, mes - 1, 1)), hasta: aISO(new Date(anio, mes, 0)) };

    // Los últimos 3 meses incluyen el actual: los dos anteriores completos más
    // lo que va de este. Es lo que se espera al mirar "cómo venimos".
    case "tresMeses":
      return { desde: aISO(new Date(anio, mes - 2, 1)), hasta: hoy };

    case "anio":
      return { desde: aISO(new Date(anio, 0, 1)), hasta: aISO(new Date(anio, 11, 31)) };

    case "personalizado":
      return { desde: hoy, hasta: hoy };
  }
}

/** Qué preset representa un rango, para dejar marcado el chip al recargar */
export function periodoDeRango(rango: RangoFechas, hoy: string): PeriodoId {
  const candidatos: PeriodoId[] = ["hoy", "semana", "mes", "mesPasado", "tresMeses", "anio"];

  for (const id of candidatos) {
    const r = rangoDePeriodo(id, hoy);
    if (r.desde === rango.desde && r.hasta === rango.hasta) return id;
  }

  return "personalizado";
}

function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
