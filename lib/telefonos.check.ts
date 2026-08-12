// Chequeo de lib/telefonos.ts — `node lib/telefonos.check.ts`
//
// Un dígito de más o de menos acá y el link de WhatsApp abre un chat que no
// existe, sin ningún error visible. Por eso los casos raros están todos.
import assert from "node:assert/strict";
import {
  AREA_POR_LOCALIDAD,
  AREAS,
  aNumeroGuardado,
  desdeNumeroGuardado,
  formatearParaLeer,
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

// Las 25 localidades de la base tienen característica, y es una de la lista.
const codigos = new Set(AREAS.map((a) => a.codigo));
for (const [localidad, area] of Object.entries(AREA_POR_LOCALIDAD)) {
  assert.ok(codigos.has(area), `${localidad} apunta a una característica que no existe: ${area}`);
}
assert.equal(Object.keys(AREA_POR_LOCALIDAD).length, 25, "son 25 localidades en la base");

console.log("✓ telefonos.ts OK");
