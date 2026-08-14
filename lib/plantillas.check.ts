// Chequeo de aplicarPlantilla — `node lib/plantillas.check.ts`
//
// Este texto sale hacia el cliente por WhatsApp. Un comodín que se reemplaza
// mal manda un mensaje sin sentido, y no hay forma de despublicarlo.
import assert from "node:assert/strict";
import { aplicarPlantilla, comodinesDesconocidos, COMODINES, EJEMPLO } from "./plantillas.ts";

const datos = {
  cliente: "Juan Pérez",
  monto: "$ 20.000,00",
  fecha: "10 ago 2026",
  dias: 5,
  plan: "Moto Honda",
};

assert.equal(
  aplicarPlantilla("Hola {cliente}, tenés {monto} vencidos desde el {fecha}.", datos),
  "Hola Juan Pérez, tenés $ 20.000,00 vencidos desde el 10 ago 2026.",
);

// Un número entra como texto sin romper nada.
assert.equal(aplicarPlantilla("{dias} días de atraso", datos), "5 días de atraso");

// El mismo comodín dos veces se reemplaza las dos.
assert.equal(aplicarPlantilla("{cliente}, {cliente}!", datos), "Juan Pérez, Juan Pérez!");

// Mal escrito: se deja a la vista para que se note y se corrija la plantilla.
assert.equal(
  aplicarPlantilla("Hola {clientee}", datos),
  "Hola {clientee}",
  "un comodín inexistente no se borra: escondido, el cliente recibiría una frase sin sujeto",
);

// Dato que el botón no conoce: se deja crudo, no se escribe "undefined".
assert.equal(
  aplicarPlantilla("Hola {cliente}, sobre {plan}", { cliente: "Ana" }),
  "Hola Ana, sobre {plan}",
);

// Sin comodines, el texto pasa igual.
assert.equal(aplicarPlantilla("Pasamos mañana.", datos), "Pasamos mañana.");
assert.equal(aplicarPlantilla("", datos), "");

// Las llaves sueltas no son un comodín y no se tocan.
assert.equal(aplicarPlantilla("Costo: {} pesos", datos), "Costo: {} pesos");

// Todos los comodines que se le ofrecen al admin tienen que funcionar de
// verdad: si uno se ofrece y no se reemplaza, sale crudo al cliente.
for (const c of COMODINES) {
  const resultado = aplicarPlantilla(`{${c.clave}}`, datos);
  assert.notEqual(resultado, `{${c.clave}}`, `el comodín {${c.clave}} se ofrece pero no reemplaza`);
}

/* ── comodines mal escritos ── */

// Lo que el admin tiene que ver ANTES de mandar: crudos salen igual.
assert.deepEqual(comodinesDesconocidos("Hola {clientee}, debés {monto}"), ["clientee"]);
assert.deepEqual(comodinesDesconocidos("Hola {cliente}, debés {monto}"), [], "todos válidos");
assert.deepEqual(comodinesDesconocidos("sin comodines"), []);

// Repetido se avisa una sola vez: es el mismo error.
assert.deepEqual(comodinesDesconocidos("{x} y {x} y {x}"), ["x"]);

// Varios distintos salen todos.
assert.deepEqual(comodinesDesconocidos("{a} {b} {cliente}"), ["a", "b"]);

// Las llaves vacías no son un comodín.
assert.deepEqual(comodinesDesconocidos("Costo: {} pesos"), []);

/* ── el ejemplo de la vista previa tiene que resolver TODO ── */
//
// Si al ejemplo le faltara una clave, la vista previa mostraría el comodín
// crudo y el admin creería que su plantilla está mal.
for (const c of COMODINES) {
  assert.notEqual(
    aplicarPlantilla(`{${c.clave}}`, EJEMPLO),
    `{${c.clave}}`,
    `EJEMPLO no cubre {${c.clave}}: la vista previa lo mostraría crudo`,
  );
}

console.log("✓ plantillas OK");
