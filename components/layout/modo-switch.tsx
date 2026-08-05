"use client";

import { useRouter } from "next/navigation";
import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODOS, type Modo } from "@/lib/navegacion";

/**
 * Alterna entre las dos caras del panel:
 *   supervisión → auditar lo que pasó (kanban, cierre, análisis) · solo lectura
 *   gestión     → crear y editar clientes y financiaciones · escribe en la DB
 *
 * El modo no vive en el store: lo dice la URL. Cambiarlo es navegar a la
 * primera pestaña del otro modo.
 */
export function ModoSwitch({ modo }: { modo: Modo }) {
  const router = useRouter();

  return (
    <div
      role="tablist"
      aria-label="Modo del panel"
      className="flex items-center gap-0.5 rounded-full border border-input bg-secondary p-0.5"
    >
      {(Object.keys(MODOS) as Modo[]).map((m) => {
        const activo = m === modo;
        const Icono = m === "supervision" ? Eye : Pencil;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={activo}
            onClick={() => router.push(MODOS[m].tabs[0].href)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              activo
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icono className="size-3.5" />
            <span className="hidden sm:inline">{MODOS[m].label}</span>
          </button>
        );
      })}
    </div>
  );
}
