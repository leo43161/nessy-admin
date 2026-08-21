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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtMoney, todayISO } from "@/lib/format";
import { duracionEnPalabras } from "@/lib/cuotas";
import { calcularPrevia, totalAGenerar } from "@/lib/reestructura";
import {
  cuotasSegunSP,
  partirPorEstado,
  primeraFechaNueva,
  resolverPar,
  seDanDeBaja,
  TOPE_CUOTAS,
  sobreviven,
  PAR_VACIO,
  type ParCuota,
} from "@/lib/cronograma";
import {
  CamposCuota,
  CamposFrecuencia,
  PreviaCronograma,
  SelectorPlan,
  diasDeFrecuencia,
  frecuenciaEnPalabras,
} from "@/components/gestion/cronograma";
import { useAppSelector } from "@/store/hooks";
import {
  getCuotasDelPlan,
  getDeudaPendiente,
  refinanciarPlan,
  renovarPlan,
  reestructurarCuotas,
  type CorteDeDeuda,
  type CuotaDelPlan,
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

  // Todas las financiaciones del mismo cliente: un cliente puede tener varias
  // abiertas y desde el listado no siempre se entra por la que se quería.
  const todosLosPlanes = useAppSelector((s) => s.planes.items);
  const delCliente = plan
    ? todosLosPlanes.filter((p) => p.clienteId === plan.clienteId && p.status === "Activo")
    : [];

  /** Sobre cuál se aplica. Arranca en la que abrió el diálogo. */
  const [planId, setPlanId] = useState<number>(plan?.id ?? 0);
  const elegido = todosLosPlanes.find((p) => p.id === planId) ?? plan;

  // El diálogo se monta una vez y se reusa, así que al abrirlo sobre otra fila
  // hay que volver a apuntar al plan que la abrió o se quedaría en el anterior.
  //
  // Se ajusta durante el render y no en un `useEffect`: es el patrón que React
  // documenta para un estado que depende de una prop. Con el efecto, el
  // diálogo alcanzaba a pintar una vez con el plan viejo antes de corregirse.
  const [abiertoPara, setAbiertoPara] = useState<number>(plan?.id ?? 0);
  if (plan && plan.id !== abiertoPara) {
    setAbiertoPara(plan.id);
    setPlanId(plan.id);
  }

  const [deuda, setDeuda] = useState<CorteDeDeuda | null>(null);
  const [cuotas, setCuotas] = useState<CuotaDelPlan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [interes, setInteres] = useState("");
  const [capitalNuevo, setCapitalNuevo] = useState("");
  const [interesNuevo, setInteresNuevo] = useState("");
  const [par, setPar] = useState<ParCuota>(PAR_VACIO);
  /** Días entre cuota y cuota, o `OTRA` si se escriben a mano abajo */
  const [frecuencia, setFrecuencia] = useState("7");
  const [diasAMano, setDiasAMano] = useState("");
  const [fechaInicio, setFechaInicio] = useState(todayISO());
  const [mensaje, setMensaje] = useState("");

  // La deuda se lee de la API en vez de estimarla con `montoTotal − pagado`:
  // es el mismo conjunto de cuotas que el SP va a dar de baja, y de ahí sale
  // todo lo que se muestra abajo.
  //
  // Las cuotas se piden además de la deuda porque la previa las necesita una
  // por una: para dibujar el cronograma, y sobre todo para saber DÓNDE arranca
  // el nuevo — renovar cuelga de la última fecha agendada y reestructurar de la
  // impaga más vieja. Sin eso habría que inventar la primera fecha.
  useEffect(() => {
    if (!open || !planId) return;
    let activo = true;

    setCargando(true);
    setDeuda(null);
    setCuotas([]);
    setInteres("");
    setCapitalNuevo("");
    setInteresNuevo("");
    setPar(PAR_VACIO);
    setFrecuencia("7");
    setDiasAMano("");
    setFechaInicio(todayISO());
    setMensaje("");

    Promise.all([getDeudaPendiente(planId), getCuotasDelPlan(planId)])
      .then(([d, cs]) => {
        if (!activo) return;
        setDeuda(d);
        setCuotas(cs);
      })
      .catch(() => activo && toast.error("No se pudo leer la financiación."))
      .finally(() => activo && setCargando(false));

    return () => {
      activo = false;
    };
  }, [open, planId]);

  if (!plan || !elegido) return null;

  const num = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const pct = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  const deudaVieja = deuda?.deuda ?? 0;
  const dias = diasDeFrecuencia(frecuencia, diasAMano);
  const capital = num(capitalNuevo);

  const cadaCuanto = frecuenciaEnPalabras(dias);

  // Cuánta plata se va a repartir. Sale de `lib/reestructura.ts`, que replica
  // el cálculo de los tres SP: la deuda vieja con penalización, la plata nueva
  // con su interés, o la misma deuda sin tocar, según el escenario.
  const aRepartir = totalAGenerar({
    escenario,
    deudaVieja,
    interes: pct(interes),
    capitalNuevo: capital,
    interesNuevo: pct(interesNuevo),
    montoCuota: 0,
    frecuenciaDias: dias,
  });

  // Monto por cuota y cantidad son la misma información vista de dos lados: se
  // escribe cualquiera y el otro sale de acá. `true` porque estas tres pasan
  // por un SP, que hace FLOOR y agrega una última cuota por el resto.
  const { montoCuota: cuota, cantidad } = resolverPar(aRepartir, par, true);

  const previa = calcularPrevia({
    escenario,
    deudaVieja,
    interes: pct(interes),
    capitalNuevo: capital,
    interesNuevo: pct(interesNuevo),
    montoCuota: cuota,
    frecuenciaDias: dias,
  });

  // El cronograma que se va a escribir, cuota por cuota. La primera fecha la
  // decide el SP —refinanciar la recibe, renovar la cuelga del final del
  // cronograma y reestructurar de la impaga más vieja—, así que sale de
  // `lib/cronograma.ts` y no de acá.
  const corte = partirPorEstado(cuotas);
  const arranca = primeraFechaNueva(escenario, cuotas, dias, fechaInicio, todayISO());
  const nuevas = arranca === null ? [] : cuotasSegunSP(aRepartir, cuota, arranca, dias);

  // El monto se escribe dígito a dígito: camino a "700000" el campo pasa por
  // "7", y ahí la cuenta da cientos de miles de cuotas. No alcanza con no
  // dibujarlas —confirmar escribiría todas esas filas en la base—, así que
  // también se corta el botón.
  const demasiadas = cantidad > TOPE_CUOTAS;

  const faltaAlgo =
    cuota <= 0 ||
    dias < 1 ||
    (escenario === "refinanciar" && (interes === "" || fechaInicio === "")) ||
    (escenario === "renovar" && (capital <= 0 || interes === ""));

  // Un plan sin nada impago no se puede refinanciar ni reestructurar: no hay
  // cuotas que reemplazar. Renovar sí, porque agrega al final.
  const sinDeuda = deuda !== null && deudaVieja <= 0 && escenario !== "renovar";

  // Renovar acopla en MAX(fecha_acordada) + frecuencia. Sobre un plan sin
  // ninguna cuota esa fecha es NULL y el SP crearía cuotas sin vencimiento: la
  // API lo corta con un 409, así que acá se avisa antes de dejar confirmar.
  const sinDondeAcoplar =
    escenario === "renovar" && !cargando && cuotas.length === 0;

  const puedeConfirmar =
    !cargando &&
    !guardando &&
    !faltaAlgo &&
    !sinDeuda &&
    !sinDondeAcoplar &&
    !demasiadas &&
    previa.totalAGenerar > 0;

  const confirmar = async () => {
    setGuardando(true);
    try {
      const base = {
        // El del selector, no el de la fila que abrió el diálogo.
        planId: elegido.id,
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
          <DialogDescription>{elegido.clienteNombre}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{copy.descripcion}</p>

        {/* Sobre cuál se aplica. Con una sola financiación no se dibuja. */}
        <SelectorPlan
          planes={delCliente}
          valor={elegido.id}
          onElegir={setPlanId}
          deshabilitado={guardando}
        />

        {cargando ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : sinDondeAcoplar ? (
          <Aviso tono="alarma">
            Esta financiación no tiene ninguna cuota cargada, así que no hay final del cronograma
            donde acoplar la renovación. Cargale el cronograma primero, o usá{" "}
            <strong>Refinanciar</strong>, que arranca en la fecha que le indiques.
          </Aviso>
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

              {/* El acuerdo con el cliente se cierra de las dos maneras: "que
                  me quede en 20.000 por semana" y "que lo termine en 10
                  cuotas". Antes solo se podía escribir la primera. */}
              <CamposCuota
                par={par}
                onCambio={setPar}
                montoCuota={cuota}
                cantidad={cantidad}
                deshabilitado={guardando}
                ayuda={
                  aRepartir > 0
                    ? `Se reparten ${fmtMoney(aRepartir)}. Escribí cualquiera de los dos: el otro se calcula solo.`
                    : "Completá los montos de arriba para poder repartir."
                }
              />

              <CamposFrecuencia
                frecuencia={frecuencia}
                onFrecuencia={setFrecuencia}
                aMano={diasAMano}
                onAMano={setDiasAMano}
                deshabilitado={guardando}
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
                un cronograma reescrito. Va con las fechas a la vista porque un
                total no deja ver que la primera cuota cae en una fecha que ya
                pasó, ni que la última se va a tres años. */}
            {/* El aviso va ACÁ, en el lugar del cronograma, y no arriba
                reemplazando los campos: el admin tiene que poder corregir el
                monto que el aviso le está señalando. */}
            {demasiadas ? (
              <Aviso tono="aviso">
                Con cuotas de {fmtMoney(cuota)} serían{" "}
                <strong>{cantidad.toLocaleString("es-AR")} cuotas</strong>. Probá con un monto más
                alto, o escribí cuántas cuotas querés.
              </Aviso>
            ) : faltaAlgo ? (
              <div className="rounded-xl border-[1.5px] border-primary bg-secondary p-3">
                <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Cómo queda
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Completá los campos para ver el cronograma que va a quedar.
                </p>
              </div>
            ) : (
              <>
                <PreviaCronograma
                  operacion={escenario}
                  sobreviven={sobreviven(escenario, corte)}
                  seDanDeBaja={seDanDeBaja(escenario, corte)}
                  nuevas={nuevas}
                  totalAntes={deudaVieja}
                  totalDespues={previa.deudaFinal}
                />
                <p className="text-xs text-muted-foreground">
                  {previa.cantidadCuotas} {previa.cantidadCuotas === 1 ? "cuota" : "cuotas"} de{" "}
                  {fmtMoney(cuota)}, {cadaCuanto} ·{" "}
                  {duracionEnPalabras(previa.diasTotales)} en total.
                  {/* El reparto no siempre da exacto: los SP generan las cuotas
                      enteras y una última por el resto, más chica. */}
                  {!previa.exacto &&
                    ` La última sale por ${fmtMoney(previa.ultimaCuota)}: la división no da exacta.`}
                </p>
              </>
            )}
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
