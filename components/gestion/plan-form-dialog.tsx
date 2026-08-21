"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
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
import { ClienteFormDialog } from "@/components/gestion/cliente-form-dialog";
import { ReferentesEditor } from "@/components/gestion/referentes-editor";
import { NotasCliente } from "@/components/gestion/notas-cliente";
import { PLAN_STATUSES } from "@/lib/status";
import { fmtMoney, formatFecha, todayISO } from "@/lib/format";
import {
  calcularResumen,
  cuotasNecesarias,
  duracionEnPalabras,
  montoPorCuota,
  totalConInteres,
  type Periodo,
} from "@/lib/cuotas";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { guardarPlan } from "@/store/slices/planes.slice";
import { fetchClientes } from "@/store/slices/clientes.slice";
import type { PlanListado, PlanStatus } from "@/types";

/** "Fechas" no es un período: es cargarlas a mano, una por una */
type ModoPeriodo = Periodo | "Fechas";

const PERIODOS: { valor: ModoPeriodo; label: string }[] = [
  { valor: "Mensual", label: "Mensual — una vez al mes" },
  { valor: "Quincenal", label: "Quincenal — cada 15 días" },
  { valor: "Semanal", label: "Semanal — cada N semanas" },
  { valor: "Diaria", label: "Diaria — cada N días" },
  { valor: "Manual", label: "Personalizado — cada N días" },
  { valor: "Fechas", label: "Fechas elegidas a mano" },
];

interface FormState {
  idCliente: string;
  nombre: string;
  /** Capital, sin interés */
  montoTotal: string;
  interes: string;
  status: PlanStatus;
  periodo: ModoPeriodo;
  cada: string;
  primeraFecha: string;
  cantidadCuotas: string;
  montoCuota: string;
  fechasManuales: string[];
  /**
   * Cuál de los dos campos tocó último.
   *
   * Monto por cuota y cantidad de cuotas son la misma información vista de dos
   * lados: si los dos fueran editables a la vez se pisarían. El último tocado
   * manda y el otro se calcula.
   */
  manda: "monto" | "cantidad";
}

const vacio = (): FormState => ({
  idCliente: "",
  nombre: "",
  montoTotal: "",
  interes: "0",
  status: "Activo",
  periodo: "Mensual",
  cada: "1",
  primeraFecha: todayISO(),
  cantidadCuotas: "8",
  montoCuota: "",
  fechasManuales: [],
  manda: "cantidad",
});

/**
 * Alta y edición de financiación.
 *
 * En el alta se arma además el cronograma; en la edición no, porque las cuotas
 * ya existen y varias pueden estar cobradas. Cambiar el cronograma de un plan
 * en curso es otra operación (refinanciar), no esta.
 */
