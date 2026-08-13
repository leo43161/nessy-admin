"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AREA_POR_DEFECTO,
  AREA_POR_LOCALIDAD,
  AREAS_PAIS,
  AREAS_TUCUMAN,
  aNumeroGuardado,
  desdeNumeroGuardado,
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
  /** Nombre de la localidad del cliente: preselecciona la característica */
  localidadNombre?: string | null;
}

/**
 * Carga de teléfonos guiada: `+54 9` fijo, característica de un select y solo
 * el abonado a mano.
 *
 * El formato importa porque estos números terminan en un link de `wa.me`, que
 * no perdona un `15` de más ni un `9` de menos. Antes era un input libre y cada
 * uno lo escribía como quería.
 */
export function TelefonosInput({ valores, onChange, localidadNombre }: TelefonosInputProps) {
  const areaSugerida =
    (localidadNombre ? AREA_POR_LOCALIDAD[localidadNombre] : null) ?? AREA_POR_DEFECTO;

  const partes = valores.map(desdeNumeroGuardado);

  const set = (i: number, area: string, abonado: string) =>
    onChange(valores.map((v, j) => (j === i ? aNumeroGuardado(area, abonado) : v)));

  return (
    <div className="space-y-1.5">
      <Label>Teléfonos</Label>

      {partes.map((p, i) => {
        // Al editar un número viejo puede no reconocerse la característica: se
        // sugiere la de la localidad y se marca hasta que la confirmen.
        const area = p.area || areaSugerida;
        const incompleto = p.abonado !== "" && !telefonoCompleto(area, p.abonado);

        return (
          // En el teléfono va en dos renglones: prefijo + característica arriba,
          // número + quitar abajo. Los cuatro en una línea no entran —el select
          // lleva el nombre de la zona— y se desbordaba del modal.
          // El recuadro es solo en móvil: con dos renglones por teléfono, sin
          // él no se ve qué característica va con qué número.
          <div
            key={i}
            className="space-y-1.5 max-sm:rounded-md max-sm:border max-sm:p-2 sm:flex sm:items-center sm:gap-1.5 sm:space-y-0"
          >
            <div className="flex items-center gap-1.5">
              <span className="flex h-9 shrink-0 items-center rounded-md bg-muted px-2 font-mono text-sm text-muted-foreground">
                +54 9
              </span>

              <select
                value={area}
                onChange={(e) => set(i, e.target.value, p.abonado)}
                aria-label={`Característica del teléfono ${i + 1}`}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 font-mono text-sm shadow-xs sm:w-40 sm:flex-none"
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
            </div>

            <div className="flex items-center gap-1.5 sm:min-w-0 sm:flex-1">
              <Input
                value={p.abonado}
                // Solo dígitos y con el largo que corresponde a esa
                // característica: 7 para 381, 6 para 3863.
                onChange={(e) =>
                  set(i, area, e.target.value.replace(/\D/g, "").slice(0, largoAbonado(area)))
                }
                placeholder={"5".repeat(largoAbonado(area))}
                inputMode="tel"
                aria-label={`Número del teléfono ${i + 1}`}
                aria-invalid={incompleto}
                className="min-w-0 flex-1 font-mono aria-invalid:border-red-500"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={`Quitar teléfono ${i + 1}`}
                disabled={valores.length === 1}
                onClick={() => onChange(valores.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </div>
          </div>
        );
      })}

      {partes.some(
        (p) => p.abonado !== "" && !telefonoCompleto(p.area || areaSugerida, p.abonado),
      ) && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Falta completar el número: entre característica y abonado son 10 dígitos.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...valores, aNumeroGuardado(areaSugerida, "")])}
      >
        <Plus />
        Agregar teléfono
      </Button>
    </div>
  );
}
