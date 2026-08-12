// Chequeo de aplicarPlantilla — `node lib/plantillas.check.ts`
//
// Este texto sale hacia el cliente por WhatsApp. Un comodín que se reemplaza
// mal manda un mensaje sin sentido, y no hay forma de despublicarlo.
import assert from "node:assert/strict";
import { aplicarPlantilla, COMODINES } from "./plantillas.ts";

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

console.log("✓ plantillas OK");
