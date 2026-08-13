"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMoney, formatFecha } from "@/lib/format";
import { diasEntre } from "@/lib/cuotas";
import { estadoVisible } from "@/lib/agregados";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import type { CobroDelDia } from "@/types";

/**
 * Aviso de cuotas vencidas, arriba del kanban.
 *
 * Una cuota vencida en una columna del kanban hay que ir a buscarla; acá salta
 * sola al entrar. Prioriza **las que todavía no se reclamaron**: la columna
 * `WhatsApp_Enviado` dice cuáles ya recibieron el comprobante, así que el
 * cartel señala lo que falta hacer y no lo que ya está hecho.
 *
 * De cada una se puede reclamar sin moverse, con el mismo selector de
 * plantillas que el resto del panel.
 */
export function AvisoAtrasos({ cobros, hoy }: { cobros: CobroDelDia[]; hoy: string }) {
  const [abierto, setAbierto] = useState(false);

  const vencidas = cobros
    .filter((c) => {
      const e = estadoVisible(c, hoy);
      return e === "Vencido" || e === "Atrasado";
    })
    .sort((a, b) => a.fechaAcordada.localeCompare(b.fechaAcordada));

  if (vencidas.length === 0) return null;

  // Las dos son deuda, pero piden cosas distintas: la vencida necesita que
  // alguien vaya, la atrasada ya se visitó y necesita una decisión.
  const sinVisitar = vencidas.filter((c) => c.estado !== "Atrasado");
  const gestionadas = vencidas.filter((c) => c.estado === "Atrasado");
  const sinReclamar = vencidas.filter((c) => !c.whatsappEnviado);
  const monto = vencidas.reduce((s, c) => s + c.montoEsperado, 0);

  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-xl border-[1.5px] border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <TriangleAlert className="size-4.5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-red-800 dark:text-red-200">
            {vencidas.length} {vencidas.length === 1 ? "cuota en deuda" : "cuotas en deuda"} ·{" "}
            <span className="font-mono">{fmtMoney(monto)}</span>
          </div>
          <div className="text-[0.7rem] text-red-700 dark:text-red-300">
            {sinVisitar.length > 0 && `${sinVisitar.length} sin visitar`}
            {sinVisitar.length > 0 && gestionadas.length > 0 && " · "}
            {gestionadas.length > 0 && `${gestionadas.length} visitadas sin éxito`}
            {sinReclamar.length > 0 && ` · ${sinReclamar.length} sin reclamar`}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-red-600 transition-transform dark:text-red-400",
            abierto && "rotate-180",
          )}
        />
      </button>

      {abierto && (
        <ul className="max-h-72 space-y-1 overflow-y-auto border-t border-red-200 p-2 dark:border-red-900">
          {vencidas.map((c) => {
            const dias = diasEntre(c.fechaAcordada, hoy);
            return (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate font-semibold">
                      {c.cliente.nombreCompleto}
                    </span>
                    {/* Ya se fue a buscarla: no es que nadie la haya visitado. */}
                    {c.estado === "Atrasado" && (
                      <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-px text-[0.58rem] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                        visitada
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[0.65rem] text-muted-foreground">
                    {fmtMoney(c.montoEsperado)} · {formatFecha(c.fechaAcordada)} · {dias}{" "}
                    {dias === 1 ? "día" : "días"}
                  </div>
                </div>

                {/* Ya reclamada: se marca en vez de esconderla, para que se vea
                    que esa gestión está hecha y no se repita el mensaje. */}
                {c.whatsappEnviado ? (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[0.6rem] font-bold text-green-800 dark:bg-green-950 dark:text-green-300">
                    Reclamada
                  </span>
                ) : (
                  <WhatsappButton
                    telefonos={c.cliente.telefonos}
                    titulo="Reclamo por atraso"
                    descripcion={`${c.cliente.nombreCompleto} · ${fmtMoney(c.montoEsperado)} vencidos hace ${dias} ${dias === 1 ? "día" : "días"}`}
                    datos={{
                      cliente: c.cliente.nombreCompleto.split(" ")[0],
                      monto: fmtMoney(c.montoEsperado),
                      fecha: formatFecha(c.fechaAcordada),
                      dias,
                      plan: c.planNombre,
                    }}
                  >
                    <span className="flex shrink-0 items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[0.62rem] font-bold text-white transition-transform active:scale-90">
                      <MessageCircle className="size-3" />
                      Reclamar
                    </span>
                  </WhatsappButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
