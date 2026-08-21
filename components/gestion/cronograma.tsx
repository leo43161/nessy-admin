"use client";

import { Lock, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtMoney, formatFecha } from "@/lib/format";
import type { Cuota, CuotaExistente, Operacion, ParCuota } from "@/lib/cronograma";
import type { PlanListado } from "@/types";

/**
 * Las piezas que comparten los cuatro diálogos que reescriben un cronograma:
 * editar, refinanciar, renovar y reestructurar.
 *
 * Están juntas en un archivo porque nunca se usan por separado —un diálogo que
 * toca cuotas necesita las tres— y porque así la redacción no se desincroniza
 * entre operaciones. El cliente ve el mismo control diga lo que diga el título
 * del diálogo, que es todo el punto: lo que le costaba no era la operación,
 * era que cada pantalla se lo preguntara distinto.
 *
 * Los números los calcula `lib/cronograma.ts`, que tiene su chequeo. Acá no se
 * hace ninguna cuenta.
 */

/* ══════════════════════════════════════════════════════════════
   Elegir sobre qué financiación se aplica
   ══════════════════════════════════════════════════════════════ */

/**
 * Un cliente puede tener varias financiaciones abiertas a la vez, y desde el
 * listado no siempre se entra por la que se quería: los planes se llaman
 * "Credito1", "Crédito 1", "Prestamo2"…
 *
 * Con una sola financiación no se dibuja nada: preguntar entre una sola opción
 * es ruido.
 */
export function SelectorPlan({
  planes,
  valor,
  onElegir,
  deshabilitado,
}: {
  /** Los del mismo cliente, ya filtrados */
  planes: PlanListado[];
  valor: number;
  onElegir: (id: number) => void;
  deshabilitado?: boolean;
}) {
  const elegido = planes.find((p) => p.id === valor);

  if (planes.length <= 1) {
    return elegido ? (
      <div className="flex flex-col gap-1.5">
        <Label>Financiación</Label>
        <div className="rounded-lg border border-input px-3.5 py-2">
          <div className="font-medium">{elegido.nombre}</div>
          <DetallePlan plan={elegido} />
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="plan-destino">
        Financiación · el cliente tiene {planes.length}
      </Label>
      <select
        id="plan-destino"
        value={valor}
        onChange={(e) => onElegir(Number(e.target.value))}
        disabled={deshabilitado}
        className="h-11 w-full rounded-lg border border-input bg-transparent px-3.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
      >
        {planes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} — {fmtMoney(p.montoTotal)} · {p.cuotasTotales}{" "}
            {p.cuotasTotales === 1 ? "cuota" : "cuotas"}
          </option>
        ))}
      </select>
      {elegido && <DetallePlan plan={elegido} />}
    </div>
  );
}

/** El renglón chico de abajo: total, avance y estado de la financiación */
function DetallePlan({ plan }: { plan: PlanListado }) {
  return (
    <p className="text-xs text-muted-foreground">
      {fmtMoney(plan.montoTotal)} · {plan.cuotasCobradas}/{plan.cuotasTotales} cuotas cobradas ·{" "}
      {plan.status}
    </p>
  );
}

/* ══════════════════════════════════════════════════════════════
   Monto por cuota ↔ cantidad de cuotas
   ══════════════════════════════════════════════════════════════ */

/**
 * Los dos campos, sincronizados: el que se toca manda y el otro se calcula.
 *
 * Es lo que el alta de una financiación ya hacía y lo que a los otros tres
 * diálogos les faltaba. Importa porque el acuerdo con el cliente se cierra de
 * las dos maneras —"que me quede en 20.000 por semana" y "que lo termine en 10
 * cuotas"— y hasta ahora solo se podía escribir la primera; la segunda había
 * que dividirla a mano.
 */
