"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
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
import { MapaCobro } from "@/components/gestion/mapa-cobro";
import { CLIENTE_STATUSES } from "@/lib/status";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { guardarCliente } from "@/store/slices/clientes.slice";
import { useLocalidades } from "@/hooks/use-catalogos";
import type { ClienteListado, ClientePayload, ClienteStatus } from "@/types";

const VACIO: ClientePayload = {
  dni: "",
  nombreCompleto: "",
  email: null,
  direccion: null,
  ubicacionCobro: null,
  idLocalidad: null,
  status: "Activo",
  telefonos: [""],
  cobradorId: null,
};

function aPayload(cliente: ClienteListado | null): ClientePayload {
  if (!cliente) return VACIO;
  return {
    id: cliente.id,
    dni: cliente.dni,
    nombreCompleto: cliente.nombreCompleto,
    email: null,
    direccion: cliente.direccion,
    ubicacionCobro: cliente.ubicacionCobro,
    idLocalidad: cliente.idLocalidad,
    status: cliente.status,
    telefonos: cliente.telefonos.length ? cliente.telefonos.map((t) => t.numero) : [""],
    cobradorId: cliente.cobradorAsignadoId,
  };
}

/**
 * Alta y edición de cliente. Sin `cliente` es un alta.
 *
 * El formulario va en un componente aparte para que el estado nazca de las
 * props: Radix desmonta el contenido al cerrar el diálogo, así que cada
 * apertura lo remonta con los datos frescos y no hay que sincronizarlo
 * con un efecto.
 */
export function ClienteFormDialog({
  cliente,
  open,
  onOpenChange,
}: {
  cliente: ClienteListado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <ClienteForm
          key={cliente?.id ?? "nuevo"}
          cliente={cliente}
          onCerrar={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ClienteForm({
  cliente,
  onCerrar,
}: {
  cliente: ClienteListado | null;
  onCerrar: () => void;
}) {
  const dispatch = useAppDispatch();
  const cobradores = useAppSelector((s) => s.admin.cobradores.items);
  const localidades = useLocalidades();
  const [form, setForm] = useState<ClientePayload>(() => aPayload(cliente));
  const [guardando, setGuardando] = useState(false);

  const set = <K extends keyof ClientePayload>(campo: K, valor: ClientePayload[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const setTelefono = (i: number, valor: string) =>
    setForm((f) => ({
      ...f,
      telefonos: f.telefonos.map((t, j) => (j === i ? valor : t)),
    }));

  const completo = form.dni.trim() !== "" && form.nombreCompleto.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completo || guardando) return;
    setGuardando(true);
    const res = await dispatch(guardarCliente(form));
    setGuardando(false);
    if (guardarCliente.fulfilled.match(res)) {
      toast.success(cliente ? "Cliente actualizado" : "Cliente creado");
      onCerrar();
    } else {
      toast.error(res.payload ?? "No se pudo guardar.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{cliente ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        <DialogDescription>
          {cliente
            ? "Los cambios se aplican sobre la ficha existente."
            : "El alta crea también la cuenta corriente del cliente."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dni">DNI *</Label>
            <Input
              id="dni"
              value={form.dni}
              onChange={(e) => set("dni", e.target.value)}
              inputMode="numeric"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Estado</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as ClienteStatus)}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENTE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre completo *</Label>
          <Input
            id="nombre"
            value={form.nombreCompleto}
            onChange={(e) => set("nombreCompleto", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="direccion">Dirección</Label>
          <Input
            id="direccion"
            value={form.direccion ?? ""}
            onChange={(e) => set("direccion", e.target.value || null)}
          />
        </div>

        {/* El punto de cobro va en el mapa y no en un input de texto: esa
            columna es la que los SPs de cobro comparan contra la ubicación del
            cobrador para marcar Dentro_Rango, y solo entiende "lat,lon". */}
        <MapaCobro valor={form.ubicacionCobro} onChange={(v) => set("ubicacionCobro", v)} />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="localidad">Localidad</Label>
            <Select
              value={form.idLocalidad?.toString() ?? ""}
              onValueChange={(v) => set("idLocalidad", Number(v))}
            >
              <SelectTrigger id="localidad" className="w-full">
                <SelectValue placeholder="Elegir" />
              </SelectTrigger>
              <SelectContent>
                {localidades.map((l) => (
                  <SelectItem key={l.id} value={l.id.toString()}>
                    {l.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cobrador">Cobrador</Label>
            <Select
              value={form.cobradorId?.toString() ?? ""}
              onValueChange={(v) => set("cobradorId", Number(v))}
            >
              <SelectTrigger id="cobrador" className="w-full">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {cobradores.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.nombreCompleto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Teléfonos</Label>
          {form.telefonos.map((tel, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={tel}
                onChange={(e) => setTelefono(i, e.target.value)}
                placeholder="3815010101"
                inputMode="tel"
                aria-label={`Teléfono ${i + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar teléfono ${i + 1}`}
                disabled={form.telefonos.length === 1}
                onClick={() =>
                  set(
                    "telefonos",
                    form.telefonos.filter((_, j) => j !== i),
                  )
                }
              >
                <X />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set("telefonos", [...form.telefonos, ""])}
          >
            <Plus />
            Agregar teléfono
          </Button>
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
    </>
  );
}
