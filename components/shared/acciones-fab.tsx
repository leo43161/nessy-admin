"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Una cosa que se puede hacer en la pantalla actual.
 *
 * `descripcion` no es decoración: el reclamo del cliente fue que los usuarios
 * "son gente grande con poco conocimiento digital", y una etiqueta de dos
 * palabras no alcanza para que alguien que no reconoce los íconos entienda qué
 * va a pasar si toca.
 */
export interface AccionPantalla {
  /** Qué hace, en infinitivo y en criollo: "Cambiar el día de trabajo" */
  label: string;
  /** Una línea de ayuda debajo */
  descripcion?: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Separador arriba de esta acción, para agrupar */
  separar?: boolean;
}

/**
 * El id del hueco donde cae el botón. Lo pone el layout de cada app, porque
 * dónde va depende del armazón —la del cobrador es una franja centrada del
 * ancho de un teléfono, la del admin ocupa todo y tiene una barra lateral— y
 * eso no lo puede saber una pantalla suelta.
 */
export const RANURA_ACCIONES = "ranura-acciones";

/**
 * El botón de acciones de la pantalla, abajo a la izquierda.
 *
 * Existe porque el cliente nos dijo, textual, que los botones eran muy chicos
 * y que su gente no los encontraba. Este no reemplaza a los controles de cada
 * pantalla: los **repite** en un solo lugar fijo, grande y siempre en el mismo
 * sitio, con el nombre completo de cada cosa. El que ya sabe usa los controles
 * de arriba; el que no, abre esto.
 *
 * Se dibuja con un portal a la ranura del layout en vez de posicionarse solo:
 * así cada pantalla declara SUS acciones y no tiene que saber nada de dónde
 * termina el botón ni de la barra de navegación que podría taparlo.
 */
export function AccionesFab({ acciones }: { acciones: AccionPantalla[] }) {
  const [ranura, setRanura] = useState<HTMLElement | null>(null);

  // El nodo destino lo renderiza el layout, así que recién existe después del
  // primer pintado. En el servidor no hay document: por eso un efecto y no una
  // búsqueda directa (con `output: "export"` esto se prerenderiza).
  useEffect(() => {
    setRanura(document.getElementById(RANURA_ACCIONES));
  }, []);

  const disponibles = acciones.filter((a) => !a.disabled);

  // Sin nada que ofrecer, un botón que abre un menú vacío es peor que no tener
  // botón: el usuario lo toca, no pasa nada y deja de confiar en él.
  if (!ranura || disponibles.length === 0) return null;

  return createPortal(
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="lg"
          className="pointer-events-auto h-14 rounded-full px-6 shadow-lg shadow-foreground/20"
        >
          <ListChecks />
          Opciones
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={12}
        // El ancho por defecto es el del disparador y acá quedaría un menú del
        // ancho del botón. `!` porque las dos clases son del mismo grupo.
        className="pointer-events-auto w-[min(23rem,calc(100vw-1.5rem))]! p-2"
      >
        <DropdownMenuLabel className="px-3 py-2 text-base font-bold">
          ¿Qué puedo hacer acá?
        </DropdownMenuLabel>

        {acciones.map((accion, i) => (
          <div key={`${accion.label}-${i}`}>
            {accion.separar && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={accion.disabled}
              onSelect={accion.onSelect}
              className="gap-3 rounded-lg px-3 py-3"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground [&_svg]:size-6!">
                {accion.icon}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base leading-tight font-semibold">{accion.label}</span>
                {accion.descripcion && (
                  <span className="text-sm leading-tight text-muted-foreground">
                    {accion.descripcion}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>,
    ranura,
  );
}
