import { cn } from "@/lib/utils";
import { fmtMoney, fmtPct } from "@/lib/format";
import type { BalancePeriodo } from "@/types";

/** Tarjeta degradada con los totales del período */
export function BalanceGlobal({ balance }: { balance: BalancePeriodo }) {
  const items = [
    { label: "Cobrado", valor: fmtMoney(balance.cobrado), color: "text-green-300" },
    { label: "Pendiente", valor: fmtMoney(balance.pendiente), color: "text-amber-200" },
    { label: "Déficit", valor: fmtMoney(balance.deficit), color: "text-red-300" },
    { label: "Efectividad", valor: fmtPct(balance.efectividad), color: "text-white" },
  ];

  return (
    <div className="relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-primary-dark via-primary to-sky p-5">
      {/* Círculos decorativos de la maqueta */}
      <div className="pointer-events-none absolute -top-8 -right-8 size-30 rounded-full bg-white/6" />
      <div className="pointer-events-none absolute -bottom-5 -left-5 size-20 rounded-full bg-white/4" />

      <div className="relative">
        <div className="text-[0.7rem] font-semibold tracking-[0.08em] text-white/65 uppercase">
          Total esperado del período
        </div>
        <div className="mt-1 mb-4 font-mono text-[1.65rem] leading-none font-bold text-white">
          {fmtMoney(balance.esperado)}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg bg-white/10 px-3 py-2.5">
              <div className="text-[0.63rem] font-semibold tracking-[0.06em] text-white/60 uppercase">
                {item.label}
              </div>
              <div className={cn("mt-1 font-mono text-[0.95rem] font-bold", item.color)}>
                {item.valor}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
