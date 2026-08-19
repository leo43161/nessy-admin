"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/format";
import { METODO_EFECTIVO } from "@/lib/agregados";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import type { CierreCobrador, LedgerItem } from "@/types";

/** Estilo de cada tipo de fila del ledger */
const TIPO: Record<LedgerItem["tipo"], { tag: string; fila: string; monto: string }> = {
  propio: {
    tag: "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100",
    fila: "bg-green-50 dark:bg-green-950/40",
    monto: "text-green-600 dark:text-green-400",
  },
  apoyo: {
    tag: "bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
    fila: "bg-sky-50 dark:bg-sky-950/40",
    monto: "text-primary",
  },
  vencido: {
    tag: "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100",
    fila: "bg-red-50 dark:bg-red-950/40",
    monto: "text-red-600 dark:text-red-400",
  },
};

function etiqueta(item: LedgerItem): string {
  switch (item.tipo) {
    case "propio":
      return "Propio";
    case "apoyo":
      return `Apoyo→${item.cubreA}`;
    case "vencido":
      return "Vencido";
  }
}

/** Deuda: no hay plata que entregar, pero sí a quién llamar */
const CON_WHATSAPP: Array<LedgerItem["tipo"]> = ["vencido"];

export function LedgerCobrador({ cierre }: { cierre: CierreCobrador }) {
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border-[1.5px] border-border bg-card shadow-sm">
      <header className="flex items-center gap-2.5 border-b-[1.5px] border-border bg-secondary p-3.5">
        <InitialsAvatar nombre={cierre.nombre} color={cierre.color} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{cierre.nombre}</div>
          <div className="text-[0.63rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            Cobró en total
          </div>
        </div>
        <div className="font-mono text-[1.05rem] font-bold text-primary-dark">
          {fmtMoney(cierre.aEntregar)}
        </div>
      </header>

      {/* Cuánto cobró por cada método.
          Es lo que hay que saber al cerrar la caja: la fila de efectivo va
          aparte y destacada porque es la ÚNICA plata que el cobrador tiene
          encima y tiene que entregar en mano. Lo que entró por transferencia o
          Mercado Pago ya está en la cuenta; pedírselo también era cobrarle dos
          veces la misma plata. */}
      {cierre.porMetodo.length > 0 && (
        <div className="border-b-[1.5px] border-border px-3.5 py-2.5">
          <div className="mb-1.5 text-[0.63rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
            Por método de pago
          </div>
          <ul className="flex flex-col gap-1">
            {cierre.porMetodo.map((m) => (
              <li
                key={m.metodoId}
                className={cn(
                  "flex items-baseline gap-2 rounded px-1.5 py-1 text-xs",
                  m.metodoId === METODO_EFECTIVO && "bg-green-50 dark:bg-green-950/40",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{m.metodo}</span>
                <span className="shrink-0 text-[0.65rem] text-muted-foreground tabular-nums">
                  {m.cantidad} {m.cantidad === 1 ? "cobro" : "cobros"}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono font-bold tabular-nums",
                    m.metodoId === METODO_EFECTIVO
                      ? "text-green-700 dark:text-green-400"
                      : "text-foreground",
                  )}
                >
                  {fmtMoney(m.total)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t pt-2">
            <span className="text-[0.68rem] font-bold tracking-[0.05em] uppercase">
              A entregar en mano
            </span>
            <span className="font-mono text-sm font-bold text-green-700 dark:text-green-400">
              {fmtMoney(cierre.enEfectivo)}
            </span>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-1.5 p-3.5">
        {cierre.items.map((item) => {
          const estilo = TIPO[item.tipo];
          return (
            <li
              key={`${item.tipo}-${item.cobroId}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                estilo.fila,
              )}
            >
              <span
                className={cn("shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold", estilo.tag)}
              >
                {etiqueta(item)}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{item.clienteNombre}</span>
              {/* Cómo pagó ese cliente en particular: sin esto, para saber de
                  dónde salía cada peso del desglose había que abrir la ficha. */}
              {item.metodo && (
                <span className="hidden shrink-0 text-[0.6rem] text-muted-foreground sm:inline">
                  {item.metodo}
                </span>
              )}
              <span className={cn("shrink-0 font-mono font-bold", estilo.monto)}>
                {fmtMoney(item.monto)}
              </span>
              {CON_WHATSAPP.includes(item.tipo) && (
                <WhatsappButton telefonos={item.telefonos}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded bg-[#25D366] transition-transform active:scale-90">
                    <MessageCircle className="size-3 text-white" />
                  </span>
                </WhatsappButton>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
