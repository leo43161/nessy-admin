"use client";

import { useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/analisis/stat-card";
import { DistribucionEstados } from "@/components/analisis/distribucion-estados";
import { PerformanceCobradores } from "@/components/analisis/performance-cobradores";
import { CobrosCruzados } from "@/components/analisis/cobros-cruzados";
import { Panorama } from "@/components/analisis/panorama";
import { cobrosCruzados, distribucionDeEstados, performancePorCobrador } from "@/lib/agregados";
import { todayISO } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchHistorico } from "@/store/slices/admin.slice";

/**
 * A diferencia de Operaciones y Cierre, este tab NO usa el filtro de fecha:
 * mira el histórico completo, que es lo que hace comparable el rendimiento
 * entre cobradores.
 */
export default function AnalisisPage() {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector((s) => s.admin.historico);
  const cobradores = useAppSelector((s) => s.admin.cobradores.items);
  const hoy = todayISO();

  useEffect(() => {
    if (status === "idle") dispatch(fetchHistorico());
  }, [status, dispatch]);

  const distribucion = useMemo(() => distribucionDeEstados(items, hoy), [items, hoy]);
  const performance = useMemo(
    () => performancePorCobrador(items, cobradores, hoy),
    [items, cobradores, hoy],
  );
  const cruzados = useMemo(() => cobrosCruzados(items), [items]);

  const cargando = status === "idle" || status === "loading";

  return (
    <>
      <SectionHeader titulo="Rendimiento del equipo" subtitulo="Histórico completo" />

      <div className="px-4">
        {/* Va arriba y con su propia carga: son los SP de la base, no dependen
            del histórico que trae esta pantalla. */}
        <div className="mb-3">
          <Panorama />
        </div>

        {cargando ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : status === "failed" ? (
          <EmptyState icon="⚠️">No se pudo cargar el histórico.</EmptyState>
        ) : (
          <>
            <StatCard titulo="Distribución global de estados">
              <DistribucionEstados datos={distribucion} />
            </StatCard>

            <StatCard titulo="Tasa de éxito por cobrador">
              <PerformanceCobradores filas={performance} />
            </StatCard>

            <StatCard titulo="Cobros cruzados (apoyo)">
              <CobrosCruzados filas={cruzados} />
            </StatCard>
          </>
        )}
      </div>
    </>
  );
}
