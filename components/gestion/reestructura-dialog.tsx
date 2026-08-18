"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtMoney, todayISO } from "@/lib/format";
import { calcularPrevia } from "@/lib/reestructura";
import {
  getDeudaPendiente,
  refinanciarPlan,
  renovarPlan,
  reestructurarCuotas,
  type CorteDeDeuda,
} from "@/services/planes.service";
import type { PlanListado } from "@/types";

/**
 * Los tres escenarios que reescriben el cronograma de un plan.
 *
 *   refinanciar    rescate: la deuda vieja + penalización, cuotas nuevas
 *   renovar        más plata acoplada al final, sin tocar lo agendado
 *   reestructurar  la misma deuda repartida en cuotas de otro tamaño
 *
 * Van en un solo diálogo porque comparten casi todo el formulario —monto por
 * cuota, frecuencia y la nota del admin— y porque los tres terminan en la
 * misma pregunta: cuánto va a deber el cliente y en cuántas cuotas. Tres
 * diálogos separados serían tres copias del mismo cálculo.
 *
 * **Todos dan de baja las cuotas que el cliente no pagó y las reemplazan.**
 * Las pagadas nunca se tocan. Por eso el diálogo muestra el antes y el después
 * antes de dejar confirmar: es la única oportunidad de darse cuenta de que el
 * monto por cuota estaba mal tipeado.
 */
export type Escenario = "refinanciar" | "renovar" | "reestructurar";

interface Copy {
  titulo: string;
  descripcion: string;
  /** Qué le pasa al cronograma. Se muestra siempre, en el aviso. */
  efecto: string;
  boton: string;
}

const COPY: Record<Escenario, Copy> = {
  refinanciar: {
    titulo: "Refinanciar el plan",
    descripcion:
      "Para un cliente que dejó de pagar. Se toma lo que debe, se le aplica una penalización y se arma un cronograma nuevo con cuotas más bajas.",
    efecto:
      "Las cuotas pendientes y atrasadas se dan de baja y se reemplazan por las nuevas. Las ya pagadas quedan como están.",
    boton: "Refinanciar",
  },
  renovar: {
    titulo: "Renovar: prestarle más plata",
    descripcion:
      "Para un cliente que viene bien y está por terminar. Las cuotas nuevas se acoplan después de la última, sin tocar lo que ya está agendado.",
    efecto: "No se da de baja ninguna cuota: las nuevas se agregan al final del cronograma.",
    boton: "Renovar",
  },
  reestructurar: {
    titulo: "Reestructurar las cuotas",
    descripcion:
      "La deuda no cambia: se reparte en cuotas de otro tamaño para que el cliente termine antes. Es lo que se hace cuando le terminó otro préstamo y le sobra plata por semana.",
    efecto:
      "Las cuotas pendientes y atrasadas se dan de baja y se reemplazan por las nuevas, por el mismo total.",
    boton: "Reestructurar",
  },
};

