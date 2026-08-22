// Chequeo de lib/telefonos.ts — `node lib/telefonos.check.ts`
//
// Un dígito de más o de menos acá y el link de WhatsApp abre un chat que no
// existe, sin ningún error visible. Por eso los casos raros están todos.
import assert from "node:assert/strict";
import {
  AREA_POR_DEFECTO,
  AREAS,
  aNumeroGuardado,
  desdeNumeroGuardado,
  formatearParaLeer,
  interpretarTipeado,
  largoAbonado,
  telefonoCompleto,
} from "./telefonos.ts";

// Lo que se guarda es literalmente lo que va en la URL de wa.me.
assert.equal(aNumeroGuardado("381", "5010101"), "5493815010101");
assert.equal(aNumeroGuardado("3863", "451234"), "5493863451234");

// 10 dígitos entre característica y abonado, siempre.
assert.equal(largoAbonado("381"), 7);
assert.equal(largoAbonado("3863"), 6);
assert.equal(largoAbonado("11"), 8);
for (const a of AREAS) {
  assert.ok(largoAbonado(a.codigo) > 0, `característica sin abonado posible: ${a.codigo}`);
  assert.match(a.codigo, /^\d{2,4}$/, `característica mal formada: ${a.codigo}`);
}

assert.equal(telefonoCompleto("381", "5010101"), true);
assert.equal(telefonoCompleto("381", "501010"), false, "un dígito de menos no es válido");
assert.equal(telefonoCompleto("381", "50101012"), false, "uno de más tampoco");
assert.equal(telefonoCompleto("", "5010101"), false, "sin característica no se puede mandar");

// Ida y vuelta.
assert.deepEqual(desdeNumeroGuardado("5493815010101"), { area: "381", abonado: "5010101" });
assert.deepEqual(desdeNumeroGuardado("5493863451234"), { area: "3863", abonado: "451234" });

// Lo que ya está cargado en la base entró sin formato: hay que poder editarlo.
assert.deepEqual(desdeNumeroGuardado("3815010101"), { area: "381", abonado: "5010101" });
assert.deepEqual(desdeNumeroGuardado("0381 15 501-0101"), { area: "381", abonado: "5010101" });
assert.deepEqual(desdeNumeroGuardado("+54 9 381 501 0101"), { area: "381", abonado: "5010101" });
assert.deepEqual(desdeNumeroGuardado("381 501-0101"), { area: "381", abonado: "5010101" });

// El 9 solo se saca cuando viene después del 54. Un abonado que empieza con 9
// no se puede tocar: 3865-955555 es un número real de Concepción.
assert.deepEqual(desdeNumeroGuardado("3865955555"), { area: "3865", abonado: "955555" });

// Característica desconocida: no se inventa ninguna, el formulario la pide.
assert.deepEqual(desdeNumeroGuardado("9999123456"), { area: "", abonado: "9999123456" });
assert.deepEqual(desdeNumeroGuardado(""), { area: "", abonado: "" });
assert.deepEqual(desdeNumeroGuardado(null), { area: "", abonado: "" });

assert.equal(formatearParaLeer("5493815010101"), "+54 9 381 5010101");
assert.equal(formatearParaLeer("basura"), "basura", "lo ilegible se muestra tal cual");

// La característica con la que arranca un teléfono nuevo es San Miguel, y
// tiene que ser una de la lista.
const codigos = new Set(AREAS.map((a) => a.codigo));
assert.ok(codigos.has(AREA_POR_DEFECTO), "la característica por defecto tiene que existir");
assert.equal(AREA_POR_DEFECTO, "381");
assert.equal(
  AREAS.find((a) => a.codigo === AREA_POR_DEFECTO)?.zona,
  "San Miguel y alrededores",
  "un teléfono nuevo arranca en San Miguel de Tucumán",
);

/* ── lo que el admin tipea, interpretado ──
 *
 * Este es el campo que nadie entendía: aceptaba solo el abonado, así que
 * escribir el número como uno lo tiene anotado no funcionaba. Ahora entra de
 * cualquier forma, y la característica se cambia sola solo cuando lo tipeado
 * no deja lugar a dudas.
 */

