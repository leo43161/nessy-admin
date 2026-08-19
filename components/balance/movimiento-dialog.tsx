"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { fmtMoney } from "@/lib/format";
import { registrarMovimiento, type TipoMovimiento } from "@/services/balance.service";

/**
 * Cargar plata que entra o sale de la caja por fuera de los cobros.
 *
 * Los tres tipos van al mismo lugar en la base y se distinguen por su tipo,
 * así que un solo diálogo alcanza. Lo que cambia es de qué bolsillo sale la
 * plata, y eso el admin **tiene que verlo antes de confirmar**: no es lo mismo
 * gastar de la ganancia que gastar del capital de trabajo.
 */
const COPY: Record<
  TipoMovimiento,
  { titulo: string; ayuda: string; fondo: string; suma: boolean; ejemplo: string }
> = {
  gasto: {
    titulo: "Nuevo gasto o retiro",
    ayuda: "Sueldos, retiros del dueño, cualquier gasto del negocio.",
    fondo: "Sale del fondo de ganancia",
    suma: false,
    ejemplo: "Sueldo semana 2 — cobrador Pedro",
  },
  inyeccion: {
    titulo: "Inyectar capital",
    ayuda: "Plata propia que se pone para poder prestar más.",
    fondo: "Entra entera al fondo de reinversión",
    suma: true,
    ejemplo: "Plata personal para fondear nuevos préstamos",
  },
  prestamo: {
    titulo: "Capital entregado a un cliente",
    ayuda: "La plata en mano, sin el interés.",
    fondo: "Sale del fondo de reinversión",
    suma: false,
    ejemplo: "Capital entregado — Plan #102 — Juan Pérez",
  },
};

export function MovimientoDialog({
  tipo,
  open,
  onOpenChange,
  onHecho,
}: {
  tipo: TipoMovimiento;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHecho?: () => void;
}) {
  const copy = COPY[tipo];

  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setConcepto("");
      setMonto("");
    }
  }, [open, tipo]);

  const montoNum = Number(monto) || 0;
  const puedeGuardar = !guardando && concepto.trim() !== "" && montoNum > 0;

  const confirmar = async () => {
    setGuardando(true);
    try {
      await registrarMovimiento(tipo, concepto.trim(), montoNum);
      toast.success(`${copy.titulo}: ${fmtMoney(montoNum)} registrados.`);
      onHecho?.();
      onOpenChange(false);
    } catch (e) {
      const msg =
        typeof e === "object" && e !== null && "response" in e
          ? ((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? null)
          : null;
      toast.error(msg ?? "No se pudo registrar el movimiento.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guardando ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md max-sm:h-dvh max-sm:max-h-none max-sm:max-w-full max-sm:rounded-none">
        <DialogHeader>
          <DialogTitle>{copy.titulo}</DialogTitle>
          <DialogDescription>{copy.ayuda}</DialogDescription>
        </DialogHeader>

        {/* De qué bolsillo sale. Va arriba y no al pie: es lo que decide si el
            movimiento es correcto, y hay que leerlo antes de tipear. */}
        <div
          className={
            copy.suma
              ? "rounded-xl border-[1.5px] border-accent bg-accent/40 p-3 text-sm font-semibold text-accent-foreground"
              : "rounded-xl border-[1.5px] border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          }
        >
          {copy.suma ? "↑ " : "↓ "}
          {copy.fondo}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mov-concepto">Concepto</Label>
            <Input
              id="mov-concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={copy.ejemplo}
              maxLength={250}
              disabled={guardando}
            />
            <p className="text-xs text-muted-foreground">
              Es lo que se va a leer en el libro diario dentro de seis meses. Escribí algo que se
              entienda solo.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mov-monto">Monto</Label>
            <Input
              id="mov-monto"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="15000"
              disabled={guardando}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!puedeGuardar}>
            {guardando && <Loader2 className="animate-spin" />}
            {guardando ? "Guardando…" : montoNum > 0 ? `Registrar ${fmtMoney(montoNum)}` : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
