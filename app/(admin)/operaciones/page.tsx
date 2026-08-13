"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { CountBadge, SectionHeader } from "@/components/shared/section-header";
import { KanbanBoard } from "@/components/operaciones/kanban-board";
import { ClienteDetailDialog } from "@/components/gestion/cliente-detail-dialog";
import { columnasPorCobrador } from "@/lib/agregados";
import { usePeriodo } from "@/hooks/use-periodo";

export default function OperacionesPage() {
  const { cobros, cobradores, hoy, cargando, error, etiquetaRango } = usePeriodo();
  const [clienteId, setClienteId] = useState<number | null>(null);

  const columnas = useMemo(
    () => columnasPorCobrador(cobros, cobradores, hoy),
    [cobros, cobradores, hoy],
  );

  return (
    <>
      <SectionHeader titulo="Tareas del período" subtitulo={etiquetaRango}>
        <CountBadge>{cobros.length}</CountBadge>
      </SectionHeader>

      {cargando ? (
        <div className="flex gap-3 overflow-hidden px-4 pb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-[265px] shrink-0 rounded-2xl sm:w-[300px]" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon="⚠️">{error}</EmptyState>
      ) : columnas.length === 0 ? (
        <EmptyState icon="📭">
          Sin cuotas en este período.
          <br />
          Probá con otra fecha o ampliá el rango.
        </EmptyState>
      ) : (
        <>
          <p className="px-4 pb-1.5 text-xs font-medium text-muted-foreground">
            ← Deslizá entre cobradores →
          </p>
          <KanbanBoard
            columnas={columnas}
            hoy={hoy}
            onSeleccionar={setClienteId}
          />
        </>
      )}

      <ClienteDetailDialog
        clienteId={clienteId}
        open={clienteId !== null}
        onOpenChange={(abierto) => !abierto && setClienteId(null)}
      />

    </>
  );
}
