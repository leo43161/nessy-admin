"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Users, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { AccionesFab } from "@/components/shared/acciones-fab";
import { CountBadge, SectionHeader } from "@/components/shared/section-header";
import { KanbanBoard } from "@/components/operaciones/kanban-board";
import { AvisoAtrasos } from "@/components/operaciones/aviso-atrasos";
import { ClienteDetailDialog } from "@/components/gestion/cliente-detail-dialog";
import { columnasPorCobrador } from "@/lib/agregados";
import { usePeriodo } from "@/hooks/use-periodo";
import { useAccionesDePeriodo } from "@/hooks/use-acciones-periodo";
import { useAutoRefresco } from "@/hooks/use-auto-refresco";
import { AUTO_REFRESCO_SEGUNDOS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function OperacionesPage() {
  const { cobros, cobradores, hoy, cargando, error, etiquetaRango, refrescar } = usePeriodo();
  const [clienteId, setClienteId] = useState<number | null>(null);
  const router = useRouter();
  const accionesDePeriodo = useAccionesDePeriodo();

  const columnas = useMemo(
    () => columnasPorCobrador(cobros, cobradores, hoy),
    [cobros, cobradores, hoy],
  );

  // El tablero se queda abierto mientras los cobradores están en la calle, así
  // que se actualiza solo cada 10 segundos. El contador va a la vista para que
  // se sepa que lo que se está mirando es de recién.
  const restante = useAutoRefresco(refrescar, AUTO_REFRESCO_SEGUNDOS);

  return (
    <>
      <SectionHeader titulo="Tareas del período" subtitulo={etiquetaRango}>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="flex items-center gap-1 font-mono text-[0.7rem] text-muted-foreground"
            title={`El tablero se actualiza solo cada ${AUTO_REFRESCO_SEGUNDOS} segundos`}
          >
            <RefreshCw className={cn("size-3", cargando && "animate-spin")} />
            {restante}s
          </span>
          <CountBadge>{cobros.length}</CountBadge>
        </div>
      </SectionHeader>

      {cargando ? (
        <div className="flex gap-3 overflow-hidden px-4 pb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-66.25 shrink-0 rounded-2xl sm:w-75" />
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
          <AvisoAtrasos cobros={cobros} hoy={hoy} onReclamado={refrescar} />
          <p className="px-4 pb-1.5 text-xs font-medium text-muted-foreground">
            ← Deslizá entre cobradores →
          </p>
          <KanbanBoard
            columnas={columnas}
            hoy={hoy}
            onSeleccionar={setClienteId}
            onReclamado={refrescar}
          />
        </>
      )}

      <AccionesFab
        acciones={[
          {
            label: "Actualizar el tablero",
            descripcion: "Vuelve a traer las cuotas del período",
            icon: <RefreshCw />,
            onSelect: refrescar,
            disabled: cargando,
          },
          {
            label: "Ir a los clientes",
            descripcion: "Alta, edición y ficha de cada cliente",
            icon: <Users />,
            onSelect: () => router.push("/gestion/clientes"),
            separar: true,
          },
          {
            label: "Ir al cierre de caja",
            descripcion: "Cuánto trae cada cobrador en este período",
            icon: <Wallet />,
            onSelect: () => router.push("/cierre"),
          },
          ...accionesDePeriodo.map((accion, i) => ({ ...accion, separar: i === 0 })),
        ]}
      />

      <ClienteDetailDialog
        clienteId={clienteId}
        open={clienteId !== null}
        onOpenChange={(abierto) => !abierto && setClienteId(null)}
      />

    </>
  );
}
