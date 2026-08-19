"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  HandCoins,
  Landmark,
  Percent,
  PiggyBank,
  Plus,
  RefreshCw,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/analisis/stat-card";
import { AccionesFab } from "@/components/shared/acciones-fab";
import { DistribucionDialog } from "@/components/balance/distribucion-dialog";
import { MovimientoDialog } from "@/components/balance/movimiento-dialog";
import { cn } from "@/lib/utils";
import { fmtMoney, formatDayLabel, formatFecha } from "@/lib/format";
import { useAppSelector } from "@/store/hooks";
import { useAccionesDePeriodo } from "@/hooks/use-acciones-periodo";
import { getBalance, type Balance, type TipoMovimiento } from "@/services/balance.service";

/**
 * El balance financiero: los dos bolsillos.
 *
 * Cada peso cobrado se parte en dos —reinversión y ganancia— y de cada bolsillo
 * sale plata distinta. Esta pantalla contesta las tres preguntas que el sistema
 * no podía: cuánto hay para prestar, cuánto se puede retirar, y a dónde se fue
 * cada peso.
 *
 * ⚠️ **Las tarjetas de arriba NO respetan el filtro de fecha.** Son el saldo
 * real de hoy, con toda la historia adentro; solo el libro de abajo filtra. Es
 * a propósito —una caja no tiene período— pero está rotulado en las dos partes,
 * porque si no alguien suma la tabla, no le da, y cree que está roto.
 */
