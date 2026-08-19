"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Lock, Trash2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtMoney, formatFecha } from "@/lib/format";
import { sumarDias } from "@/lib/cuotas";
import {
  getCuotasDelPlan,
  reprogramarCuotas,
  type CuotaDelPlan,
} from "@/services/planes.service";
import type { PlanListado } from "@/types";

/**
 * Editar el cronograma de un plan en curso.
 *
 * Es para el caso chico: correr una fecha, ajustar un monto, agregar o sacar
 * una cuota. Para rehacer el plan entero están refinanciar y reestructurar.
 *
 * **Solo se tocan las cuotas pendientes.** Las pagadas son historia, y las
 * atrasadas conservan su fecha original porque de ahí sale el cálculo de la
 * mora: moverlas borraría el rastro del atraso. Se muestran igual, con candado,
 * para que se vea el cronograma completo y no parezca que faltan.
 *
 * ⚠️ Guardar **reemplaza todas las pendientes de una vez**. Por eso la lista se
 * edita entera y no cuota por cuota: mandar solo lo que cambió daría de baja
 * todo lo demás.
 */
export function CuotasDialog({
  plan,
  open,
  onOpenChange,
  onHecho,
}: {
  plan: PlanListado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHecho?: () => void;
}) {
  const [original, setOriginal] = useState<CuotaDelPlan[]>([]);
  const [filas, setFilas] = useState<{ fecha: string; monto: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open || !plan) return;
    let activo = true;

    setCargando(true);
    getCuotasDelPlan(plan.id)
      .then((cuotas) => {
        if (!activo) return;
        setOriginal(cuotas);
        setFilas(
          cuotas
            .filter((c) => c.editable)
            .map((c) => ({ fecha: c.fecha.slice(0, 10), monto: String(c.monto) })),
        );
      })
      .catch(() => activo && toast.error("No se pudieron leer las cuotas del plan."))
      .finally(() => activo && setCargando(false));

    return () => {
      activo = false;
    };
  }, [open, plan]);

  if (!plan) return null;

  const intocables = original.filter((c) => !c.editable);
  const pendienteOriginal = original
    .filter((c) => c.editable)
    .reduce((a, c) => a + c.monto, 0);

  const nuevoTotal = filas.reduce((a, f) => a + (Number(f.monto) || 0), 0);
  const diferencia = Math.round((nuevoTotal - pendienteOriginal) * 100) / 100;

  const filaInvalida = filas.some((f) => f.fecha === "" || (Number(f.monto) || 0) <= 0);
  const puedeGuardar = !cargando && !guardando && filas.length > 0 && !filaInvalida;

  const cambiar = (i: number, campo: "fecha" | "monto", valor: string) =>
    setFilas((f) => f.map((fila, j) => (j === i ? { ...fila, [campo]: valor } : fila)));

  const quitar = (i: number) => setFilas((f) => f.filter((_, j) => j !== i));

  /** La cuota nueva sale a una semana de la última, que es el caso normal. */
  const agregar = () => {
    const ultima = filas[filas.length - 1];
    setFilas((f) => [
      ...f,
      {
        fecha: ultima ? sumarDias(ultima.fecha, 7) : new Date().toISOString().slice(0, 10),
        monto: ultima ? ultima.monto : "",
      },
    ]);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await reprogramarCuotas(
        plan.id,
        filas.map((f) => ({ fecha: f.fecha, monto: Number(f.monto) })),
      );
      toast.success(`Cronograma actualizado: ${filas.length} cuotas por ${fmtMoney(nuevoTotal)}.`);
      onHecho?.();
      onOpenChange(false);
    } catch (e) {
      const msg =
        typeof e === "object" && e !== null && "response" in e
          ? ((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? null)
          : null;
      toast.error(msg ?? "No se pudo guardar el cronograma.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guardando ? undefined : onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg max-sm:h-dvh max-sm:max-h-none max-sm:max-w-full max-sm:rounded-none">
        <DialogHeader>
          <DialogTitle>Editar el cronograma</DialogTitle>
          <DialogDescription>
            {plan.clienteNombre} · {plan.nombre}
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <>
            {/* Lo que no se toca. Va arriba para que se entienda por qué la
                lista de abajo no arranca en la primera cuota del plan. */}
            {intocables.length > 0 && (
              <div className="rounded-xl border-[1.5px] border-border bg-card p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  <Lock className="size-3.5" />
                  {intocables.length} {intocables.length === 1 ? "cuota que no se toca" : "cuotas que no se tocan"}
                </div>
                <ul className="flex flex-col gap-0.5 text-sm">
                  {intocables.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{formatFecha(c.fecha)}</span>
                      <span className="font-mono tabular-nums">{fmtMoney(c.monto)}</span>
                      <span className="w-20 shrink-0 text-right text-xs font-semibold">
                        {c.estado}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Las pagadas son historia. Las atrasadas conservan su fecha original: de ahí sale
                  el cálculo de la mora.
                </p>
              </div>
            )}

            {/* Las editables */}
            <div className="flex flex-col gap-2">
              {filas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este plan no tiene cuotas pendientes. Agregá una para armar el cronograma.
                </p>
              ) : (
                filas.map((fila, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      {i === 0 && (
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Vencimiento
                        </label>
                      )}
                      <Input
                        type="date"
                        aria-label={`Vencimiento de la cuota ${i + 1}`}
                        value={fila.fecha}
                        onChange={(e) => cambiar(i, "fecha", e.target.value)}
                        disabled={guardando}
                      />
                    </div>
                    <div className="w-32">
                      {i === 0 && (
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Monto
                        </label>
                      )}
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        aria-label={`Monto de la cuota ${i + 1}`}
                        value={fila.monto}
                        onChange={(e) => cambiar(i, "monto", e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        disabled={guardando}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar la cuota ${i + 1}`}
                      onClick={() => quitar(i)}
                      disabled={guardando}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                ))
              )}

              <Button variant="outline" onClick={agregar} disabled={guardando}>
                <CalendarPlus />
                Agregar una cuota
              </Button>
            </div>

            {/* El control que importa: que la suma no se mueva sin querer. */}
            <div
              className={cn(
                "rounded-xl border-[1.5px] p-3",
                diferencia === 0
                  ? "border-border bg-card"
                  : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
              )}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Pendiente hoy</span>
                <span className="font-mono tabular-nums">{fmtMoney(pendienteOriginal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span>Con este cronograma</span>
                <span className="font-mono tabular-nums">{fmtMoney(nuevoTotal)}</span>
              </div>

              {diferencia !== 0 && (
                <div className="mt-2 flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    La deuda cambia en <strong>{fmtMoney(Math.abs(diferencia))}</strong>{" "}
                    {diferencia > 0 ? "de más" : "de menos"}. Reacomodar las cuotas no debería
                    mover el total: si querés cambiar cuánto debe, usá refinanciar.
                  </span>
                </div>
              )}
            </div>

            {filaInvalida && (
              <p className="text-sm font-semibold text-destructive">
                Hay cuotas sin fecha o con monto en cero. Una cuota en cero queda pendiente para
                siempre porque ningún cobro la puede saldar.
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!puedeGuardar}>
            {guardando && <Loader2 className="animate-spin" />}
            {guardando ? "Guardando…" : `Guardar ${filas.length} cuotas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
