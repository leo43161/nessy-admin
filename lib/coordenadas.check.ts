// Chequeo de lib/coordenadas.ts — `node lib/coordenadas.check.ts`
//
// Lo que se cuida acá es que en la columna del punto de cobro no entre nada que
// el SP no pueda leer: si entra, el control de los 2 km del cliente se apaga
// sin avisar.
import assert from "node:assert/strict";
import { formatearPunto, parsearPunto } from "./coordenadas.ts";

// El formato real, tal como está en el dump.
assert.deepEqual(parsearPunto("-26.8371,-65.2101"), { lat: -26.8371, lon: -65.2101 });

// Espacios de sobra: se aceptan al leer, pero nunca se escriben.
assert.deepEqual(parsearPunto(" -26.8371 , -65.2101 "), { lat: -26.8371, lon: -65.2101 });
assert.equal(formatearPunto({ lat: -26.8371, lon: -65.2101 }), "-26.8371,-65.2101");

// Lo que había antes del mapa: texto libre en la columna de coordenadas.
// Tiene que dar null para que el form lo trate como "sin punto", no como dato.
assert.equal(parsearPunto("Kiosco · Perú 2210"), null);
assert.equal(parsearPunto("Av. Mate de Luna 2500"), null);

assert.equal(parsearPunto(null), null);
assert.equal(parsearPunto(""), null);
assert.equal(parsearPunto("-26.8371"), null, "falta la longitud");
assert.equal(parsearPunto("-26.8371,-65.2101,12"), null, "un tercer valor no es un punto");

// Fuera del planeta: probablemente lat y lon invertidas o basura.
assert.equal(parsearPunto("-91,0"), null);
assert.equal(parsearPunto("0,181"), null);

// El 0,0 es un punto válido aunque esté en el Atlántico: no se filtra.
assert.deepEqual(parsearPunto("0,0"), { lat: 0, lon: 0 });

// Leaflet devuelve muchos más decimales de los que la columna DECIMAL(_,8)
// puede guardar; se recortan acá y no en MySQL.
assert.equal(formatearPunto({ lat: -26.83712345678, lon: -65.21019876 }), "-26.837123,-65.210199");

// Lo que sale de formatear tiene que poder volver a entrar.
const ida = { lat: -26.837123, lon: -65.210199 };
assert.deepEqual(parsearPunto(formatearPunto(ida)), ida);

console.log("✓ coordenadas.ts OK");