export default function BalancePage() {
  const rango = useAppSelector((s) => s.ui.rango);
  const router = useRouter();
  const accionesDePeriodo = useAccionesDePeriodo();

  const [datos, setDatos] = useState<Balance | null>(null);
  const [cargando, setCargando] = useState(true);
  const [falló, setFalló] = useState(false);

  const [distribucionAbierta, setDistribucionAbierta] = useState(false);
  const [movimiento, setMovimiento] = useState<TipoMovimiento>("gasto");
  const [movimientoAbierto, setMovimientoAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!rango) return;
    setCargando(true);
    setFalló(false);
    try {
      setDatos(await getBalance(rango));
    } catch {
      setFalló(true);
    } finally {
      setCargando(false);
    }
  }, [rango]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const abrirMovimiento = (tipo: TipoMovimiento) => {
    setMovimiento(tipo);
    setMovimientoAbierto(true);
  };

  const config = datos?.configuracion ?? null;

  return (
    <>
      <SectionHeader
        titulo="Balance financiero"
        subtitulo="Las cajas son de hoy; el libro, del período"
      >
        <Button size="sm" variant="outline" onClick={() => setDistribucionAbierta(true)}>
          <Percent />
          {config ? `${config.reinversion}/${config.ganancia}` : "Configurar"}
        </Button>
      </SectionHeader>

      <div className="px-4">
        {cargando ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : falló || !datos ? (
          <EmptyState icon="⚠️">
            No se pudo cargar el balance.
            <br />
            Si nunca se configuraron los porcentajes, cargalos primero con el botón de arriba.
          </EmptyState>
        ) : (
          <>
            {/* ── Las cajas: saldo real de hoy ── */}
            <StatCard titulo="Saldo real · acumulado histórico">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <Caja
                  icono={<Landmark />}
                  label="Recaudado total"
                  valor={datos.cajas.recaudadoHistorico}
                  detalle="Todo lo cobrado desde siempre"
                />
                <Caja
                  icono={<PiggyBank />}
                  label="Disponible para prestar"
                  valor={datos.cajas.disponibleParaPrestar}
                  detalle={
                    config
                      ? `${config.reinversion}% de lo cobrado, menos lo ya prestado`
                      : "Fondo de reinversión"
                  }
                  avisoEnRojo="Prestaste más de lo que entró. Hace falta inyectar capital."
                />
                <Caja
                  icono={<Wallet />}
                  label="Disponible para retirar"
                  valor={datos.cajas.disponibleParaGanancia}
                  detalle={
                    config
                      ? `${config.ganancia}% de lo cobrado, menos sueldos y retiros`
                      : "Fondo de ganancia"
                  }
                  avisoEnRojo="Sacaste más de lo que te corresponde. Le estás comiendo el capital al negocio."
                />
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Estos tres números <strong>no cambian</strong> con el filtro de fecha: son la plata
                que hay hoy en la caja. El filtro solo mueve el libro de abajo.
              </p>
            </StatCard>

            {/* ── Movimientos manuales ── */}
            <StatCard titulo="Cargar un movimiento">
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => abrirMovimiento("gasto")}>
                  <TrendingDown />
                  Gasto o retiro
                </Button>
                <Button variant="secondary" onClick={() => abrirMovimiento("inyeccion")}>
                  <Plus />
                  Inyectar capital
                </Button>
                <Button variant="secondary" onClick={() => abrirMovimiento("prestamo")}>
                  <HandCoins />
                  Capital entregado
                </Button>
              </div>
              <p className="mt-2.5 text-xs text-muted-foreground">
                &laquo;Capital entregado&raquo; es la plata en mano de un préstamo, sin el interés.
                Normalmente se carga sola al crear el plan; este botón es para corregir o para
                cargar los préstamos viejos.
              </p>
            </StatCard>

            {/* ── El libro diario ── */}
            <StatCard
              titulo={`Movimientos del período · ${formatDayLabel(datos.desde)} → ${formatDayLabel(datos.hasta)}`}
            >
              {datos.libro.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin movimientos en este período. Probá con otro rango desde el filtro de arriba.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-2xl text-sm">
                    <thead>
                      <tr className="border-b-[1.5px] border-border text-left text-xs font-bold tracking-wider text-muted-foreground uppercase">
                        <th className="py-2 pr-3">Fecha</th>
                        <th className="py-2 pr-3">Categoría</th>
                        <th className="py-2 pr-3">Fondo</th>
                        <th className="py-2 pr-3">Detalle</th>
                        <th className="py-2 pr-3 text-right">Ingreso</th>
                        <th className="py-2 text-right">Egreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.libro.map((a, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                            {formatFecha(a.fecha)}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap font-semibold">
                            {a.categoria.replace(/_/g, " ")}
                          </td>
                          <td className="py-2 pr-3 text-xs whitespace-nowrap text-muted-foreground">
                            {a.fondo}
                          </td>
                          <td className="max-w-72 truncate py-2 pr-3">{a.detalle}</td>
                          <td className="py-2 pr-3 text-right font-mono font-semibold tabular-nums text-green-600 dark:text-green-400">
                            {a.ingreso > 0 ? fmtMoney(a.ingreso) : ""}
                          </td>
                          <td className="py-2 text-right font-mono font-semibold tabular-nums text-red-600 dark:text-red-400">
                            {a.egreso > 0 ? fmtMoney(a.egreso) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </StatCard>
          </>
        )}
      </div>

      <AccionesFab
        acciones={[
          {
            label: "Cargar un gasto o retiro",
            descripcion: "Sale del fondo de ganancia",
            icon: <TrendingDown />,
            onSelect: () => abrirMovimiento("gasto"),
          },
          {
            label: "Inyectar capital propio",
            descripcion: "Entra entero al fondo de reinversión",
            icon: <Plus />,
            onSelect: () => abrirMovimiento("inyeccion"),
          },
          {
            label: "Cambiar cómo se reparte",
            descripcion: config
              ? `Hoy: ${config.reinversion}% reinversión / ${config.ganancia}% ganancia`
              : "Todavía no está configurado",
            icon: <Percent />,
            onSelect: () => setDistribucionAbierta(true),
            separar: true,
          },
          {
            label: "Actualizar el balance",
            descripcion: "Vuelve a traer las cajas y el libro",
            icon: <RefreshCw />,
            onSelect: () => void cargar(),
            disabled: cargando,
          },
          {
            label: "Ir al cierre de caja",
            descripcion: "El detalle del día por cobrador",
            icon: <Banknote />,
            onSelect: () => router.push("/cierre"),
            separar: true,
          },
          ...accionesDePeriodo.map((accion, i) => ({ ...accion, separar: i === 0 })),
        ]}
      />

      <DistribucionDialog
        actual={config}
        open={distribucionAbierta}
        onOpenChange={setDistribucionAbierta}
        onHecho={cargar}
      />

      <MovimientoDialog
        tipo={movimiento}
        open={movimientoAbierto}
        onOpenChange={setMovimientoAbierto}
        onHecho={cargar}
      />
    </>
  );
}

/**
 * Una de las tres cajas.
 *
 * En rojo no alcanza con pintar el número: el admin tiene que saber qué
 * significa y qué hacer, así que el aviso va escrito abajo.
 */
function Caja({
  icono,
  label,
  valor,
  detalle,
  avisoEnRojo,
}: {
  icono: React.ReactNode;
  label: string;
  valor: number;
  detalle: string;
  avisoEnRojo?: string;
}) {
  const enRojo = valor < 0;

  return (
    <div
      className={cn(
        "rounded-xl border-[1.5px] p-3",
        enRojo
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase [&_svg]:size-4">
        {icono}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-xl font-bold tabular-nums",
          enRojo && "text-red-600 dark:text-red-400",
        )}
      >
        {fmtMoney(valor)}
      </div>
      <div className="text-xs text-muted-foreground">{detalle}</div>
      {enRojo && avisoEnRojo && (
        <div className="mt-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
          {avisoEnRojo}
        </div>
      )}
    </div>
  );
}
