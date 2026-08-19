"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  FileWarning,
  Loader2,
  MapPinned,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { ClienteFormDialog } from "@/components/gestion/cliente-form-dialog";
import { PlanFormDialog } from "@/components/gestion/plan-form-dialog";
import { ReferentesCliente } from "@/components/gestion/referentes-cliente";
import { CobroDialog, type CuotaACobrar } from "@/components/gestion/cobro-dialog";
import { cn } from "@/lib/utils";
import { fmtMoney, formatFecha, mapaUrl } from "@/lib/format";
import { estadoDeCuentaToText, LEYENDA_RECLAMO, reclamoToText } from "@/lib/estado-cuenta";
import { enviarEstadoCuenta } from "@/lib/compartir";
import { soloElPlan } from "@/lib/estado-cuenta-por-plan";
import { PLAN_STATUS_BADGE } from "@/lib/status";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearDetalle, fetchClienteDetalle, fetchClientes } from "@/store/slices/clientes.slice";
import { asignarCobrador } from "@/services/clientes.service";
import type { ClienteListado, EstadoDeCuentaPlan, PlanListado } from "@/types";

/**
 * Ficha completa del cliente: quién es, quién responde por él, cómo viene cada
 * financiación, y todo lo que se puede hacer sobre él sin salir de acá —cobrar,
 * crear o editar planes, cambiar el cobrador, tocar los referentes y mandarle
 * el estado de cuenta.
 *
 * En celular ocupa la pantalla entera: el panel se usa desde el teléfono y un
 * modal chico con scroll interno es incómodo de manejar con una mano.
 */