export function CamposCuota({
  par,
  onCambio,
  montoCuota,
  cantidad,
  deshabilitado,
  ayuda,
}: {
  par: ParCuota;
  onCambio: (par: ParCuota) => void;
  /** Ya resueltos por `resolverPar`: el campo que no se tocó muestra esto */
  montoCuota: number;
  cantidad: number;
  deshabilitado?: boolean;
  ayuda?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="monto-cuota">Monto de cada cuota</Label>
          <Input
            id="monto-cuota"
            type="number"
            inputMode="decimal"
            min={0}
            value={par.manda === "monto" ? par.monto : montoCuota || ""}
            onChange={(e) => onCambio({ ...par, monto: e.target.value, manda: "monto" })}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="15000"
            disabled={deshabilitado}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cantidad-cuotas">Cantidad de cuotas</Label>
          <Input
            id="cantidad-cuotas"
            type="number"
            min={1}
            value={par.manda === "cantidad" ? par.cantidad : cantidad || ""}
            onChange={(e) => onCambio({ ...par, cantidad: e.target.value, manda: "cantidad" })}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="10"
            disabled={deshabilitado}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {ayuda ?? "Escribí cualquiera de los dos: el otro se calcula solo."}
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Cada cuánto vence una cuota
   ══════════════════════════════════════════════════════════════ */

/**
 * Cada cuánto vence una cuota, ya nombrado.
 *
 * Antes cada diálogo pedía esto como un número libre —"cada cuántos días"—
 * con una ayuda que decía "7 es semanal, 15 quincenal, 30 mensual". La
 * traducción existía, pero la hacía el admin de memoria, cada vez. Acá la hace
 * la lista, y el número en días queda a la vista para el que ya piensa así.
 *
 * ⚠️ **Mensual son 30 días corridos**, no "el mismo día de cada mes" como en
 * el alta de una financiación. Los tres SP reciben `frecuencia_dias`, un paso
 * fijo: no hay forma de pedirles "todos los 10". Por eso el label lo dice en
 * vez de dejarlo sobreentendido.
 */
export const FRECUENCIAS: { dias: number; label: string; enPalabras: string }[] = [
  { dias: 7, label: "Semanal — cada 7 días", enPalabras: "todas las semanas" },
  { dias: 15, label: "Quincenal — cada 15 días", enPalabras: "cada 15 días" },
  { dias: 30, label: "Mensual — cada 30 días", enPalabras: "cada 30 días" },
  { dias: 1, label: "Diaria — todos los días", enPalabras: "todos los días" },
];

/** El valor del select cuando el admin quiere un paso que no está en la lista */
export const OTRA = "otro";

/** Los días que representa lo elegido: el número del select, o lo escrito a mano */
export function diasDeFrecuencia(frecuencia: string, aMano: string): number {
  const n = Number(frecuencia === OTRA ? aMano : frecuencia);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** "todas las semanas" — para que los resúmenes no hablen en días sueltos */
export function frecuenciaEnPalabras(dias: number): string {
  return (
    FRECUENCIAS.find((f) => f.dias === dias)?.enPalabras ??
    `cada ${dias} ${dias === 1 ? "día" : "días"}`
  );
}

export function CamposFrecuencia({
  frecuencia,
  onFrecuencia,
  aMano,
  onAMano,
  deshabilitado,
}: {
  frecuencia: string;
  onFrecuencia: (v: string) => void;
  aMano: string;
  onAMano: (v: string) => void;
  deshabilitado?: boolean;
}) {
  return (
    <>
      {/* La lista dice el nombre Y los días: el que ya piensa en "cada 15" lo
          sigue encontrando, y el que piensa en "quincenal" no traduce nada. */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="frecuencia">Cada cuánto vence una cuota</Label>
        <select
          id="frecuencia"
          value={frecuencia}
          onChange={(e) => onFrecuencia(e.target.value)}
          disabled={deshabilitado}
          className="h-11 w-full rounded-lg border border-input bg-transparent px-3.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
        >
          {FRECUENCIAS.map((f) => (
            <option key={f.dias} value={f.dias}>
              {f.label}
            </option>
          ))}
          <option value={OTRA}>Otra — la escribo en días</option>
        </select>
      </div>

      {frecuencia === OTRA && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dias-a-mano">Cada cuántos días</Label>
          <Input
            id="dias-a-mano"
            type="number"
            inputMode="decimal"
            min={1}
            value={aMano}
            onChange={(e) => onAMano(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="10"
            disabled={deshabilitado}
          />
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   Cómo queda el cronograma
   ══════════════════════════════════════════════════════════════ */

const QUE_PASA: Record<Operacion, string> = {
  editar:
    "Se dan de baja las cuotas pendientes y se reemplazan por las nuevas. Las pagadas y las atrasadas quedan como están.",
  refinanciar:
    "Se dan de baja las cuotas pendientes y atrasadas y se reemplazan por las nuevas. Las pagadas quedan como están.",
  renovar: "No se da de baja ninguna cuota: las nuevas se agregan al final del cronograma.",
  reestructurar:
    "Se dan de baja las cuotas pendientes y atrasadas y se reemplazan por las nuevas, por el mismo total.",
};

/**
 * El cronograma completo como va a quedar: lo que sobrevive, lo que se da de
 * baja y lo que se crea, cuota por cuota y con sus fechas.
 *
 * Es lo único que separa un monto mal tipeado de un cronograma reescrito. Los
 * diálogos ya mostraban totales —"202 cuotas de $15.000"— pero un total no
 * deja ver que la primera cuota nueva cae en una fecha que ya pasó, o que la
 * última se va a tres años. Eso solo se ve con las fechas a la vista.
 */
export function PreviaCronograma({
  operacion,
  sobreviven,
  seDanDeBaja,
  nuevas,
  totalAntes,
  totalDespues,
}: {
  operacion: Operacion;
  sobreviven: CuotaExistente[];
  seDanDeBaja: CuotaExistente[];
  nuevas: Cuota[];
  /** Lo que el cliente debía y lo que va a deber, del plan entero */
  totalAntes: number;
  totalDespues: number;
}) {
  const filas = [
    ...sobreviven.map((c) => ({ ...c, tipo: "queda" as const })),
    ...seDanDeBaja.map((c) => ({ ...c, tipo: "baja" as const })),
    ...nuevas.map((c) => ({ ...c, estado: "Nueva", tipo: "nueva" as const })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-primary bg-secondary p-3">
      <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Cómo queda
      </div>

      <p className="font-mono text-lg font-bold tabular-nums">
        <span className="text-muted-foreground">{fmtMoney(totalAntes)}</span>
        <span className="mx-2 text-muted-foreground">→</span>
        <span>{fmtMoney(totalDespues)}</span>
      </p>

      <p className="text-sm">
        {nuevas.length === 0 && seDanDeBaja.length === 0 && (
          <span className="text-muted-foreground">
            El cronograma no cambia: son las mismas cuotas que ya están cargadas.
          </span>
        )}
        {nuevas.length > 0 && (
          <>
            <strong className="tabular-nums">{nuevas.length}</strong>{" "}
            {nuevas.length === 1 ? "cuota nueva" : "cuotas nuevas"}
          </>
        )}
        {seDanDeBaja.length > 0 && (
          <>
            {nuevas.length > 0 && " · "}
            <strong className="tabular-nums">{seDanDeBaja.length}</strong> se{" "}
            {seDanDeBaja.length === 1 ? "da" : "dan"} de baja
          </>
        )}
        {nuevas.length > 0 && (
          <>
            {" · termina el "}
            <strong>{formatFecha(nuevas[nuevas.length - 1].fecha)}</strong>
          </>
        )}
      </p>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-card">
        {filas.map((f, i) => (
          <div
            key={`${f.tipo}-${i}`}
            className={cn(
              "flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm last:border-b-0",
              f.tipo === "baja" && "text-muted-foreground line-through",
              f.tipo === "nueva" && "bg-accent/50 font-medium",
            )}
          >
            {f.tipo === "queda" && <Lock className="size-3.5 shrink-0 text-muted-foreground" />}
            {f.tipo === "baja" && <X className="size-3.5 shrink-0" />}
            {f.tipo === "nueva" && <Plus className="size-3.5 shrink-0 text-accent-foreground" />}
            <span className="tabular-nums">{formatFecha(f.fecha)}</span>
            <span className="ml-auto font-mono tabular-nums">{fmtMoney(f.monto)}</span>
            <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
              {f.estado}
            </span>
          </div>
        ))}
      </div>

      {/* Sin nada que dar de baja ni que crear, la explicación de qué hace la
          operación sobraría: no va a hacer nada. */}
      {(nuevas.length > 0 || seDanDeBaja.length > 0) && (
        <p className="text-xs text-muted-foreground">{QUE_PASA[operacion]}</p>
      )}
    </div>
  );
}
