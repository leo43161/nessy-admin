"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLAN_STATUSES } from "@/lib/status";
import { fmtMoney, formatFecha, todayISO } from "@/lib/format";
import { FRECUENCIAS, fechasDeCuotas } from "@/services/planes.service";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { guardarPlan } from "@/store/slices/planes.slice";
import { fetchClientes } from "@/store/slices/clientes.slice";
import type { FrecuenciaCuota, PlanListado, PlanStatus } from "@/types";

interface FormState {
  idCliente: string;
  nombre: string;
  montoTotal: string;
  status: PlanStatus;
  cantidadCuotas: string;
  primeraFecha: string;
  frecuencia: FrecuenciaCuota;
}

const vacio = (): FormState => ({
  idCliente: "",
  nombre: "",
  montoTotal: "",
  status: "Activo",
  cantidadCuotas: "8",
  primeraFecha: todayISO(),
  frecuencia: "Semanal",
});

/**
 * Alta y edición de financiación.
 *
 * En el alta se define además el plan de cuotas; en la edición no, porque
 * las cuotas ya existen y varias pueden estar cobradas. Cambiar el
 * cronograma de un plan en curso es otra operación (refinanciar), no esta.
 */
export function PlanFormDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: PlanListado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <PlanForm key={plan?.id ?? "nuevo"} plan={plan} onCerrar={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function inicial(plan: PlanListado | null): FormState {
  if (!plan) return vacio();
  return {
    ...vacio(),
    idCliente: plan.clienteId.toString(),
    nombre: plan.nombre,
    montoTotal: plan.montoTotal.toString(),
    status: plan.status,
  };
}

function PlanForm({ plan, onCerrar }: { plan: PlanListado | null; onCerrar: () => void }) {
  const dispatch = useAppDispatch();
  const clientes = useAppSelector((s) => s.clientes.items);
  const clientesStatus = useAppSelector((s) => s.clientes.status);
  const [form, setForm] = useState<FormState>(() => inicial(plan));
  const [guardando, setGuardando] = useState(false);

  const esAlta = plan === null;

  // El selector de cliente necesita la cartera cargada
  useEffect(() => {
    if (clientesStatus === "idle") {
      dispatch(fetchClientes({ cobradorId: null, localidadId: null }));
    }
  }, [clientesStatus, dispatch]);

  const set = <K extends keyof FormState>(campo: K, valor: FormState[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const monto = Number(form.montoTotal) || 0;
  const cantidad = Number(form.cantidadCuotas) || 0;

  // Previsualización: cuánto y hasta cuándo, antes de confirmar
  const preview = useMemo(() => {
    if (!esAlta || cantidad <= 0 || monto <= 0) return null;
    const fechas = fechasDeCuotas(form.primeraFecha, cantidad, form.frecuencia);
    return { porCuota: Math.round(monto / cantidad), ultima: fechas[fechas.length - 1] };
  }, [esAlta, cantidad, monto, form.primeraFecha, form.frecuencia]);

  const completo =
    form.idCliente !== "" && form.nombre.trim() !== "" && monto > 0 && (!esAlta || cantidad > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completo || guardando) return;
    setGuardando(true);
    const res = await dispatch(
      guardarPlan({
        id: plan?.id,
        idCliente: Number(form.idCliente),
        nombre: form.nombre.trim(),
        montoTotal: monto,
        status: form.status,
        cuotas: esAlta
          ? {
              cantidad,
              primeraFecha: form.primeraFecha,
              frecuencia: form.frecuencia,
            }
          : undefined,
      }),
    );
    setGuardando(false);
    if (guardarPlan.fulfilled.match(res)) {
      toast.success(esAlta ? "Financiación creada" : "Financiación actualizada");
      onCerrar();
    } else {
      toast.error(res.payload ?? "No se pudo guardar.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{esAlta ? "Nueva financiación" : "Editar financiación"}</DialogTitle>
        <DialogDescription>
          {esAlta
            ? "El alta genera las cuotas del plan, todas en estado Pendiente."
            : "Las cuotas ya generadas no se modifican desde acá."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="cliente">Cliente *</Label>
          <Select
            value={form.idCliente}
            onValueChange={(v) => set("idCliente", v)}
            disabled={!esAlta}
          >
            <SelectTrigger id="cliente" className="w-full">
              <SelectValue placeholder="Elegir cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.nombreCompleto} · {c.dni}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!esAlta && (
            <p className="text-xs text-muted-foreground">
              La financiación no se puede pasar a otro cliente.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nombre-plan">Nombre *</Label>
          <Input
            id="nombre-plan"
            placeholder="Préstamo personal"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto total *</Label>
            <Input
              id="monto"
              inputMode="numeric"
              placeholder="200000"
              value={form.montoTotal}
              onChange={(e) => set("montoTotal", e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status-plan">Estado</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as PlanStatus)}>
              <SelectTrigger id="status-plan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {esAlta && (
          <fieldset className="space-y-3 rounded-xl border border-border p-3">
            <legend className="px-1 text-xs font-bold text-muted-foreground uppercase">
              Cuotas
            </legend>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cantidad">Cantidad *</Label>
                <Input
                  id="cantidad"
                  inputMode="numeric"
                  value={form.cantidadCuotas}
                  onChange={(e) => set("cantidadCuotas", e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="frecuencia">Frecuencia</Label>
                <Select
                  value={form.frecuencia}
                  onValueChange={(v) => set("frecuencia", v as FrecuenciaCuota)}
                >
                  <SelectTrigger id="frecuencia" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRECUENCIAS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="primera">Primera cuota</Label>
              <Input
                id="primera"
                type="date"
                value={form.primeraFecha}
                onChange={(e) => set("primeraFecha", e.target.value)}
              />
            </div>

            {preview && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                {cantidad} cuotas de{" "}
                <span className="font-mono font-bold">{fmtMoney(preview.porCuota)}</span>, la última
                el <span className="font-bold">{formatFecha(preview.ultima)}</span>.
              </p>
            )}
          </fieldset>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!completo || guardando}>
            {guardando && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
