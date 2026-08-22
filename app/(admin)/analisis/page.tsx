"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, RefreshCw, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { AccionesFab } from "@/components/shared/acciones-fab";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/analisis/stat-card";
import { DistribucionEstados } from "@/components/analisis/distribucion-estados";
import { PerformanceCobradores } from "@/components/analisis/performance-cobradores";
import { CobrosCruzados } from "@/components/analisis/cobros-cruzados";
import { Panorama } from "@/components/analisis/panorama";
import { Historico } from "@/components/analisis/historico";
import { cobrosCruzados, distribucionDeEstados, performancePorCobrador } from "@/lib/agregados";
import { todayISO } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchHistorico } from "@/store/slices/admin.slice";
import { useAccionesDePeriodo } from "@/hooks/use-acciones-periodo";

/**
 * Esta pantalla mezcla dos cortes a propósito, y cada bloque dice cuál es:
 *
 *   · `Panorama` — la foto de ahora. No tiene fechas: es el estado del negocio
 *     en este momento (deuda en la calle, clientes fantasma).
 *   · `Historico` — **el período del filtro de la topbar.** Es lo único acá
 *     que respeta ese filtro; hasta ahora se mostraba en Análisis sin hacer
 *     nada.
 *   · Distribución, tasa de éxito y cobros cruzados — el histórico COMPLETO,
 *     que es lo que hace comparable el rendimiento entre cobradores. Un
 *     cobrador nuevo con tres cuotas no se puede medir contra uno con
 *     seiscientas si se mira una sola semana.
 */
export default function AnalisisPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { items, status } = useAppSelector((s) => s.admin.historico);
  const cobradores = useAppSelector((s) => s.admin.cobradores.items);
  const rango = useAppSelector((s) => s.ui.rango);
  const accionesDePeriodo = useAccionesDePeriodo();
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
      <SectionHeader titulo="Rendimiento del equipo" subtitulo="El período arriba, el histórico completo abajo" />

      <div className="px-4">
        {/* Va arriba y con su propia carga: son los SP de la base, no dependen
            del histórico que trae esta pantalla. */}
        <div className="mb-3">
          <Panorama />
        </div>

        {/* Lo único de esta pantalla que usa el filtro de fecha de la topbar.
            El filtro se mostraba acá desde siempre y no hacía nada. */}
        <Historico rango={rango} />

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

      {/* El período sí va acá: mueve el bloque de estadísticas del período.
          Los otros tres bloques miran el histórico completo y no se enteran. */}
      <AccionesFab
        acciones={[
          {
            label: "Actualizar el histórico",
            descripcion: "Rehace los números con todo lo cobrado",
            icon: <RefreshCw />,
            onSelect: () => dispatch(fetchHistorico()),
            disabled: cargando,
          },
          {
            label: "Ir al tablero de operaciones",
            descripcion: "Las cuotas del período por cobrador",
            icon: <LayoutGrid />,
            onSelect: () => router.push("/operaciones"),
            separar: true,
          },
          {
            label: "Ir al cierre de caja",
            descripcion: "Cuánto trae cada cobrador",
            icon: <Wallet />,
            onSelect: () => router.push("/cierre"),
          },
          ...accionesDePeriodo.map((accion, i) => ({ ...accion, separar: i === 0 })),
        ]}
      />
    </>
  );
}
