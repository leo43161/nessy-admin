"use client";

import { useEffect, useState } from "react";
import {
  AlertOctagon,
  Banknote,
  CalendarClock,
  HandCoins,
  Snowflake,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/analisis/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { fmtMoney, fmtPct, formatDayLabel } from "@/lib/format";
import { colorCobrador } from "@/lib/constants";
import {
  getEstadisticasHistoricas,
  type EstadisticasHistoricas,
} from "@/services/estadisticas.service";
import type { RangoFechas } from "@/types";

/**
 * Las estadísticas históricas del período, calculadas por la base.
 *
 * Salen de `sp_EstadisticasHistoricas`, que devuelve once bloques de un solo
 * CALL. Ninguno se puede calcular acá: cruzan todas las tablas, y el panel
 * solo tiene las cuotas del rango que pidió.
 *
 * A diferencia del resto de esta pantalla —que mira el histórico completo—,
 * esto **sí usa el filtro de fecha de la topbar**. Hasta ahora ese filtro se
 * mostraba en Análisis y no hacía nada.
 */
export function Historico({ rango }: { rango: RangoFechas | null }) {
  const [datos, setDatos] = useState<EstadisticasHistoricas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [falló, setFalló] = useState(false);

  useEffect(() => {
    if (!rango) return;
    let activo = true;

    setCargando(true);
    setFalló(false);

    getEstadisticasHistoricas(rango)
      .then((d) => activo && setDatos(d))
      .catch(() => activo && setFalló(true))
      .finally(() => activo && setCargando(false));

    return () => {
      activo = false;
    };
  }, [rango]);

  if (cargando) {
    return (
      <div className="mb-3 space-y-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  if (falló || !datos) {
    return (
      <StatCard titulo="Estadísticas del período">
        <EmptyState icon="⚠️">No se pudieron cargar las estadísticas del período.</EmptyState>
      </StatCard>
    );
  }

  const etiqueta =
    rango && rango.desde === rango.hasta
      ? formatDayLabel(rango.desde)
      : `${formatDayLabel(datos.desde)} → ${formatDayLabel(datos.hasta)}`;

  return (
    <>
      <StatCard titulo={`Dinero del período · ${etiqueta}`}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra
            icono={<HandCoins />}
            label="Recaudado"
            valor={fmtMoney(datos.recaudado)}
            detalle="Todo lo que entró, por cualquier método"
          />
          <Cifra
            icono={<TrendingUp />}
            label="Cumplimiento"
            valor={fmtPct(datos.cumplimiento)}
            detalle={`Se esperaban ${fmtMoney(datos.esperado)}`}
            tono={datos.cumplimiento >= 80 ? "ok" : datos.cumplimiento >= 50 ? "aviso" : "alarma"}
          />
          <Cifra
            icono={<Banknote />}
            label="Capital financiado"
            valor={fmtMoney(datos.capitalFinanciado)}
            detalle={`${datos.planesNuevos} ${datos.planesNuevos === 1 ? "plan nuevo" : "planes nuevos"}`}
          />
          <Cifra
            icono={<UserPlus />}
            label="Clientes nuevos"
            valor={String(datos.clientesNuevos)}
            detalle="Altas registradas en el período"
          />
        </div>
      </StatCard>

      <StatCard titulo="Por dónde entró la plata">
        <PorMetodo datos={datos} />
      </StatCard>

      <StatCard titulo="Plata trabada">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Cifra
            icono={<Snowflake />}
            label="Capital estancado"
            valor={fmtMoney(datos.capitalEstancado)}
            detalle={`${datos.cuotasAtrasadas} cuotas que se atrasaron en el período`}
            tono={datos.capitalEstancado > 0 ? "aviso" : undefined}
          />
          <Cifra
            icono={<AlertOctagon />}
            label="Deuda crítica"
            valor={fmtMoney(datos.deudaCritica)}
            detalle={`${datos.cuotasCriticas} cuotas atrasadas hace más de 30 días`}
            tono={datos.deudaCritica > 0 ? "alarma" : undefined}
          />
          <Cifra
            icono={<CalendarClock />}
            label="Proyectado"
            valor={fmtMoney(datos.proyeccionProximoMes)}
            detalle={`${datos.cuotasProximoMes} cuotas por vencer · próximos 30 días desde hoy`}
            /* Este número NO respeta el filtro: el SP siempre mira desde hoy.
               Lo dice el detalle, porque si no parece parte del período. */
          />
        </div>
      </StatCard>

      <StatCard titulo="Clientes con más atrasos en el período">
        {datos.clientesMorosos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún cliente acumuló atrasos en este período.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {datos.clientesMorosos.map((c, i) => (
              <li key={c.clienteId} className="flex items-center gap-2.5 text-sm">
                <span className="w-5 shrink-0 text-right font-mono text-xs font-bold text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{c.nombre}</span>
                <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive tabular-nums">
                  {c.atrasos} {c.atrasos === 1 ? "atraso" : "atrasos"}
                </span>
                <span className="w-28 shrink-0 text-right font-mono text-sm font-bold tabular-nums">
                  {fmtMoney(c.deuda)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </StatCard>

      <StatCard titulo="Recaudación por cobrador">
        {datos.rankingRecaudacion.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cobros registrados en el período.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {datos.rankingRecaudacion.map((c, i) => {
              const tope = datos.rankingRecaudacion[0].total || 1;
              return (
                <li key={c.cobradorId} className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-semibold">{c.nombre}</span>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                      {fmtMoney(c.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, (c.total / tope) * 100)}%`,
                        background: colorCobrador(i),
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </StatCard>

      <StatCard titulo="Morosidad por cobrador">
        {datos.morosidadCobradores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin cuotas asignadas en el período.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {datos.morosidadCobradores.map((c) => (
              <li key={c.cobradorId} className="flex items-center gap-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{c.nombre}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {c.cuotasAtrasadas} de {c.cuotasAsignadas} cuotas
                </span>
                <span
                  className={cn(
                    "w-16 shrink-0 text-right font-mono text-sm font-bold tabular-nums",
                    c.porcentajeMorosidad <= 10
                      ? "text-green-600 dark:text-green-400"
                      : c.porcentajeMorosidad <= 30
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                  )}
                >
                  {fmtPct(c.porcentajeMorosidad)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </StatCard>
    </>
  );
}

/**
 * El desglose por método de pago.
 *
 * El bloque con un renglón por método lo agrega `sql/fix_metodos_de_pago.sql`.
 * Mientras ese script no esté aplicado, la base solo sabe separar efectivo de
 * transferencia, así que se muestra eso y se avisa qué falta — mostrar dos
 * columnas como si fueran el total es justamente el problema que el script
 * viene a arreglar.
 */
function PorMetodo({ datos }: { datos: EstadisticasHistoricas }) {
  if (datos.recaudado === 0) {
    return <p className="text-sm text-muted-foreground">Sin cobros en el período.</p>;
  }

  if (datos.metodos.length === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Cifra label="Efectivo" valor={fmtMoney(datos.efectivo)} detalle="" />
          <Cifra label="Transferencia" valor={fmtMoney(datos.transferencia)} detalle="" />
          <Cifra label="Otros métodos" valor={fmtMoney(datos.otrosMetodos)} detalle="" />
        </div>
        <p className="text-xs text-muted-foreground">
          El detalle por método —Mercado Pago, tarjetas, cheque— aparece acá cuando se aplique{" "}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.9em]">
            sql/fix_metodos_de_pago.sql
          </code>{" "}
          en la base.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {datos.metodos.map((m, i) => (
        <li key={m.metodoId} className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold">{m.metodo}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {m.cantidad} {m.cantidad === 1 ? "cobro" : "cobros"}
            </span>
            <span className="w-28 shrink-0 text-right font-mono text-sm font-bold tabular-nums">
              {fmtMoney(m.total)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (m.total / datos.recaudado) * 100)}%`,
                background: colorCobrador(i),
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Una cifra con su etiqueta. El tono es semántico, no decorativo. */
function Cifra({
  icono,
  label,
  valor,
  detalle,
  tono,
}: {
  icono?: React.ReactNode;
  label: string;
  valor: string;
  detalle: string;
  tono?: "ok" | "aviso" | "alarma";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-[1.5px] p-3",
        tono === "alarma"
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : tono === "aviso"
            ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
            : tono === "ok"
              ? "border-accent bg-accent/40"
              : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase [&_svg]:size-4">
        {icono}
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-bold tabular-nums">{valor}</div>
      {detalle !== "" && <div className="text-xs text-muted-foreground">{detalle}</div>}
    </div>
  );
}