export function ClienteDetailDialog({
  clienteId,
  open,
  onOpenChange,
}: {
  clienteId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const { data, status } = useAppSelector((s) => s.clientes.detalle);
  const clientes = useAppSelector((s) => s.clientes.items);
  const cobradores = useAppSelector((s) => s.admin.cobradores.items);

  const [editandoCliente, setEditandoCliente] = useState(false);
  const [planEnEdicion, setPlanEnEdicion] = useState<PlanListado | null>(null);
  const [planAbierto, setPlanAbierto] = useState(false);
  const [cuotaACobrar, setCuotaACobrar] = useState<CuotaACobrar | null>(null);
  const [guardandoCobrador, setGuardandoCobrador] = useState(false);
  const [enviandoReclamo, setEnviandoReclamo] = useState(false);
  /** Qué plan lleva el PDF del reclamo. `undefined` = toda la cuenta. */
  const [planDelPdf, setPlanDelPdf] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (open && clienteId != null) dispatch(fetchClienteDetalle(clienteId));
    if (!open) dispatch(clearDetalle());
  }, [open, clienteId, dispatch]);

  const cargando = status === "loading" || status === "idle" || !data;

  // El id del cobrador viene en el propio detalle: buscarlo en el listado de
  // clientes fallaba al abrir la ficha desde el kanban, donde ese listado no
  // está cargado y el select mostraba "Sin asignar".
  const enListado: ClienteListado | undefined = clientes.find((c) => c.id === clienteId);
  const cobradorId = data?.cobradorAsignadoId ?? null;

  const refrescar = () => {
    if (clienteId != null) dispatch(fetchClienteDetalle(clienteId));
    dispatch(fetchClientes({ cobradorId: null, localidadId: null }));
  };

  const cambiarCobrador = async (nuevoId: number) => {
    if (clienteId == null) return;
    setGuardandoCobrador(true);
    try {
      await asignarCobrador(clienteId, nuevoId);
      toast.success("Cobrador actualizado.");
      refrescar();
    } catch {
      toast.error("No se pudo cambiar el cobrador.");
    } finally {
      setGuardandoCobrador(false);
    }
  };

  const texto = data ? estadoDeCuentaToText(data.estadoDeCuenta) : "";

  const copiarEstado = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Estado de cuenta copiado.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  /**
   * Reclamo: el único envío con el PDF adjunto.
   *
   * En el celular `navigator.share()` abre la hoja de compartir con el archivo
   * y ahí se elige el chat; en escritorio no existe compartir archivos, así que
   * baja el PDF y abre WhatsApp con el texto (dos pasos, no hay otra).
   */
  const enviarReclamo = async () => {
    if (!data) return;
    setEnviandoReclamo(true);
    try {
      const { archivoEstadoCuentaPdf, descargarArchivo } = await import(
        "@/lib/pdf/estado-cuenta-pdf"
      );
      const archivo = await archivoEstadoCuentaPdf(
        data.estadoDeCuenta,
        {
          nombreCompleto: data.cliente.nombreCompleto,
          dni: data.cliente.dni,
          direccion: data.cliente.direccion,
          localidadNombre: data.localidadNombre,
        },
        LEYENDA_RECLAMO,
        planDelPdf,
      );

      const salio = await enviarEstadoCuenta(
        archivo,
        // El texto se recorta al mismo plan que el PDF: si no, el mensaje
        // reclama el vencido de toda la cuenta y el adjunto muestra otro
        // número. El cliente ve dos cifras distintas y no paga ninguna.
        reclamoToText(soloElPlan(data.estadoDeCuenta, planDelPdf)),
        data.telefonos[0]?.numero ?? null,
        descargarArchivo,
      );
      if (salio) toast.success("Reclamo enviado.");
    } catch {
      toast.error("No se pudo generar el reclamo.");
    } finally {
      setEnviandoReclamo(false);
    }
  };

  const abrirPlan = (plan: EstadoDeCuentaPlan | null) => {
    if (!data) return;
    setPlanEnEdicion(
      plan && {
        id: plan.planId,
        nombre: plan.nombre,
        status: plan.status,
        montoTotal: plan.montoTotal,
        clienteId: data.estadoDeCuenta.clienteId,
        clienteNombre: data.cliente.nombreCompleto,
        cobradorNombre: data.cobradorAsignadoNombre,
        cuotasTotales: plan.cuotasTotales,
        cuotasCobradas: plan.cuotasPagadas,
        pagado: plan.pagado,
      },
    );
    setPlanAbierto(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg max-sm:h-dvh max-sm:max-h-none max-sm:max-w-full max-sm:rounded-none">
          {cargando ? (
            <>
              <DialogHeader>
                <DialogTitle>Cargando cliente</DialogTitle>
                <DialogDescription>Buscando la ficha completa.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-7 animate-spin text-primary" />
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <InitialsAvatar nombre={data.cliente.nombreCompleto} size="md" />
                  <div className="min-w-0 text-left">
                    <DialogTitle className="truncate">{data.cliente.nombreCompleto}</DialogTitle>
                    <DialogDescription className="font-mono">
                      DNI {data.cliente.dni}
                    </DialogDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto shrink-0"
                    aria-label="Editar datos del cliente"
                    onClick={() => setEditandoCliente(true)}
                  >
                    <Pencil />
                  </Button>
                </div>
              </DialogHeader>

              {/* ── Datos ── */}
              <dl className="space-y-1.5 text-sm">
                <Dato icono={<MapPinned className="size-3.5" />}>
                  {data.cliente.direccion ?? "Sin dirección"}
                  {data.localidadNombre && ` · ${data.localidadNombre}`}
                  {mapaUrl(data.cliente.ubicacionCobro) && (
                    <>
                      {" · "}
                      <a
                        href={mapaUrl(data.cliente.ubicacionCobro)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        punto de cobro
                      </a>
                    </>
                  )}
                </Dato>
                <Dato icono={<Phone className="size-3.5" />}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {data.telefonos.length > 0
                      ? data.telefonos.map((t) => (
                          <span key={t.id} className="font-mono">
                            {t.numero}
                          </span>
                        ))
                      : "Sin teléfono"}
                    {data.telefonos.length > 0 && <WhatsappButton telefonos={data.telefonos} />}
                  </span>
                </Dato>
              </dl>

              {/* ── Cobrador: uno solo por cliente ── */}
              <Bloque titulo="Cobrador">
                <div className="flex items-center gap-2">
                  <User className="size-3.5 shrink-0 text-muted-foreground" />
                  <select
                    aria-label="Cobrador asignado"
                    value={cobradorId ?? ""}
                    disabled={guardandoCobrador}
                    onChange={(e) => cambiarCobrador(Number(e.target.value))}
                    className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50"
                  >
                    <option value="" disabled>
                      Sin asignar
                    </option>
                    {cobradores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombreCompleto}
                      </option>
                    ))}
                  </select>
                  {guardandoCobrador && <Loader2 className="size-4 animate-spin text-primary" />}
                </div>
              </Bloque>

              {/* ── Estado de cuenta ── */}
              <Bloque titulo="Estado de cuenta">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Total label="Pagado" valor={data.estadoDeCuenta.totalPagado} />
                  <Total label="Pendiente" valor={data.estadoDeCuenta.saldoPendiente} />
                  <Total
                    label="Vencido"
                    valor={data.estadoDeCuenta.totalVencido}
                    className="text-red-600 dark:text-red-400"
                  />
                </div>
                {/* Con un solo plan no hay nada que elegir. */}
                {data.estadoDeCuenta.planes.length > 1 && (
                  <div className="mb-2 space-y-1.5">
                    <Label htmlFor="plan-del-reclamo">Qué plan va en el PDF</Label>
                    <select
                      id="plan-del-reclamo"
                      value={planDelPdf ?? ""}
                      onChange={(e) =>
                        setPlanDelPdf(e.target.value === "" ? undefined : Number(e.target.value))
                      }
                      disabled={enviandoReclamo}
                      className="h-11 w-full rounded-md border border-input bg-transparent px-3.5 text-base shadow-xs disabled:opacity-50"
                    >
                      <option value="">
                        Toda la cuenta ({data.estadoDeCuenta.planes.length} planes)
                      </option>
                      {data.estadoDeCuenta.planes.map((plan) => (
                        <option key={plan.planId} value={plan.planId}>
                          Solo {plan.nombre} — {fmtMoney(plan.pendiente)} pendiente
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={copiarEstado}>
                    <Copy />
                    Copiar
                  </Button>
                  <WhatsappButton telefonos={data.telefonos} mensaje={texto}>
                    <Button variant="secondary" size="sm" disabled={data.telefonos.length === 0}>
                      <MessageCircle />
                      Estado de cuenta
                    </Button>
                  </WhatsappButton>
                  {/* El reclamo solo tiene sentido con cuotas vencidas, y es el
                      único envío que lleva el PDF adjunto. */}
                  {data.estadoDeCuenta.totalVencido > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={enviandoReclamo || data.telefonos.length === 0}
                      onClick={enviarReclamo}
                    >
                      {enviandoReclamo ? <Loader2 className="animate-spin" /> : <FileWarning />}
                      {enviandoReclamo ? "Generando…" : "Enviar reclamo (PDF)"}
                    </Button>
                  )}
                </div>
              </Bloque>

              {/* ── Financiaciones ── */}
              <Bloque
                titulo={`Financiaciones (${data.estadoDeCuenta.planes.length})`}
                accion={
                  <Button variant="ghost" size="sm" onClick={() => abrirPlan(null)}>
                    <Plus />
                    Nueva
                  </Button>
                }
              >
                {data.estadoDeCuenta.planes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Este cliente no tiene planes.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.estadoDeCuenta.planes.map((plan) => (
                      <li key={plan.planId} className="rounded-lg border border-border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-semibold">
                            {plan.nombre}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold",
                              PLAN_STATUS_BADGE[plan.status],
                            )}
                          >
                            {plan.status}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {plan.cuotasPagadas}/{plan.cuotasTotales} cuotas ·{" "}
                          <span className="font-mono">{fmtMoney(plan.pagado)}</span> de{" "}
                          <span className="font-mono">{fmtMoney(plan.montoTotal)}</span>
                          {plan.vencido > 0 && (
                            <>
                              {" · "}
                              <span className="font-mono text-red-600 dark:text-red-400">
                                {fmtMoney(plan.vencido)} vencido
                              </span>
                            </>
                          )}
                          {plan.proximaCuota && (
                            <>
                              <br />
                              Próxima: {formatFecha(plan.proximaCuota.fecha)} ·{" "}
                              <span className="font-mono">
                                {fmtMoney(plan.proximaCuota.monto)}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="mt-2 flex gap-1.5">
                          <Button variant="outline" size="xs" onClick={() => abrirPlan(plan)}>
                            <Pencil />
                            Editar
                          </Button>
                          {/* Sin cuota pendiente no hay nada que cobrar: el plan
                              está terminado o no tiene cronograma. */}
                          {plan.proximaCuota?.cuotaId != null && (
                            <Button
                              size="xs"
                              onClick={() =>
                                setCuotaACobrar({
                                  cuotaId: plan.proximaCuota!.cuotaId!,
                                  fecha: plan.proximaCuota!.fecha,
                                  monto: plan.proximaCuota!.monto,
                                  planNombre: plan.nombre,
                                  clienteId: data.estadoDeCuenta.clienteId,
                                })
                              }
                            >
                              <ReceiptText />
                              Cobrar
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloque>

              {/* ── Referentes: listados con su WhatsApp, no detrás de otro
                  modal. El teléfono del garante se necesita justo cuando el
                  cliente no responde. ──*/}
              <ReferentesCliente
                clienteId={data.estadoDeCuenta.clienteId}
                clienteNombre={data.cliente.nombreCompleto}
                referentes={data.referentes}
                editable
                onEditado={refrescar}
              />

              {data.notas.length > 0 && (
                <Bloque titulo={`Notas (${data.notas.length})`}>
                  <ul className="space-y-1.5">
                    {data.notas.map((nota) => (
                      <li key={nota.id} className="rounded-lg bg-secondary px-2.5 py-2 text-xs">
                        <p className="leading-relaxed">{nota.nota}</p>
                        <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                          {formatFecha(nota.fechaDeCreacion)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Bloque>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {data && (
        <>
          <ClienteFormDialog
            cliente={enListado ?? null}
            open={editandoCliente}
            onOpenChange={(o) => {
              setEditandoCliente(o);
              if (!o) refrescar();
            }}
          />
          <CobroDialog
            cuota={cuotaACobrar}
            clienteNombre={data.cliente.nombreCompleto}
            cobradorId={cobradorId}
            cobradorNombre={data.cobradorAsignadoNombre}
            open={cuotaACobrar !== null}
            onOpenChange={(o) => !o && setCuotaACobrar(null)}
            onCobrado={refrescar}
          />
        </>
      )}

      <PlanFormDialog
        plan={planEnEdicion}
        clienteFijo={clienteId ?? undefined}
        open={planAbierto}
        onOpenChange={(o) => {
          setPlanAbierto(o);
          if (!o) refrescar();
        }}
      />
    </>
  );
}

function Dato({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icono}</span>
      <span className="min-w-0 text-foreground">{children}</span>
    </div>
  );
}

function Bloque({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[0.7rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
          {titulo}
        </h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Total({
  label,
  valor,
  className,
}: {
  label: string;
  valor: number;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-secondary px-2 py-1.5">
      <div className="text-[0.6rem] font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </div>
      <div className={cn("font-mono text-sm font-bold", className)}>{fmtMoney(valor)}</div>
    </div>
  );
}
