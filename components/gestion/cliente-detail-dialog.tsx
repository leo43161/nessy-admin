"use client";

import { useEffect } from "react";
import { Loader2, MapPin, Phone, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { cn } from "@/lib/utils";
import { fmtMoney, formatFecha } from "@/lib/format";
import { CLIENTE_STATUS_BADGE, PLAN_STATUS_BADGE } from "@/lib/status";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearDetalle, fetchClienteDetalle } from "@/store/slices/clientes.slice";

/**
 * Ficha del cliente en solo lectura: quién es, quién responde por él y cómo
 * viene cada plan. Se abre desde una card del kanban.
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

  useEffect(() => {
    if (open && clienteId != null) dispatch(fetchClienteDetalle(clienteId));
    if (!open) dispatch(clearDetalle());
  }, [open, clienteId, dispatch]);

  const cargando = status === "loading" || status === "idle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {cargando || !data ? (
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
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold",
                    CLIENTE_STATUS_BADGE[data.cliente.status],
                  )}
                >
                  {data.cliente.status}
                </span>
              </div>
            </DialogHeader>

            <dl className="space-y-1.5 text-sm">
              <Dato icono={<MapPin className="size-3.5" />}>
                {data.cliente.ubicacionCobro ?? data.cliente.direccion ?? "Sin dirección"}
                {data.localidadNombre && ` · ${data.localidadNombre}`}
              </Dato>
              <Dato icono={<User className="size-3.5" />}>
                Cobrador: {data.cobradorAsignadoNombre ?? "sin asignar"}
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
            </Bloque>

            <Bloque titulo={`Planes (${data.estadoDeCuenta.planes.length})`}>
              <ul className="space-y-2">
                {data.estadoDeCuenta.planes.map((plan) => (
                  <li key={plan.planId} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold">{plan.nombre}</span>
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
                      {plan.proximaCuota && (
                        <>
                          <br />
                          Próxima: {formatFecha(plan.proximaCuota.fecha)} ·{" "}
                          <span className="font-mono">{fmtMoney(plan.proximaCuota.monto)}</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Bloque>

            {data.referentes.length > 0 && (
              <Bloque titulo={`Referentes (${data.referentes.length})`}>
                <ul className="space-y-1.5">
                  {data.referentes.map((ref) => (
                    <li
                      key={`${ref.tipo}-${ref.id}`}
                      className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1.5 text-xs"
                    >
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-bold text-primary">
                        {ref.tipo}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {ref.nombreCompleto}
                      </span>
                      {ref.telefonos.length > 0 && <WhatsappButton telefonos={ref.telefonos} />}
                    </li>
                  ))}
                </ul>
              </Bloque>
            )}

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

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <h3 className="text-[0.7rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Total({ label, valor, className }: { label: string; valor: number; className?: string }) {
  return (
    <div className="rounded-lg bg-secondary px-2 py-2">
      <div className="text-[0.62rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className={cn("mt-0.5 font-mono text-sm font-bold", className)}>{fmtMoney(valor)}</div>
    </div>
  );
}

/** Skeleton reutilizable — se deja exportado para las listas de gestión */
export function FichaSkeleton() {
  return <Skeleton className="h-20 rounded-xl" />;
}
