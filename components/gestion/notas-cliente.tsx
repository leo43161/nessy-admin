"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getNotasDeCliente } from "@/services/clientes.service";
import { formatFecha } from "@/lib/format";
import type { Nota } from "@/types";

/**
 * Las notas del cliente, listas para embeber en cualquier modal.
 *
 * Van en todos los modales del cliente porque son el contexto que el cobrador
 * necesita justo antes de tocar el timbre —"no atiende de mañana", "el perro
 * está suelto"— y tenerlas escondidas detrás de otra pantalla es tenerlas
 * apagadas.
 *
 * Se piden solas: los modales que ya traen la ficha completa le pasan las notas
 * por `notas` y se ahorran el request.
 */
export function NotasCliente({ clienteId, notas }: { clienteId: number; notas?: Nota[] }) {
  const [propias, setPropias] = useState<Nota[] | null>(notas ?? null);

  useEffect(() => {
    if (notas) return;
    let activo = true;
    getNotasDeCliente(clienteId)
      .then((n) => activo && setPropias(n))
      .catch(() => activo && setPropias([]));
    return () => {
      activo = false;
    };
  }, [clienteId, notas]);

  if (propias === null) return <Skeleton className="h-12" />;
  if (propias.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[0.68rem] font-bold tracking-widest text-muted-foreground uppercase">
        <FileText className="size-3.5" />
        Notas ({propias.length})
      </div>
      {propias.map((nota) => (
        <div key={nota.id} className="rounded-lg border bg-card p-2.5">
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{nota.nota}</p>
          <span className="mt-1 block text-[0.65rem] text-muted-foreground">
            {formatFecha(nota.fechaDeCreacion)}
          </span>
        </div>
      ))}
    </div>
  );
}
