const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** "$ 25.000,00" (la DB no maneja múltiples monedas) */
export function fmtMoney(monto: number): string {
  return `$ ${Number(monto).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "87%" */
export function fmtPct(valor: number): string {
  return `${Math.round(valor)}%`;
}

/** Iniciales para el avatar: "Ana García" → "AG" */
export function initials(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Fecha local de hoy en formato YYYY-MM-DD */
export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Suma días a una fecha YYYY-MM-DD (o a hoy si no se pasa) */
export function addDays(offset: number, from?: string): string {
  const d = from ? new Date(from + "T00:00:00") : new Date();
  d.setDate(d.getDate() + offset);
  return toISODate(d);
}

/** "2026-06-08" → "8 jun 2026" */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${parseInt(d)} ${MESES[parseInt(m) - 1]} ${y}`;
}

/** "2026-06-08" → "Lunes 8 jun" */
export function formatDayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso + "T00:00:00");
  return `${DIAS[date.getDay()]} ${date.getDate()} ${MESES[date.getMonth()]}`;
}

/** Link de WhatsApp con mensaje opcional prellenado */
/**
 * Link al mapa del punto de cobro, o null si no son coordenadas.
 *
 * `ubicacion_geografica_de_destino_de_cobro` guarda "lat,lon" — es de ahí que
 * los SP de cobro sacan el punto para el control de rango. Las fichas viejas
 * tienen texto libre en esa columna y devuelven null.
 */
export function mapaUrl(ubicacion: string | null | undefined): string | null {
  const v = ubicacion?.trim();
  if (!v || !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v)) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(v.replace(/\s/g, ""))}`;
}

export function whatsappUrl(telefono: string, mensaje?: string): string {
  const nro = telefono.replace(/\D/g, "");
  const text = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  return `https://wa.me/${nro}${text}`;
}
