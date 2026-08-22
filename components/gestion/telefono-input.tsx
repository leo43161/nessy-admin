"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AREA_POR_DEFECTO,
  AREAS_PAIS,
  AREAS_TUCUMAN,
  LARGO_MAXIMO,
  aNumeroGuardado,
  desdeNumeroGuardado,
  interpretarTipeado,
  largoAbonado,
  telefonoCompleto,
} from "@/lib/telefonos";

/** ¿Este número está completo y se puede guardar? */
export function esTelefonoGuardable(guardado: string): boolean {
  const { area, abonado } = desdeNumeroGuardado(guardado);
  return telefonoCompleto(area, abonado);
}

interface TelefonosInputProps {
  /** Números tal como se guardan (`5493815010101`) */
  valores: string[];
  onChange: (valores: string[]) => void;
}

/**
 * Carga de teléfonos.
 *
 * **Se escribe el número como uno lo tenga anotado** y el campo lo acomoda:
 * con o sin el 0 de larga distancia, con o sin el 15, con o sin +54 9, o solo
 * el abonado. Abajo se ve cómo va a quedar guardado.
 *
 * Antes eran dos controles sin explicación —un `+54 9` fijo, un select de
 * característica y un campo que solo aceptaba el abonado—, y no se entendía ni
 * qué pedía cada uno ni cómo terminaba el número. Quien tiene "3815010101"
 * anotado lo escribe entero, y eso no entraba.
 *
 * El select sigue estando porque hace falta: cuando se escribe solo el abonado
 * —que es como se dicta un teléfono entre vecinos— no hay de dónde sacar la
 * característica. Pero pasó a ser ayuda y no requisito, y se sincroniza solo
 * cuando el número tipeado la trae.
 *
 * El formato importa porque estos números terminan en un link de `wa.me`, que
 * no perdona un `15` de más ni un `9` de menos.
 */
export function TelefonosInput({ valores, onChange }: TelefonosInputProps) {
  const areaSugerida = AREA_POR_DEFECTO;

  const partes = valores.map(desdeNumeroGuardado);

  /**
   * El texto tal como se tipeó, sin normalizar.
   *
   * Hace falta porque lo que se guarda es la versión limpia, y si el campo
   * mostrara esa, cada tecla se apoyaría sobre el texto ya normalizado: al
   * escribir "0381…" el 0 se descarta en el acto, la tecla siguiente aterriza
   * sobre un campo vacío y el número termina corrido. Acá se conserva lo
   * escrito y la normalización queda para el valor que sale.
   */
  const [crudos, setCrudos] = useState<string[]>(() => partes.map((p) => p.abonado));

  /**
   * Qué texto mostrar en la fila.
   *
   * Se prefiere lo tipeado, pero solo mientras siga describiendo el número que
   * está guardado. Si el valor cambió por afuera —otro referente, un reset del
   * formulario— lo tipeado ya no corresponde y se muestra el número limpio.
   */
  const textoDe = (i: number, area: string, abonado: string) => {
    const crudo = crudos[i];
    if (crudo === undefined) return abonado;
    const leido = interpretarTipeado(crudo, area);
    return leido.area === area && leido.abonado === abonado ? crudo : abonado;
  };

  const set = (i: number, area: string, abonado: string, crudo?: string) => {
    if (crudo !== undefined) setCrudos((c) => c.map((v, j) => (j === i ? crudo : v)));
    onChange(valores.map((v, j) => (j === i ? aNumeroGuardado(area, abonado) : v)));
  };

  const quitar = (i: number) => {
    setCrudos((c) => c.filter((_, j) => j !== i));
    onChange(valores.filter((_, j) => j !== i));
  };

  const agregar = () => {
    setCrudos((c) => [...c, ""]);
    onChange([...valores, aNumeroGuardado(areaSugerida, "")]);
  };

  return (
    <div className="space-y-2">
      <Label>Teléfonos</Label>
      <p className="text-xs text-muted-foreground">
        Escribilo como lo tengas anotado: con o sin 0, con o sin 15. Se guarda en el formato que
        necesita WhatsApp.
      </p>

      {partes.map((p, i) => {
        // Un número viejo puede tener una característica que no está en la
        // lista: ahí se muestra la de siempre y el aviso de abajo va a marcar
        // que los dígitos no cierran, que es lo que obliga a revisarlo.
        const area = p.area || areaSugerida;
        const completo = telefonoCompleto(area, p.abonado);
        const conAlgo = p.abonado !== "";
        const faltan = largoAbonado(area) - p.abonado.length;

        return (
          // Una tarjeta por teléfono, en una sola columna. En el celular esto
          // se usa parado en la puerta de una casa: los controles van uno
          // debajo del otro y a lo ancho, no apretados en una fila.
          <div key={i} className="space-y-2 rounded-lg border border-input p-2.5">
            <div className="flex items-center gap-2">
              <Input
                value={textoDe(i, area, p.abonado)}
                onChange={(e) => {
                  const { area: nueva, abonado } = interpretarTipeado(e.target.value, area);
                  set(i, nueva, abonado, e.target.value);
                }}
                placeholder={`${area} ${"5".repeat(largoAbonado(area))}`}
                inputMode="tel"
                // El tope es sobre el TEXTO, no sobre los dígitos: acá entra
                // lo que se pega tal cual. "+54 9 11 4567-8901" son 18
                // caracteres para 10 dígitos, así que el margen tiene que
                // alcanzar para el prefijo y los separadores. De los dígitos
                // se ocupa `interpretarTipeado`, que corta en 10.
                maxLength={LARGO_MAXIMO + 14}
                aria-label={`Teléfono ${i + 1}`}
                aria-invalid={conAlgo && !completo}
                className="min-w-0 flex-1 font-mono aria-invalid:border-red-500"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Quitar teléfono ${i + 1}`}
                disabled={valores.length === 1}
                onClick={() => quitar(i)}
              >
                <X />
              </Button>
            </div>

            {/* Cómo va a quedar. Es lo que faltaba: el número se guarda con
                prefijos que no se tipean, así que sin esto no había forma de
                saber qué se estaba por guardar. */}
            <p
              className={cn(
                "flex items-center gap-1.5 font-mono text-xs",
                completo ? "text-accent-foreground" : "text-muted-foreground",
              )}
            >
              {completo && <Check className="size-3.5 shrink-0" />}
              {completo
                ? `Se guarda: +54 9 ${area} ${p.abonado}`
                : conAlgo
                  ? faltan > 0
                    ? `Faltan ${faltan} ${faltan === 1 ? "dígito" : "dígitos"}`
                    : `Sobran ${-faltan} ${-faltan === 1 ? "dígito" : "dígitos"}`
                  : `Va a quedar: +54 9 ${area} …`}
            </p>

            <div className="space-y-1">
              <label
                htmlFor={`area-${i}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Característica
              </label>
              <select
                id={`area-${i}`}
                value={area}
                onChange={(e) => set(i, e.target.value, p.abonado)}
                className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <optgroup label="Tucumán">
                  {AREAS_TUCUMAN.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.codigo} · {a.zona}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Resto del país">
                  {AREAS_PAIS.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.codigo} · {a.zona}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-muted-foreground">
                Se acomoda sola si escribís el número completo. Sirve para cuando tenés solo los
                últimos {largoAbonado(area)} dígitos.
              </p>
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        onClick={agregar}
      >
        <Plus />
        Agregar otro teléfono
      </Button>
    </div>
  );
}
