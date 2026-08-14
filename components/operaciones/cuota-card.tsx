"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTADO } from "@/lib/status";
import { fmtMoney, formatFecha } from "@/lib/format";
import { diasEntre, textoAtraso } from "@/lib/cuotas";
import { StatusChip } from "@/components/shared/status-chip";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { esApoyo, estadoVisible } from "@/lib/agregados";
import type { CobroDelDia } from "@/types";

/** Card de una cuota dentro de la columna de su cobrador */
export function CuotaCard({
  cobro,
  hoy,
  onClick,
  onReclamado,
}: {
  cobro: CobroDelDia;
  hoy: string;
  onClick?: () => void;
  /** Refresca el tablero cuando la cuota pasa a "Reclamo realizado" */
  onReclamado?: () => void;
}) {
  const estado = estadoVisible(cobro, hoy);
  const meta = ESTADO[estado];
  const apoyo = esApoyo(cobro);
  // Reclamo pendiente = ya se visitó y no se pudo cobrar. Es la acción más
  // urgente del tablero: va con PDF y queda registrada.
  const reclamoPendiente = estado === "ReclamoPendiente";
  const vencida = estado === "Vencido" || reclamoPendiente;
  const dias = diasEntre(cobro.fechaAcordada, hoy);

  // Con qué se completan los comodines de la plantilla que elija el admin.
  const datos = {
    cliente: cobro.cliente.nombreCompleto.split(" ")[0],
    monto: fmtMoney(cobro.montoEsperado),
    fecha: formatFecha(cobro.fechaAcordada),
    dias,
    plan: cobro.planNombre,
  };

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

        {/* Los dos abren el mismo selector de plantillas; lo que cambia es el
            grito: en una vencida el reclamo es LA acción, no una más de las
            disponibles, así que va en rojo y con texto. */}
        <WhatsappButton
          telefonos={cobro.cliente.telefonos}
          datos={datos}
          // Solo la visitada se reclama con PDF y queda registrada: una vencida
          // que nadie fue a ver todavía no es un reclamo.
          reclamo={
            reclamoPendiente
              ? {
                  cuotaId: cobro.id,
                  clienteId: cobro.cliente.id,
                  clienteNombre: cobro.cliente.nombreCompleto,
                  clienteDni: cobro.cliente.dni,
                  clienteDireccion: cobro.cliente.direccion,
                  onReclamado,
                }
              : undefined
          }
          titulo={vencida ? "Reclamo por atraso" : "Mensaje al cliente"}
          descripcion={
            vencida
              ? `${cobro.cliente.nombreCompleto} · ${fmtMoney(cobro.montoEsperado)} ${textoAtraso(dias)}`
              : cobro.cliente.nombreCompleto
          }
        >
          {vencida ? (
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-red-600 px-2 py-1.5 text-[0.65rem] font-bold text-white transition-transform active:scale-90">
              <MessageCircle className="size-3.5" />
              Reclamar
            </span>
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#25D366] transition-transform active:scale-90">
              <MessageCircle className="size-4 text-white" />
            </span>
          )}
        </WhatsappButton>
      </div>
    </div>
  );
}
