"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTADO } from "@/lib/status";
import { fmtMoney, formatFecha } from "@/lib/format";
import { StatusChip } from "@/components/shared/status-chip";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { esApoyo, estadoVisible } from "@/lib/agregados";
import type { CobroDelDia } from "@/types";

/** Card de una cuota dentro de la columna de su cobrador */
export function CuotaCard({
  cobro,
  hoy,
  onClick,
  onReclamar,
}: {
  cobro: CobroDelDia;
  hoy: string;
  onClick?: () => void;
  /** Solo para las vencidas: abre el mensaje de atraso con plantilla */
  onReclamar?: () => void;
}) {
  const estado = estadoVisible(cobro, hoy);
  const meta = ESTADO[estado];
  const apoyo = esApoyo(cobro);

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && e.key === "Enter" && onClick()}
      className={cn(
        "rounded-xl border-[1.5px] p-3 transition-transform",
        meta.card,
        onClick && "cursor-pointer active:scale-[0.98]",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm leading-tight font-bold">
            {cobro.cliente.nombreCompleto}
          </div>
          <div className="mt-0.5 font-mono text-[0.66rem] text-muted-foreground">
            Plan #{cobro.planId} · {formatFecha(cobro.fechaAcordada)}
          </div>
        </div>
        <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", meta.dot)} />
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold">{fmtMoney(cobro.montoEsperado)}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <StatusChip estado={estado} />
            {apoyo && (
              <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[0.62rem] font-bold whitespace-nowrap text-primary">
                ⇄ {cobro.cobradoPorNombre}
              </span>
            )}
          </div>
        </div>

        {/* Vencida: el botón deja de ser "abrir el chat" y pasa a ser un
            reclamo con plantilla. Va en rojo y con texto porque es la acción
            que hay que hacer, no una más de las disponibles. */}
        {estado === "Vencido" && onReclamar ? (
          <button
            type="button"
            onClick={(e) => {
              // La card entera es clickeable: sin esto se abriría también la
              // ficha del cliente detrás del diálogo.
              e.stopPropagation();
              onReclamar();
            }}
            className="flex shrink-0 items-center gap-1 rounded-md bg-red-600 px-2 py-1.5 text-[0.65rem] font-bold text-white transition-transform active:scale-90"
          >
            <MessageCircle className="size-3.5" />
            Reclamar
          </button>
        ) : (
          <WhatsappButton telefonos={cobro.cliente.telefonos}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#25D366] transition-transform active:scale-90">
              <MessageCircle className="size-4 text-white" />
            </span>
          </WhatsappButton>
        )}
      </div>
    </div>
  );
}
