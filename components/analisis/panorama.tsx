"use client";

import { useEffect, useState } from "react";
import { Ghost, Landmark, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtMoney, fmtPct, todayISO } from "@/lib/format";
import { rangoDePeriodo } from "@/lib/periodos";
import {
  getEstadisticasEnVivo,
  getRanking,
  type EstadisticasEnVivo,
  type FilaRanking,
} from "@/services/estadisticas.service";

/**
 * Panorama del negocio, calculado por la base.
 *
 * Lo que hay acá **no se puede calcular en el frontend**: los clientes
 * fantasma y la deuda en la calle salen de cruzar todas las tablas, y el panel
 * solo tiene las cuotas del período que pidió. Por eso sale de
 * `/estadisticas`, que llama a los SP.
 *
 * El ranking viene con la efectividad ya calculada por la base — la misma
 * fórmula que se imprime en el PDF del cliente, así que los dos números
 * significan lo mismo.
 */
export function Panorama() {
  const [vivo, setVivo] = useState<EstadisticasEnVivo | null>(null);
  const [ranking, setRanking] = useState<FilaRanking[]>([]);
  const [cargando, setCargando] = useState(true);
  const [falló, setFalló] = useState(false);

  useEffect(() => {
    let activo = true;
    const mes = rangoDePeriodo("mes", todayISO());

    Promise.all([getEstadisticasEnVivo(), getRanking(mes)])
      .then(([v, r]) => {
        if (!activo) return;
        setVivo(v);
        setRanking(r);
      })
      .catch(() => activo && setFalló(true))
      .finally(() => activo && setCargando(false));

    return () => {
      activo = false;
    };
  }, []);

  if (falló) return null;

  if (cargando) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!vivo) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tarjeta
          icono={<Landmark className="size-4" />}
          label="Deuda en la calle"
          valor={fmtMoney(vivo.deudaEnLaCalle)}
          detalle="Todo lo pendiente y atrasado"
        />
        <Tarjeta
          icono={<Wallet className="size-4" />}
          label="Promedio por cliente"
          valor={fmtMoney(vivo.deudaPromedioPorCliente)}
          detalle={`${vivo.clientesConPlan} con plan en curso`}
        />
        <Tarjeta
          icono={<Ghost className="size-4" />}
          label="Clientes fantasma"
          valor={`${vivo.clientesFantasma} de ${vivo.clientesTotales}`}
          detalle={`${fmtPct(vivo.porcentajeFantasma)} sin ningún plan`}
          alerta={vivo.porcentajeFantasma >= 50}
        />
      </div>

      {ranking.length > 0 && (
        <div className="rounded-xl border-[1.5px] border-border bg-card p-3">
          <h3 className="mb-2 text-[0.7rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
            Efectividad del mes (según la base)
          </h3>
          <ul className="space-y-1.5">
            {ranking.map((r) => (
              <li key={r.cobradorId} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-semibold">{r.nombre}</span>
                <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                  {r.cuotasAsignadas} cuotas · {r.cuotasConAtraso} con atraso
                </span>
                <span
                  className={cn(
                    "w-14 shrink-0 text-right font-mono font-bold",
                    r.efectividad >= 80
                      ? "text-green-600 dark:text-green-400"
                      : r.efectividad >= 50
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                  )}
                >
                  {fmtPct(r.efectividad)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Tarjeta({
  icono,
  label,
  valor,
  detalle,
  alerta,
}: {
  icono: React.ReactNode;
  label: string;
  valor: string;
  detalle: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-[1.5px] p-3",
        alerta
          ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-1.5 text-[0.68rem] font-bold tracking-wider text-muted-foreground uppercase">
        {icono}
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold">{valor}</div>
      <div className="text-[0.68rem] text-muted-foreground">{detalle}</div>
    </div>
  );
}