export function PlanFormDialog({
  plan,
  open,
  onOpenChange,
  /** Cliente prefijado: cuando se crea el plan desde la ficha de uno */
  clienteFijo,
}: {
  plan: PlanListado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteFijo?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg max-sm:h-dvh max-sm:max-h-none max-sm:max-w-full max-sm:rounded-none">
        <PlanForm
          key={plan?.id ?? "nuevo"}
          plan={plan}
          clienteFijo={clienteFijo}
          onCerrar={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function inicial(plan: PlanListado | null, clienteFijo?: number): FormState {
  const base = vacio();
  if (clienteFijo) base.idCliente = String(clienteFijo);
  if (!plan) return base;

  return {
    ...base,
    idCliente: plan.clienteId.toString(),
    nombre: plan.nombre,
    // Al editar, `Monto_total` ya viene con el interés aplicado: no hay columna
    // de capital ni de tasa donde separarlos.
    montoTotal: plan.montoTotal.toString(),
    interes: "0",
    status: plan.status,
  };
}

function PlanForm({
  plan,
  clienteFijo,
  onCerrar,
}: {
  plan: PlanListado | null;
  clienteFijo?: number;
  onCerrar: () => void;
}) {
  const dispatch = useAppDispatch();
  const clientes = useAppSelector((s) => s.clientes.items);
  const clientesStatus = useAppSelector((s) => s.clientes.status);
  const [form, setForm] = useState<FormState>(() => inicial(plan, clienteFijo));
  const [guardando, setGuardando] = useState(false);
  const [altaClienteAbierta, setAltaClienteAbierta] = useState(false);
  const [referentesDe, setReferentesDe] = useState<number | null>(null);

  const esAlta = plan === null;

  useEffect(() => {
    if (clientesStatus === "idle") {
      dispatch(fetchClientes({ cobradorId: null, localidadId: null }));
    }
  }, [clientesStatus, dispatch]);

  const set = <K extends keyof FormState>(campo: K, valor: FormState[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const capital = Number(form.montoTotal) || 0;
  const interes = Number(form.interes) || 0;
  const total = totalConInteres(capital, interes);

  // El que no se tocó último se calcula del otro. Con fechas a mano no se
  // calcula ninguno: la cantidad es cuántas fechas cargaron.
  const usaFechas = form.periodo === "Fechas";
  const cantidad = usaFechas
    ? form.fechasManuales.length
    : form.manda === "monto"
      ? cuotasNecesarias(total, Number(form.montoCuota) || 0)
      : Number(form.cantidadCuotas) || 0;

  const resumen = calcularResumen(
    capital,
    interes,
    cantidad,
    {
      periodo: (usaFechas ? "Manual" : form.periodo) as Periodo,
      cada: Number(form.cada) || 1,
      primeraFecha: form.primeraFecha,
    },
    usaFechas ? form.fechasManuales : undefined,
  );

  const cuotaMostrada =
    form.manda === "monto" ? form.montoCuota : String(montoPorCuota(total, cantidad) || "");

  const completo =
    form.idCliente !== "" && form.nombre.trim() !== "" && total > 0 && (!esAlta || cantidad > 0);

  const cliente = clientes.find((c) => c.id === Number(form.idCliente));

  /** El cliente recién creado queda elegido, y se ofrece cargarle referentes */
  const alCrearCliente = async () => {
    const res = await dispatch(fetchClientes({ cobradorId: null, localidadId: null }));
    setAltaClienteAbierta(false);

    if (!fetchClientes.fulfilled.match(res)) return;
    // El alta no devuelve el id acá, pero el último de la lista releída es el
    // recién creado: los ids son crecientes.
    const nuevo = [...res.payload].sort((a, b) => b.id - a.id)[0];
    if (!nuevo) return;

    set("idCliente", String(nuevo.id));
    setReferentesDe(nuevo.id);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completo || guardando) return;
    setGuardando(true);

    const res = await dispatch(
      guardarPlan({
        id: plan?.id,
        idCliente: Number(form.idCliente),
        nombre: form.nombre.trim(),
        // Lo que se guarda es el total CON interés: es lo que el cliente debe.
        montoTotal: resumen.totalFinanciado,
        // Y aparte va el capital puro, que es lo que sale de la caja. El
        // interés no sale: es lo que se va a cobrar de más. Solo en el alta.
        capitalEntregado: esAlta ? capital : undefined,
        status: form.status,
        cuotas: esAlta ? resumen.cuotas : undefined,
      }),
    );
    setGuardando(false);

    if (guardarPlan.fulfilled.match(res)) {
      // Crear el plan y descontar el capital de la caja son dos operaciones
      // separadas. Si la segunda falló, el plan igual existe: lo que falta es
      // el movimiento, y sin él el balance muestra plata disponible que en
      // realidad ya se prestó. No se puede pasar por alto en silencio.
      if (res.payload.capitalRegistrado === false) {
        toast.warning("Financiación creada, pero no se pudo descontar el capital de la caja.", {
          description:
            "Cargalo a mano desde Balance → Capital entregado: " + fmtMoney(capital) + ".",
          duration: 12000,
        });
      } else {
        toast.success(esAlta ? "Financiación creada" : "Financiación actualizada");
      }
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
            ? "El alta crea el plan y su cronograma de cuotas."
            : "Las cuotas ya existen y no se tocan desde acá."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* ── Cliente ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="cliente">Cliente *</Label>
            {esAlta && !clienteFijo && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setAltaClienteAbierta(true)}
              >
                <UserPlus />
                Cliente nuevo
              </Button>
            )}
          </div>
          <BuscadorCliente
            clientes={clientes}
            valor={form.idCliente}
            onElegir={(id) => set("idCliente", id)}
            fijo={!esAlta || clienteFijo != null}
          />
          {cliente && esAlta && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setReferentesDe(cliente.id)}
            >
              <Users />
              Referentes de {cliente.nombreCompleto.split(" ")[0]}
            </Button>
          )}
        </div>

        {/* Con un cliente elegido, sus notas: explican por qué el plan se está
            armando como se está armando. */}
        {cliente && <NotasCliente clienteId={cliente.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="nombre-plan">Nombre *</Label>
          <Input
            id="nombre-plan"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Moto Honda 150"
          />
        </div>

        {/* ── Plata ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="monto-total">Plata en mano *</Label>
            <Input
              id="monto-total"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.montoTotal}
              onChange={(e) => set("montoTotal", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
            />
            {/* El campo se llamaba "Total" y siempre fue el capital. Con el
                balance andando esa confusión cuesta plata: si acá se tipea el
                monto con interés, el fondo de reinversión se descuenta de más. */}
            <p className="text-xs text-muted-foreground">
              Lo que se le entrega al cliente, sin el interés
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interes">Interés %</Label>
            <Input
              id="interes"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.interes}
              onChange={(e) => set("interes", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={!esAlta}
            />
          </div>
        </div>

        {interes > 0 && capital > 0 && (
          <p className="text-xs text-muted-foreground">
            {fmtMoney(capital)} + {interes}% ={" "}
            <strong className="text-foreground">{fmtMoney(total)}</strong> a pagar.{" "}
            {/* No hay dónde guardar el capital ni la tasa: la tabla solo tiene
                Monto_total. Se avisa para que nadie lo busque después. */}
            <span className="italic">Se guarda el total; el desglose no queda registrado.</span>
          </p>
        )}

        {esAlta && (
          <>
            {/* ── Período ── */}
            <div className="space-y-1.5">
              <Label htmlFor="periodo">Período</Label>
              <select
                id="periodo"
                value={form.periodo}
                onChange={(e) => set("periodo", e.target.value as ModoPeriodo)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                {PERIODOS.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Semanal y diaria eligen cada cuántas; personalizado es libre.
                Semanal corta en 4: más que eso ya es mensual. */}
            {(form.periodo === "Semanal" ||
              form.periodo === "Diaria" ||
              form.periodo === "Manual") && (
              <div className="space-y-1.5">
                <Label htmlFor="cada">
                  {form.periodo === "Semanal" ? "Cada cuántas semanas" : "Cada cuántos días"}
                </Label>
                {form.periodo === "Manual" ? (
                  <Input
                    id="cada"
                    type="number"
                    min={1}
                    value={form.cada}
                    onChange={(e) => set("cada", e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                ) : (
                  <select
                    id="cada"
                    value={form.cada}
                    onChange={(e) => set("cada", e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                  >
                    {Array.from({ length: form.periodo === "Semanal" ? 4 : 7 }, (_, i) => i + 1).map(
                      (n) => (
                        <option key={n} value={n}>
                          {n === 1
                            ? form.periodo === "Semanal"
                              ? "Cada semana"
                              : "Todos los días"
                            : `Cada ${n} ${form.periodo === "Semanal" ? "semanas" : "días"}`}
                        </option>
                      ),
                    )}
                  </select>
                )}
              </div>
            )}

            {usaFechas ? (
              <FechasManuales
                fechas={form.fechasManuales}
                onChange={(f) => set("fechasManuales", f)}
              />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="primera-fecha">Primera cuota</Label>
                <Input
                  id="primera-fecha"
                  type="date"
                  value={form.primeraFecha}
                  onChange={(e) => set("primeraFecha", e.target.value)}
                />
              </div>
            )}

            {/* ── Monto por cuota ↔ cantidad ── */}
            {!usaFechas && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="monto-cuota">Monto por cuota</Label>
                  <Input
                    id="monto-cuota"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={cuotaMostrada}
                    onChange={(e) => setForm((f) => ({ ...f, montoCuota: e.target.value, manda: "monto" }))}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cantidad-cuotas">Cantidad de cuotas</Label>
                  <Input
                    id="cantidad-cuotas"
                    type="number"
                    min={1}
                    value={form.manda === "monto" ? cantidad || "" : form.cantidadCuotas}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cantidadCuotas: e.target.value, manda: "cantidad" }))
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              </div>
            )}

            {/* ── Resumen ── */}
            {cantidad > 0 && total > 0 && (
              <div className="space-y-1 rounded-lg bg-secondary p-3 text-xs">
                <Linea label="Total a pagar" valor={fmtMoney(resumen.totalFinanciado)} />
                <Linea
                  label="Cuotas"
                  valor={`${cantidad} de ${fmtMoney(resumen.cuotas[0]?.monto ?? 0)}`}
                />
                {/* La última difiere cuando la división no es exacta. */}
                {resumen.cuotas.length > 1 &&
                  resumen.cuotas[resumen.cuotas.length - 1].monto !== resumen.cuotas[0].monto && (
                    <Linea
                      label="Última cuota"
                      valor={fmtMoney(resumen.cuotas[resumen.cuotas.length - 1].monto)}
                    />
                  )}
                <Linea label="Termina el" valor={formatFecha(resumen.ultimaFecha)} />
                <Linea label="Duración" valor={duracionEnPalabras(resumen.duracionDias)} />
              </div>
            )}
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="status-plan">Estado</Label>
          <select
            id="status-plan"
            value={form.status}
            onChange={(e) => set("status", e.target.value as PlanStatus)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
          >
            {PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

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

      {/* Alta de cliente sin salir del alta del plan */}
      <ClienteFormDialog
        cliente={null}
        open={altaClienteAbierta}
        onOpenChange={(o) => {
          if (!o) alCrearCliente();
          else setAltaClienteAbierta(true);
        }}
      />

      {referentesDe != null && (
        <ReferentesEditor
          clienteId={referentesDe}
          clienteNombre={
            clientes.find((c) => c.id === referentesDe)?.nombreCompleto ?? "el cliente"
          }
          open
          onOpenChange={(o) => !o && setReferentesDe(null)}
          onGuardado={() => {}}
        />
      )}
    </>
  );
}

/** Fechas cargadas una por una, para los planes que no siguen ningún período */
/**
 * Elegir el cliente escribiendo, en vez de scrollear el padrón entero.
 *
 * Era un `<select>` con una opción por cliente. Con la cartera creciendo, para
 * dar de alta una financiación había que bajar por una lista de cientos de
 * nombres ordenados por id —o sea, sin ningún orden útil— hasta encontrar el
 * que se buscaba.
 *
 * Con un cliente ya elegido la lista desaparece y queda solo él: el caso
 * normal es elegir uno y seguir llenando el formulario, no volver a mirar el
 * padrón. En la edición y cuando el plan se crea desde la ficha de un cliente
 * el campo es fijo, así que ni siquiera se dibuja el buscador.
 */
function BuscadorCliente({
  clientes,
  valor,
  onElegir,
  /** El plan ya tiene cliente y no se puede cambiar: edición o alta desde su ficha */
  fijo,
}: {
  clientes: { id: number; nombreCompleto: string; dni: string }[];
  valor: string;
  onElegir: (id: string) => void;
  fijo: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const elegido = clientes.find((c) => String(c.id) === valor);

  if (elegido || fijo) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-input px-3.5 py-2">
        <div className="min-w-0">
          <div className="truncate font-medium">
            {/* Con el campo fijo el cliente puede no estar todavía en el store:
                la lista se pide al abrir el diálogo. */}
            {elegido?.nombreCompleto ?? "Cliente del plan"}
          </div>
          {elegido && <div className="text-xs text-muted-foreground">DNI {elegido.dni}</div>}
        </div>
        {!fijo && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              onElegir("");
              setBusqueda("");
            }}
          >
            Cambiar
          </Button>
        )}
      </div>
    );
  }

  const encontrados = filtrarClientes(clientes, busqueda);
  const visibles = encontrados.slice(0, TOPE_LISTA);

  return (
    <>
      <Input
        id="cliente"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o DNI…"
        autoComplete="off"
      />

      <div className="max-h-56 overflow-y-auto rounded-lg border border-input">
        {visibles.length === 0 ? (
          <p className="px-3.5 py-3 text-sm text-muted-foreground">
            Ningún cliente coincide con «{busqueda}».
          </p>
        ) : (
          visibles.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onElegir(String(c.id))}
              className="flex w-full flex-col items-start gap-0.5 border-b border-border px-3.5 py-2 text-left last:border-b-0 hover:bg-accent"
            >
              <span className="font-medium">{c.nombreCompleto}</span>
              <span className="text-xs text-muted-foreground">DNI {c.dni}</span>
            </button>
          ))
        )}
      </div>

      {encontrados.length > visibles.length && (
        <p className="text-xs text-muted-foreground">
          {encontrados.length - visibles.length} más. Escribí para achicar la lista.
        </p>
      )}
    </>
  );
}

/** Cuántos se dibujan de una. El resto aparece al escribir. */
const TOPE_LISTA = 50;

/**
 * Sin acentos y sin mayúsculas, y por palabras sueltas.
 *
 * Lo primero porque los nombres están cargados como vinieron —"Pérez" y
 * "Perez" conviven en la base— y nadie va a tipear la tilde para buscar. Lo
 * segundo porque el orden no coincide: el padrón dice "Gonzalez Eduardo José"
 * y el admin escribe "eduardo gonzalez". Cada palabra tiene que aparecer en
 * algún lado, no todas juntas y en ese orden.
 */
function filtrarClientes<T extends { nombreCompleto: string; dni: string }>(
  clientes: T[],
  busqueda: string,
): T[] {
  const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (terminos.length === 0) return clientes;

  return clientes.filter((c) => {
    const texto = normalizar(`${c.nombreCompleto} ${c.dni}`);
    return terminos.every((t) => texto.includes(t));
  });
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function FechasManuales({
  fechas,
  onChange,
}: {
  fechas: string[];
  onChange: (fechas: string[]) => void;
}) {
  const [nueva, setNueva] = useState(todayISO());

  return (
    <div className="space-y-1.5">
      <Label htmlFor="fecha-nueva">Fechas de vencimiento ({fechas.length})</Label>
      <div className="flex gap-2">
        <Input
          id="fecha-nueva"
          type="date"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          // Sin repetidas: dos cuotas el mismo día es casi siempre un error de
          // carga, y el cronograma se ordena solo al calcularlo.
          disabled={nueva === "" || fechas.includes(nueva)}
          onClick={() => onChange([...fechas, nueva].sort())}
        >
          Agregar
        </Button>
      </div>

      {fechas.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {fechas.map((f) => (
            <li
              key={f}
              className="flex items-center justify-between rounded-md bg-secondary px-2.5 py-1 text-xs"
            >
              <span className="font-mono">{formatFecha(f)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Quitar ${f}`}
                onClick={() => onChange(fechas.filter((x) => x !== f))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Linea({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-bold">{valor}</span>
    </div>
  );
}
