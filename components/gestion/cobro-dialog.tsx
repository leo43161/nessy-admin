"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NotasCliente } from "@/components/gestion/notas-cliente";
import { useMetodosDePago } from "@/hooks/use-catalogos";
import { registrarCobro } from "@/services/cobros.service";
import { fmtMoney, formatFecha } from "@/lib/format";

export interface CuotaACobrar {
  cuotaId: number;
  fecha: string;
  monto: number;
  planNombre: string;
  clienteId: number;
}

interface CobroDialogProps {
  cuota: CuotaACobrar | null;
  clienteNombre: string;
  /** A nombre de quién entra la plata. Sin esto la API rechaza el cobro. */
  cobradorId: number | null;
  cobradorNombre: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCobrado: () => void;
}

/**
 * Registrar un cobro desde el panel.
 *
 * El tipo de cobro no se elige acá: lo deduce la API del monto. Lo que sí es
 * propio del admin es que el cobro se registra **a nombre del cobrador
 * asignado** al cliente, no de quien está usando el panel.
 */
export function CobroDialog({
  cuota,
  clienteNombre,
  cobradorId,
  cobradorNombre,
  open,
  onOpenChange,
  onCobrado,
}: CobroDialogProps) {
  const metodos = useMetodosDePago();
  const [registrando, setRegistrando] = useState(false);
  const [montoEditado, setMontoEditado] = useState<string | null>(null);
  const [metodoElegido, setMetodoElegido] = useState<number | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState("");

  if (!cuota) return null;

  const monto = montoEditado ?? String(cuota.monto);
  const idMetodo = metodoElegido ?? metodos[0]?.id ?? 0;
  const montoNum = Number(monto) || 0;

  // Mismo criterio que la API, que compara redondeando a centavos.
  const esperado = Math.round(cuota.monto * 100);
  const entra = Math.round(montoNum * 100);
  const tipo = entra === esperado ? "ideal" : entra < esperado ? "parcial" : "adelantado";

  const puedeCobrar =
    !registrando &&
    montoNum > 0 &&
    idMetodo > 0 &&
    cobradorId != null &&
    (tipo !== "parcial" || nuevaFecha !== "");

  const cerrar = (abierto: boolean) => {
    if (!abierto) {
      setMontoEditado(null);
      setMetodoElegido(null);
      setNuevaFecha("");
    }
    onOpenChange(abierto);
  };

  const cobrar = async () => {
    if (cobradorId == null) return;
    setRegistrando(true);
    try {
      const res = await registrarCobro({
        cuotaId: cuota.cuotaId,
        monto: montoNum,
        idMetodoDePago: idMetodo,
        cobradorId,
        nuevaFecha: tipo === "parcial" ? nuevaFecha : undefined,
      });
      toast.success(`${clienteNombre}: ${fmtMoney(montoNum)} cobrados`, {
        description: res.sinUbicacion ? "Sin ubicación: queda fuera de rango." : undefined,
      });
      onCobrado();
      cerrar(false);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No se pudo registrar el cobro.";
      toast.error(msg);
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
          <DialogDescription>
            {cuota.planNombre} · vence {formatFecha(cuota.fecha)} ·{" "}
            <span className="font-mono">{fmtMoney(cuota.monto)}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Las notas del cliente antes de registrar: son el contexto de por qué
            ese cobro entró como entró. */}
        <NotasCliente clienteId={cuota.clienteId} />

        {cobradorId == null ? (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
            Este cliente no tiene cobrador asignado. Asignale uno antes de registrar el cobro: la
            API necesita saber a nombre de quién entra la plata.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Se registra a nombre de <strong>{cobradorNombre}</strong>.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="monto-cobro">Monto cobrado</Label>
              <Input
                id="monto-cobro"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={monto}
                onChange={(e) => setMontoEditado(e.target.value)}
                // Un input number con foco toma la rueda del mouse y cambia el
                // importe solo mientras se scrollea el diálogo.
                onWheel={(e) => e.currentTarget.blur()}
                disabled={registrando}
              />
              <p className="text-xs text-muted-foreground">
                {tipo === "ideal" && "Cobro exacto: cierra la cuota."}
                {tipo === "parcial" && "Entra menos: se crea una cuota nueva por la diferencia."}
                {tipo === "adelantado" &&
                  `Entra de más: el sobrante de ${fmtMoney(montoNum - cuota.monto)} cancela cuotas futuras.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="metodo-cobro">Método de pago</Label>
              <select
                id="metodo-cobro"
                value={idMetodo}
                onChange={(e) => setMetodoElegido(Number(e.target.value))}
                disabled={registrando || metodos.length === 0}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50"
              >
                {metodos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>

            {tipo === "parcial" && montoNum > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="nueva-fecha-cobro">
                  ¿Cuándo paga los {fmtMoney(cuota.monto - montoNum)} restantes?
                </Label>
                <Input
                  id="nueva-fecha-cobro"
                  type="date"
                  value={nuevaFecha}
                  min={cuota.fecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  disabled={registrando}
                />
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button disabled={!puedeCobrar} onClick={cobrar}>
            {registrando ? <Loader2 className="animate-spin" /> : <ReceiptText />}
            Cobrar {fmtMoney(montoNum)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
