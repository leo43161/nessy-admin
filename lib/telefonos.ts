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
 * El campo acepta el número escrito como cada uno lo tenga anotado y de
 * armarlo se encarga `interpretarTipeado`. Lo que se guarda es siempre la
 * misma forma: `549` + característica + abonado.
 */

/** Todo número argentino tiene 10 dígitos entre característica y abonado */
const LARGO_NACIONAL = 10;

/**
 * Con qué característica arranca un teléfono nuevo: San Miguel de Tucumán,
 * que es de donde es casi toda la cartera.
 *
 * Antes se deducía de la localidad del cliente, y para uno de Aguilares el
 * campo arrancaba en 3863. Adivinar acá no compensa: el que carga espera
 * siempre lo mismo, y si el número es de otra zona la característica se
 * acomoda sola apenas se escribe completo.
 */
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

/** Cuántos dígitos como máximo puede tener lo tipeado: la parte nacional */
export const LARGO_MAXIMO = LARGO_NACIONAL;

/**
 * Lo que el admin escribió, interpretado.
 *
 * El campo acepta el número **como lo tenga anotado**: con o sin el 0 de larga
 * distancia, con o sin el 15, con o sin +54 9, con espacios o guiones, o solo
 * el abonado. Antes solo aceptaba el abonado y había que sacar la
 * característica de un select aparte, que es exactamente lo que nadie
 * entendía: quien tiene "3815010101" anotado lo escribe entero.
 *
 * **La característica solo se reemplaza cuando lo tipeado es un número
 * nacional completo** —10 dígitos que empiezan con una característica
 * conocida— o cuando trae un prefijo que no deja lugar a dudas (54, o el 0 de
 * larga distancia). Si no, manda `areaActual`.
 *
 * Ese cuidado no es adorno: en 381 hay abonados que empiezan con 11, y sin la
 * condición del largo, tipear "1123456" cambiaba la característica a Buenos
 * Aires en mitad de la palabra.
 */
export function interpretarTipeado(
  texto: string,
  areaActual: string,
): { area: string; abonado: string } {
  const crudo = texto.replace(/\D/g, "");

  // ¿Trae un prefijo que dice "esto es el número entero"? El 0 de larga
  // distancia y el 54 internacional solo aparecen delante de la característica.
  let n = crudo;
  let explicito = false;

  if (n.startsWith("54")) {
    n = n.slice(2);
    if (n.startsWith("9")) n = n.slice(1);
    explicito = true;
  } else if (n.startsWith("0")) {
    n = n.replace(/^0+/, "");
    explicito = true;
  }

  const area = areaQueEmpieza(n);

  if (area) {
    // El 15 va entre la característica y el abonado, y en formato
    // internacional no va nunca.
    const resto = n.slice(area.length).replace(/^15/, "");

    if (explicito || area.length + resto.length >= LARGO_NACIONAL) {
      return { area, abonado: resto.slice(0, largoAbonado(area)) };
    }
  }

  // Todavía no alcanza para decir que cambió de característica: es el abonado.
  return { area: areaActual, abonado: n.slice(0, LARGO_NACIONAL) };
}

/** La característica más larga que prefija a ese número, o null */
function areaQueEmpieza(n: string): string | null {
  // La más larga primero: 3863 tiene que ganarle a 38 si alguna vez se agrega.
  return (
    [...AREAS]
      .sort((a, b) => b.codigo.length - a.codigo.length)
      .find((a) => n.startsWith(a.codigo))?.codigo ?? null
  );
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
