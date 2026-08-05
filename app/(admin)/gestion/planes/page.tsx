"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { PlanFormDialog } from "@/components/gestion/plan-form-dialog";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/format";
import { PLAN_STATUS_BADGE } from "@/lib/status";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { eliminarPlan, fetchPlanes } from "@/store/slices/planes.slice";
import type { PlanListado } from "@/types";

export default function GestionPlanesPage() {
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((s) => s.planes);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<PlanListado | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState<PlanListado | null>(null);

  useEffect(() => {
    if (status === "idle") dispatch(fetchPlanes());
  }, [status, dispatch]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) => p.clienteNombre.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q),
    );
  }, [items, busqueda]);

  function abrirAlta() {
    setEditando(null);
    setFormAbierto(true);
  }

  async function confirmarBaja() {
    if (!aEliminar) return;
    const res = await dispatch(eliminarPlan(aEliminar.id));
    setAEliminar(null);
    if (eliminarPlan.fulfilled.match(res)) toast.success("Financiación dada de baja");
    else toast.error(res.payload ?? "No se pudo dar de baja.");
  }

  const cargando = status === "idle" || status === "loading";

  return (
    <>
      <SectionHeader titulo="Financiaciones" subtitulo={`${items.length} planes cargados`}>
        <Button size="sm" onClick={abrirAlta}>
          <Plus />
          Nueva
        </Button>
      </SectionHeader>

      <div className="relative px-4 pb-3">
        <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente o plan"
          aria-label="Buscar financiación"
          className="pl-9"
        />
      </div>

      <div className="space-y-2 px-4">
        {cargando ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-22 rounded-xl" />)
        ) : status === "failed" ? (
          <EmptyState icon="⚠️">{error}</EmptyState>
        ) : filtrados.length === 0 ? (
          <EmptyState icon="🧾">
            {busqueda ? "Ninguna financiación coincide." : "Todavía no hay financiaciones."}
          </EmptyState>
        ) : (
          filtrados.map((plan) => {
            const avance =
              plan.cuotasTotales > 0
                ? Math.round((plan.cuotasCobradas / plan.cuotasTotales) * 100)
                : 0;
            return (
              <article
                key={plan.id}
                className="rounded-xl border-[1.5px] border-border bg-card p-3 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-bold">
                        {plan.clienteNombre}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-px text-[0.6rem] font-bold",
                          PLAN_STATUS_BADGE[plan.status],
                        )}
                      >
                        {plan.status}
                      </span>
                    </div>
                    <div className="truncate text-[0.72rem] text-muted-foreground">
                      {plan.nombre} · cobra {plan.cobradorNombre ?? "sin asignar"}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar financiación de ${plan.clienteNombre}`}
                      onClick={() => {
                        setEditando(plan);
                        setFormAbierto(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Dar de baja la financiación de ${plan.clienteNombre}`}
                      onClick={() => setAEliminar(plan)}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[0.72rem]">
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {fmtMoney(plan.pagado)}
                  </span>
                  <span className="text-muted-foreground">de {fmtMoney(plan.montoTotal)}</span>
                </div>
                <div
                  role="meter"
                  aria-valuenow={avance}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Avance de la financiación de ${plan.clienteNombre}`}
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-sky"
                    style={{ width: `${avance}%` }}
                  />
                </div>
                <div className="mt-1 text-[0.65rem] text-muted-foreground">
                  {plan.cuotasCobradas}/{plan.cuotasTotales} cuotas cobradas
                </div>
              </article>
            );
          })
        )}
      </div>

      <PlanFormDialog plan={editando} open={formAbierto} onOpenChange={setFormAbierto} />

      <AlertDialog open={aEliminar !== null} onOpenChange={(o) => !o && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja esta financiación?</AlertDialogTitle>
            <AlertDialogDescription>
              {aEliminar?.nombre} de {aEliminar?.clienteNombre}. Se dan de baja también sus cuotas
              pendientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarBaja}>Dar de baja</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
