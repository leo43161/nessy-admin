import { cn } from "@/lib/utils";
import { fmtMoney, fmtPct } from "@/lib/format";
import type { BalancePeriodo } from "@/types";

/**
 * Tarjeta degradada con los totales del período.
 *
 * Usa los tokens `marca-*`, que son los colores crudos de la marca y **no se
 * dan vuelta con el tema**. Antes usaba los semánticos (`primary`,
 * `primary-dark`, `acento`) y en modo oscuro los tres se aclaran: el degradé
 * quedaba casi blanco y el texto, que acá es blanco fijo, desaparecía —1,6:1
 * de contraste—. En claro tampoco cerraba del todo: el extremo esmeralda daba
 * 3,7:1, por debajo del mínimo.
 *
 * La regla es la del login: una superficie que trae el color del texto puesto
 * necesita colores constantes, no tokens que cambian debajo.
 */
export function BalanceGlobal({ balance }: { balance: BalancePeriodo }) {
  const items = [
    { label: "Cobrado", valor: fmtMoney(balance.cobrado), color: "text-green-300" },
    { label: "Pendiente", valor: fmtMoney(balance.pendiente), color: "text-amber-200" },
    { label: "Déficit", valor: fmtMoney(balance.deficit), color: "text-red-300" },
    { label: "Efectividad", valor: fmtPct(balance.efectividad), color: "text-white" },
  ];

  return (
    <div className="relative mb-4 overflow-hidden rounded-3xl bg-linear-to-br from-marca-navy-hondo via-marca-navy to-marca-verde-hondo p-5">
      {/* Círculos decorativos de la maqueta */}
      <div className="pointer-events-none absolute -top-8 -right-8 size-30 rounded-full bg-white/6" />
      <div className="pointer-events-none absolute -bottom-5 -left-5 size-20 rounded-full bg-white/4" />

      <div className="relative">
        <div className="text-[0.7rem] font-semibold tracking-[0.08em] text-white/80 uppercase">
          Total esperado del período
        </div>
        <div className="mt-1 mb-4 font-mono text-[1.65rem] leading-none font-bold text-white">
          {fmtMoney(balance.esperado)}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg bg-white/15 px-3 py-2.5">
              <div className="text-[0.63rem] font-semibold tracking-[0.06em] text-white/80 uppercase">
                {item.label}
              </div>
              <div className={cn("mt-1 font-mono text-[0.95rem] font-bold", item.color)}>
                {item.valor}
              </div>
            </div>
          ))}
        </div>

        {/* Por dónde entró la plata del período.
            No es un detalle decorativo: es lo que separa la caja física de lo
            que ya está en una cuenta bancaria. Sin esto, el total de arriba
            mezclaba las dos cosas. */}
        {balance.porMetodo.length > 0 && (
          <div className="mt-3 rounded-lg bg-white/10 px-3 py-2.5">
            <div className="mb-1.5 text-[0.63rem] font-semibold tracking-[0.06em] text-white/80 uppercase">
              Cómo pagaron
            </div>
            <ul className="flex flex-col gap-1">
              {balance.porMetodo.map((m) => (
                <li
                  key={m.metodoId}
                  className="flex items-baseline gap-2 text-[0.78rem] text-white"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{m.metodo}</span>
                  <span className="shrink-0 text-[0.65rem] text-white/70 tabular-nums">
                    {m.cantidad} {m.cantidad === 1 ? "cobro" : "cobros"}
                  </span>
                  <span className="shrink-0 font-mono font-bold tabular-nums">
                    {fmtMoney(m.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
