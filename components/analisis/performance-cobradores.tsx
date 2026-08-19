import { fmtPct } from "@/lib/format";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import type { PerformanceCobrador } from "@/types";

/** Un punto de color + texto en el desglose bajo la barra */
function Punto({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-[0.67rem] font-medium text-text-secondary">
      <span className={`size-1.75 shrink-0 rounded-full ${color}`} />
      {children}
    </span>
  );
}

/** Barra de efectividad por cobrador, con el desglose de sus cuotas */
export function PerformanceCobradores({ filas }: { filas: PerformanceCobrador[] }) {
  return (
    <div className="space-y-4">
      {filas.map((fila) => (
        <div key={fila.cobradorId}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
              <InitialsAvatar nombre={fila.nombre} color={fila.color} size="xs" />
              <span className="truncate">{fila.nombre}</span>
            </div>
            <span className="shrink-0 font-mono text-sm font-bold text-primary">
              {fmtPct(fila.efectividad)}
            </span>
          </div>

          <div
            role="meter"
            aria-valuenow={fila.efectividad}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Efectividad de ${fila.nombre}`}
            className="mb-1.5 h-2 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-acento transition-[width] duration-500"
              style={{ width: `${fila.efectividad}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Punto color="bg-green-500">{fila.cobradasPropias} propio</Punto>
            {fila.cobradasConApoyo > 0 && (
              <Punto color="bg-acento">{fila.cobradasConApoyo} con apoyo</Punto>
            )}
            {fila.fallidas > 0 && <Punto color="bg-red-500">{fila.fallidas} fallido</Punto>}
            {fila.pendientes > 0 && <Punto color="bg-amber-500">{fila.pendientes} pendiente</Punto>}
            <span className="ml-auto text-[0.67rem] font-bold text-text-secondary">
              {fila.total} total
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
