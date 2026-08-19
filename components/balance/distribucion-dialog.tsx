"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";
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
import { guardarConfiguracion, type ConfiguracionFinanciera } from "@/services/balance.service";

/**
 * Los dos porcentajes que parten cada peso cobrado.
 *
 * **Tienen que sumar 100 exacto.** Si no, la diferencia no va a ningún bolsillo
 * y desaparece del balance. Se valida acá y también en la API — el stored
 * procedure guarda lo que le manden, así que esas dos son las únicas rejas.
 *
 * Cambiar los porcentajes **no reescribe el pasado**: la base guarda cada
 * configuración con su fecha y divide cada cobro con la que regía el día que
 * entró. Lo que se toca acá aplica de ahora en adelante.
 */
export function DistribucionDialog({
  actual,
  open,
  onOpenChange,
  onHecho,
}: {
  actual: ConfiguracionFinanciera | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHecho?: () => void;
}) {
  const [reinversion, setReinversion] = useState("");
  const [ganancia, setGanancia] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReinversion(actual ? String(actual.reinversion) : "80");
    setGanancia(actual ? String(actual.ganancia) : "20");
  }, [open, actual]);

  const r = Number(reinversion);
  const g = Number(ganancia);
  const valido = Number.isFinite(r) && Number.isFinite(g) && r >= 0 && g >= 0;

  // En centavos enteros: 79.99 + 20.01 en binario no da exactamente 100 y la
  // comparación directa fallaba con decimales legítimos.
  const suma = valido ? Math.round((r + g) * 100) / 100 : 0;
  const sumaCien = valido && Math.round((r + g) * 100) === 10000;

  /** Al tocar uno, el otro se completa solo para que siempre cierre en 100. */
  const cambiarReinversion = (v: string) => {
    setReinversion(v);
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= 100) {
      setGanancia(String(Math.round((100 - n) * 100) / 100));
    }
  };

  const cambiarGanancia = (v: string) => {
    setGanancia(v);
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= 100) {
      setReinversion(String(Math.round((100 - n) * 100) / 100));
    }
  };

  const confirmar = async () => {
    setGuardando(true);
    try {
      await guardarConfiguracion(r, g);
      toast.success(`Distribución guardada: ${r}% reinversión / ${g}% ganancia.`);
      onHecho?.();
      onOpenChange(false);
    } catch (e) {
      const msg =
        typeof e === "object" && e !== null && "response" in e
          ? ((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? null)
          : null;
      toast.error(msg ?? "No se pudo guardar la distribución.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guardando ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md max-sm:h-dvh max-sm:max-h-none max-sm:max-w-full max-sm:rounded-none">
        <DialogHeader>
          <DialogTitle>Cómo se reparte lo que se cobra</DialogTitle>
          <DialogDescription>
            De cada peso que entra, cuánto vuelve al negocio para prestar y cuánto queda como
            ganancia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pct-reinversion">% Reinversión</Label>
            <Input
              id="pct-reinversion"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              value={reinversion}
              onChange={(e) => cambiarReinversion(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={guardando}
            />
            <p className="text-xs text-muted-foreground">Para volver a prestar</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pct-ganancia">% Ganancia</Label>
            <Input
              id="pct-ganancia"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              value={ganancia}
              onChange={(e) => cambiarGanancia(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={guardando}
            />
            <p className="text-xs text-muted-foreground">Sueldos y retiros</p>
          </div>
        </div>

        {!sumaCien && (
          <div className="flex items-start gap-2 rounded-xl border-[1.5px] border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Los dos tienen que sumar <strong>100</strong>. Ahora suman{" "}
              <strong>{valido ? suma : "—"}</strong>: lo que falte no iría a ningún lado y
              desaparecería del balance.
            </span>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Esto aplica <strong>de ahora en adelante</strong>. Lo que ya se cobró se queda con el
          porcentaje que tenía el día que entró, así que la caja no se mueve para atrás.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando || !sumaCien}>
            {guardando && <Loader2 className="animate-spin" />}
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
