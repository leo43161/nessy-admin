"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { esTelefonoGuardable, TelefonosInput } from "@/components/gestion/telefono-input";
import { ReferentesEditor } from "@/components/gestion/referentes-editor";
import { NotasCliente } from "@/components/gestion/notas-cliente";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { guardarCliente } from "@/store/slices/clientes.slice";
import { useLocalidades } from "@/hooks/use-catalogos";
import type { ClienteListado, ClientePayload } from "@/types";

const VACIO: ClientePayload = {
  dni: "",
  nombreCompleto: "",
  email: null,
  direccion: null,
  ubicacionCobro: null,
  idLocalidad: null,
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
      {/* A pantalla completa en el teléfono: con el mapa adentro, el formulario
          es más alto que cualquier modal y en un 90dvh quedaba haciendo scroll
          dentro de una ventanita. */}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg max-sm:h-dvh max-sm:max-h-none max-sm:max-w-full max-sm:rounded-none">
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
  // Cliente al que se le están cargando los referentes: el recién creado, o
  // este mismo si se está editando.
  const [referentesDe, setReferentesDe] = useState<{ id: number; nombre: string } | null>(null);

  const set = <K extends keyof ClientePayload>(campo: K, valor: ClientePayload[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const completo = form.dni.trim() !== "" && form.nombreCompleto.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completo || guardando) return;
    setGuardando(true);
    // Los teléfonos a medio cargar no se guardan: la lista reemplaza la que hay
    // en la base, y un número incompleto es un WhatsApp que no abre.
    const res = await dispatch(
      guardarCliente({ ...form, telefonos: form.telefonos.filter(esTelefonoGuardable) }),
    );
    setGuardando(false);
    if (!guardarCliente.fulfilled.match(res)) {
      toast.error(res.payload ?? "No se pudo guardar.");
      return;
    }

    toast.success(cliente ? "Cliente actualizado" : "Cliente creado");

    // En el alta el paso siguiente es quién responde por él, y es el momento
    // en que se tiene el dato fresco. En la edición ya se cerró: los
    // referentes se tocan desde la ficha.
    if (cliente) {
      onCerrar();
      return;
    }
    setReferentesDe({ id: res.payload.id, nombre: res.payload.nombreCompleto });
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

      {/* Solo en la edición: en el alta el cliente todavía no existe y no hay
          notas que traer. */}
      {cliente && <NotasCliente clienteId={cliente.id} />}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Sin select de estado: dar de baja a un cliente es `Clientes.Activo`
            (borrado lógico, botón eliminar de la lista), no esta columna. */}
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

        {/* Dos columnas recién en `sm`: "Juan Bautista Alberdi" o el nombre
            completo de un cobrador no entran en media pantalla de teléfono. */}
        <div className="grid gap-3 sm:grid-cols-2">
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

        <TelefonosInput
          valores={form.telefonos}
          onChange={(t) => set("telefonos", t)}
          localidadNombre={localidades.find((l) => l.id === form.idLocalidad)?.nombre}
        />

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

      {/* Recién creado: se le cargan los referentes en el mismo envión. Al
          cerrar este diálogo se cierra también el alta. */}
      {referentesDe && (
        <ReferentesEditor
          clienteId={referentesDe.id}
          clienteNombre={referentesDe.nombre}
          open
          onOpenChange={(abierto) => {
            if (!abierto) {
              setReferentesDe(null);
              onCerrar();
            }
          }}
          onGuardado={() => {}}
        />
      )}
    </>
  );
}