// El número entero, en todas las formas en que se escribe en la calle.
for (const texto of [
  "3815010101",
  "381 501 0101",
  "381 501-0101",
  "0381 15 501 0101",
  "+54 9 381 501 0101",
  "5493815010101",
  "0381 5010101",
]) {
  assert.deepEqual(
    interpretarTipeado(texto, "381"),
    { area: "381", abonado: "5010101" },
    `"${texto}" tiene que dar 381 / 5010101`,
  );
}

// Solo el abonado: se queda con la característica que ya estaba elegida.
assert.deepEqual(interpretarTipeado("5010101", "381"), { area: "381", abonado: "5010101" });
assert.deepEqual(interpretarTipeado("451234", "3863"), { area: "3863", abonado: "451234" });

// El número entero de OTRA característica cambia el select.
assert.deepEqual(interpretarTipeado("3863451234", "381"), { area: "3863", abonado: "451234" });
assert.deepEqual(interpretarTipeado("1123456789", "381"), { area: "11", abonado: "23456789" });

// Pegado desde WhatsApp, con todo el formato. Son 18 caracteres para 10
// dígitos: el maxLength del campo tiene que dar lugar a los separadores, o
// corta el número antes de que se pueda leer.
assert.deepEqual(interpretarTipeado("+54 9 11 4567-8901", "381"), {
  area: "11",
  abonado: "45678901",
});
assert.equal("+54 9 11 4567-8901".length, 18);
assert.deepEqual(interpretarTipeado("+54 9 3863 45-1234", "381"), {
  area: "3863",
  abonado: "451234",
});

// ⚠️ El caso que obliga a mirar el largo: en 381 hay abonados que empiezan
// con 11. Tipeando "1123456" NO se puede cambiar a Buenos Aires, porque son
// 7 dígitos y en 381 el abonado son 7.
assert.deepEqual(interpretarTipeado("1123456", "381"), { area: "381", abonado: "1123456" });

// Pero con el 0 adelante no hay ambigüedad: dijo "larga distancia".
assert.deepEqual(interpretarTipeado("01123456789", "381"), { area: "11", abonado: "23456789" });

// Escribiendo de a un dígito, la característica no salta hasta completar: los
// dígitos se van juntando en el abonado, aunque pasen del largo que le
// corresponde, y recién a los 10 se parten. Si se truncaran antes nunca se
// llegaría a los 10 y escribir el número entero sería imposible — que es
// justo lo que pasaba.
assert.deepEqual(interpretarTipeado("3", "381"), { area: "381", abonado: "3" });
assert.deepEqual(interpretarTipeado("38", "381"), { area: "381", abonado: "38" });
assert.deepEqual(interpretarTipeado("381", "381"), { area: "381", abonado: "381" });
assert.deepEqual(interpretarTipeado("38150101", "381"), { area: "381", abonado: "38150101" });
// Y al décimo dígito se acomoda solo.
assert.deepEqual(interpretarTipeado("3815010101", "381"), { area: "381", abonado: "5010101" });

// Nunca pasa de los 10 dígitos nacionales, tipeen lo que tipeen.
assert.equal(interpretarTipeado("38150101019999", "381").abonado.length, 7);
assert.ok(interpretarTipeado("99991234567890", "381").abonado.length <= 10);

// Vacío es vacío, no una característica inventada.
assert.deepEqual(interpretarTipeado("", "381"), { area: "381", abonado: "" });

// Y lo interpretado tiene que poder guardarse y volver igual.
const { area, abonado } = interpretarTipeado("0381 15 501-0101", "3863");
assert.equal(aNumeroGuardado(area, abonado), "5493815010101");
assert.deepEqual(desdeNumeroGuardado(aNumeroGuardado(area, abonado)), { area, abonado });

console.log("✓ telefonos.ts — el campo acepta el número escrito de cualquier forma");

console.log("✓ telefonos.ts OK");
