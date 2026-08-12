/**
 * Teléfonos en formato de WhatsApp.
 *
 * `wa.me` necesita el número sin símbolos y con todo el prefijo:
 *
 *     54 · 9 · característica · abonado      →  5493815010101
 *
 * El `9` es lo que marca que es un celular y **no es opcional**: sin él el link
 * abre un chat que no existe. El `15` es lo contrario — es para llamar desde
 * dentro del país y en formato internacional no va nunca.
 *
 * Por eso el alta no deja escribir el número entero: el `+54 9` es fijo, la
 * característica sale de un select y el cobrador solo tipea el abonado.
 */

/** Todo número argentino tiene 10 dígitos entre característica y abonado */
const LARGO_NACIONAL = 10;

export const AREA_POR_DEFECTO = "381";

export interface Area {
  codigo: string;
  zona: string;
}

/** Tucumán, que es donde está la cartera */
export const AREAS_TUCUMAN: Area[] = [
  { codigo: "381", zona: "San Miguel y alrededores" },
  { codigo: "3863", zona: "Aguilares · Alberdi · La Cocha" },
  { codigo: "3865", zona: "Concepción · Monteros · Simoca" },
  { codigo: "3862", zona: "Trancas · Burruyacú" },
  { codigo: "3867", zona: "Tafí del Valle · Amaicha" },
];

/** Resto del país, para los clientes que se mudaron o trabajan afuera */
export const AREAS_PAIS: Area[] = [
  { codigo: "11", zona: "Buenos Aires · CABA" },
  { codigo: "221", zona: "La Plata" },
  { codigo: "223", zona: "Mar del Plata" },
  { codigo: "261", zona: "Mendoza" },
  { codigo: "264", zona: "San Juan" },
  { codigo: "299", zona: "Neuquén" },
  { codigo: "341", zona: "Rosario" },
  { codigo: "342", zona: "Santa Fe" },
  { codigo: "351", zona: "Córdoba" },
  { codigo: "380", zona: "La Rioja" },
  { codigo: "383", zona: "Catamarca" },
  { codigo: "385", zona: "Santiago del Estero" },
  { codigo: "387", zona: "Salta" },
  { codigo: "388", zona: "Jujuy" },
];

export const AREAS: Area[] = [...AREAS_TUCUMAN, ...AREAS_PAIS];

/**
 * Característica que le corresponde a cada localidad de
 * `Localidades_y_regiones`. La clave es el nombre exacto de la base.
 */
export const AREA_POR_LOCALIDAD: Record<string, string> = {
  "San Miguel de Tucumán": "381",
  "Yerba Buena": "381",
  "Tafí Viejo": "381",
  "Las Talitas": "381",
  "Banda del Río Salí": "381",
  Alderetes: "381",
  Lastenia: "381",
  "El Manantial": "381",
  "San Pablo": "381",
  "Los Pocitos": "381",
  Lules: "381",
  Famaillá: "381",
  Leales: "381",
  Aguilares: "3863",
  "Juan Bautista Alberdi": "3863",
  "La Cocha": "3863",
  Graneros: "3863",
  Concepción: "3865",
  Monteros: "3865",
  Simoca: "3865",
  "Bella Vista": "3865",
  Trancas: "3862",
  Burruyacú: "3862",
  "Tafí del Valle": "3867",
  "Amaicha del Valle": "3867",
};

/** Cuántos dígitos tiene el abonado para esa característica */
export function largoAbonado(area: string): number {
  return LARGO_NACIONAL - area.length;
}

export function telefonoCompleto(area: string, abonado: string): boolean {
  return area !== "" && abonado.length === largoAbonado(area);
}

/** Lo que se guarda en `Telefonos.numero`: exactamente lo que pide wa.me */
export function aNumeroGuardado(area: string, abonado: string): string {
  return `549${area}${abonado}`;
}

/** "+54 9 381 501-0101", solo para mostrar */
export function formatearParaLeer(guardado: string): string {
  const { area, abonado } = desdeNumeroGuardado(guardado);
  if (!area) return guardado;
  return `+54 9 ${area} ${abonado}`;
}

/**
 * Desarma un número guardado en característica + abonado.
 *
 * Tiene que aguantar lo que ya está cargado, que entró sin formato: con o sin
 * `54`, con o sin `9`, con el `0` de larga distancia adelante y con el `15`
 * pegado después de la característica. Si la característica no está en la
 * lista devuelve `area: ""` y el número entero como abonado, para que el
 * formulario obligue a elegirla en vez de inventar una.
 */
export function desdeNumeroGuardado(guardado: string | null | undefined): {
  area: string;
  abonado: string;
} {
  let n = (guardado ?? "").replace(/\D/g, "");

  if (n.startsWith("54")) n = n.slice(2);
  n = n.replace(/^0+/, "");
  // El 9 va después del 54; si el número venía sin 54, un 9 inicial es del
  // abonado y no se toca.
  if (guardado?.replace(/\D/g, "").startsWith("54") && n.startsWith("9")) n = n.slice(1);

  // La más larga primero: 3863 tiene que ganarle a 38 si alguna vez se agrega.
  const area = [...AREAS]
    .sort((a, b) => b.codigo.length - a.codigo.length)
    .find((a) => n.startsWith(a.codigo))?.codigo;

  if (!area) return { area: "", abonado: n };

  return { area, abonado: n.slice(area.length).replace(/^15/, "") };
}