export function ReestructuraDialog({
  plan,
  escenario,
  open,
  onOpenChange,
  onHecho,
}: {
  plan: PlanListado | null;
  escenario: Escenario;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama cuando la operación salió bien, para refrescar el listado */
  onHecho?: () => void;
}) {
  const copy = COPY[escenario];

  const [deuda, setDeuda] = useState<CorteDeDeuda | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [interes, setInteres] = useState("");
  const [capitalNuevo, setCapitalNuevo] = useState("");
  const [interesNuevo, setInteresNuevo] = useState("");
  const [montoCuota, setMontoCuota] = useState("");
  const [frecuencia, setFrecuencia] = useState("7");
  const [fechaInicio, setFechaInicio] = useState(todayISO());
  const [mensaje, setMensaje] = useState("");

  // La deuda se lee de la API en vez de estimarla con `montoTotal − pagado`:
  // es el mismo conjunto de cuotas que el SP va a dar de baja, y de ahí sale
  // todo lo que se muestra abajo.
  useEffect(() => {
    if (!open || !plan) return;
    let activo = true;

    setCargando(true);
    setDeuda(null);
    setInteres("");
    setCapitalNuevo("");
    setInteresNuevo("");
    setMontoCuota("");
    setFrecuencia("7");
    setFechaInicio(todayISO());
    setMensaje("");

    getDeudaPendiente(plan.id)
      .then((d) => activo && setDeuda(d))
      .catch(() => activo && toast.error("No se pudo leer la deuda del plan."))
      .finally(() => activo && setCargando(false));

    return () => {
      activo = false;
    };
  }, [open, plan]);

  if (!plan) return null;

  const num = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const pct = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  const deudaVieja = deuda?.deuda ?? 0;
  const cuota = num(montoCuota);
  const dias = num(frecuencia);
  const capital = num(capitalNuevo);

  // El reparto lo calcula `lib/reestructura.ts`, que replica el de los tres SP
  // y tiene su chequeo (`npm run check`). Acá no se hace ninguna cuenta: si la
  // previa y el SP se separan, el admin confirma un cronograma que no es el
  // que va a quedar.
  const previa = calcularPrevia({
    escenario,
    deudaVieja,
    interes: pct(interes),
    capitalNuevo: capital,
    interesNuevo: pct(interesNuevo),
    montoCuota: cuota,
    frecuenciaDias: dias,
  });

  const faltaAlgo =
    cuota <= 0 ||
    dias < 1 ||
    (escenario === "refinanciar" && (interes === "" || fechaInicio === "")) ||
    (escenario === "renovar" && (capital <= 0 || interes === ""));

  // Un plan sin nada impago no se puede refinanciar ni reestructurar: no hay
  // cuotas que reemplazar. Renovar sí, porque agrega al final.
  const sinDeuda = deuda !== null && deudaVieja <= 0 && escenario !== "renovar";

  const puedeConfirmar =
    !cargando && !guardando && !faltaAlgo && !sinDeuda && previa.totalAGenerar > 0;

  const confirmar = async () => {
    setGuardando(true);
    try {
      const base = {
        planId: plan.id,
        montoCuota: cuota,
        frecuenciaDias: dias,
        mensaje: mensaje.trim() || undefined,
      };

      const res =
        escenario === "refinanciar"
          ? await refinanciarPlan({
              ...base,
              interes: pct(interes),
              capitalNuevo: capital,
              interesNuevo: pct(interesNuevo),
              fechaInicio,
            })
          : escenario === "renovar"
            ? await renovarPlan({ ...base, capitalNuevo: capital, interes: pct(interes) })
            : await reestructurarCuotas(base);

      toast.success(
        `${copy.boton} listo: ${res.despues.cuotas} cuotas por ${fmtMoney(res.despues.deuda)}.`,
      );
      onHecho?.();
      onOpenChange(false);
    } catch (e) {
      const msg =
        typeof e === "object" && e !== null && "response" in e
          ? ((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? null)
          : null;
      toast.error(msg ?? `No se pudo ${copy.boton.toLowerCase()} el plan.`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guardando ? undefined : onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg max-sm:h-dvh max-sm:max-h-none max-sm:max-w-full max-sm:rounded-none">
        <DialogHeader>
          <DialogTitle>{copy.titulo}</DialogTitle>
          <DialogDescription>
            {plan.clienteNombre} · {plan.nombre}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{copy.descripcion}</p>

        {cargando ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : sinDeuda ? (
          <Aviso tono="alarma">
            Este plan no tiene cuotas pendientes ni atrasadas, así que no hay nada que{" "}
            {escenario === "refinanciar" ? "refinanciar" : "reacomodar"}. Si le vas a prestar más
            plata, usá <strong>Renovar</strong>.
          </Aviso>
        ) : (
          <>
            <div className="rounded-xl border-[1.5px] border-border bg-card p-3">
              <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Debe hoy
              </div>
              <div className="font-mono text-xl font-bold tabular-nums">
                {fmtMoney(deudaVieja)}
              </div>
              <div className="text-xs text-muted-foreground">
                {deuda?.cuotas ?? 0} {deuda?.cuotas === 1 ? "cuota impaga" : "cuotas impagas"}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {escenario === "refinanciar" && (
                <>
                  <Campo
                    id="interes"
                    label="Interés de refinanciación (%)"
                    ayuda="La penalización sobre lo que ya debía"
                    valor={interes}
                    onChange={setInteres}
                    placeholder="80"
                  />
                  <Campo
                    id="capital-nuevo"
                    label="Plata nueva (opcional)"
                    ayuda="Dejalo vacío si no le prestás más"
                    valor={capitalNuevo}
                    onChange={setCapitalNuevo}
                    placeholder="0"
                  />
                  {capital > 0 && (
                    <Campo
                      id="interes-nuevo"
                      label="Interés de la plata nueva (%)"
                      valor={interesNuevo}
                      onChange={setInteresNuevo}
                      placeholder="50"
                    />
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fecha-inicio">Primera cuota nueva</Label>
                    <Input
                      id="fecha-inicio"
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      disabled={guardando}
                    />
                  </div>
                </>
              )}

              {escenario === "renovar" && (
                <>
                  <Campo
                    id="capital-nuevo"
                    label="Plata nueva"
                    ayuda="Cuánto se le presta ahora"
                    valor={capitalNuevo}
                    onChange={setCapitalNuevo}
                    placeholder="50000"
                  />
                  <Campo
                    id="interes"
                    label="Interés (%)"
                    valor={interes}
                    onChange={setInteres}
                    placeholder="100"
                  />
                </>
              )}

              <Campo
                id="monto-cuota"
                label="Monto de cada cuota nueva"
                ayuda="El monto decide cuántas cuotas salen"
                valor={montoCuota}
                onChange={setMontoCuota}
                placeholder="15000"
              />

              <Campo
                id="frecuencia"
                label="Cada cuántos días vence una cuota"
                ayuda="7 es semanal, 15 quincenal, 30 mensual"
                valor={frecuencia}
                onChange={setFrecuencia}
                placeholder="7"
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mensaje">Nota para el historial (opcional)</Label>
                <Textarea
                  id="mensaje"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Acordamos esto porque se quedó sin trabajo"
                  maxLength={120}
                  disabled={guardando}
                  className="min-h-16"
                />
                <p className="text-xs text-muted-foreground">
                  Queda en el estado de cuenta del cliente, al final del mensaje que arma la base.
                  {mensaje.length > 0 && ` ${mensaje.length}/120`}
                </p>
              </div>
            </div>

            {/* La vista previa: es lo único que separa un monto mal tipeado de
                un cronograma reescrito. */}
            <div className="rounded-xl border-[1.5px] border-primary bg-secondary p-3">
              <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Cómo queda
              </div>

              {faltaAlgo ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Completá los campos para ver el resultado.
                </p>
              ) : (
                <>
                  <div className="mt-1 flex items-center gap-2 font-mono text-lg font-bold tabular-nums">
                    <span className="text-muted-foreground">{fmtMoney(deudaVieja)}</span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    <span>{fmtMoney(previa.deudaFinal)}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    <strong className="tabular-nums">{previa.cantidadCuotas}</strong>{" "}
                    {previa.cantidadCuotas === 1 ? "cuota" : "cuotas"} de{" "}
                    <strong className="tabular-nums">{fmtMoney(cuota)}</strong>, cada {dias}{" "}
                    {dias === 1 ? "día" : "días"} · {previa.diasTotales} días en total
                  </p>
                  {escenario === "renovar" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Se agregan al final del cronograma actual.
                    </p>
                  )}
                  {/* El reparto no siempre da exacto: los SP generan las cuotas
                      enteras y una última por el resto, más chica. */}
                  {!previa.exacto && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      La última sale por {fmtMoney(previa.ultimaCuota)}: la división no da exacta.
                    </p>
                  )}
                </>
              )}
            </div>

            <Aviso tono="aviso">{copy.efecto}</Aviso>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!puedeConfirmar}>
            {guardando && <Loader2 className="animate-spin" />}
            {guardando ? "Guardando…" : copy.boton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Un campo numérico con su ayuda. Todos los de acá son montos o porcentajes. */
function Campo({
  id,
  label,
  ayuda,
  valor,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  ayuda?: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

function Aviso({ tono, children }: { tono: "aviso" | "alarma"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border-[1.5px] p-3 text-sm",
        tono === "alarma"
          ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
