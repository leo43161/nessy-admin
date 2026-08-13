"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, UserPlus, X } from "lucide-react";
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
import { TelefonosInput, esTelefonoGuardable } from "@/components/gestion/telefono-input";
import { NotasCliente } from "@/components/gestion/notas-cliente";
import { useAppSelector } from "@/store/hooks";
import {
  crearReferente,
  getClientesReferentes,
  getReferentes,
  getReferentesDeCliente,
  guardarClientesReferentes,
  guardarReferentesDeCliente,
  type ReferenteSuelto,
} from "@/services/referentes.service";

interface ReferentesEditorProps {
  clienteId: number;
  clienteNombre: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardado: () => void;
}

/**
 * Quién responde por el cliente.
 *
 * Son dos listas separadas porque son dos tablas distintas: garantes externos
 * (`Referentes`, vía /ref_cliente) y clientes de la propia cartera que salen de
 * garantes de otro (`Cliente_ClienteReferente`, vía /cli_cliente).
 *
 * Los dos endpoints **reemplazan la lista entera**, así que se edita todo junto
 * y se guarda de una: mandar una lista incompleta da de baja lo que falte.
 */
export function ReferentesEditor({ open, onOpenChange, ...resto }: ReferentesEditorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* El contenido se monta al abrir: así arranca cargando sin setState
            dentro de un efecto, y al reabrir para otro cliente no quedan las
            listas del anterior. */}
        {open && <Contenido {...resto} onCerrar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Contenido({
  clienteId,
  clienteNombre,
  onGuardado,
  onCerrar,
}: Omit<ReferentesEditorProps, "open" | "onOpenChange"> & { onCerrar: () => void }) {
  const clientes = useAppSelector((s) => s.clientes.items);

  const [referentes, setReferentes] = useState<ReferenteSuelto[]>([]);
  const [idsReferentes, setIdsReferentes] = useState<number[]>([]);
  const [idsClientes, setIdsClientes] = useState<number[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [altaAbierta, setAltaAbierta] = useState(false);

  useEffect(() => {
    let activo = true;

    Promise.all([
      getReferentes(),
      getReferentesDeCliente(clienteId),
      getClientesReferentes(clienteId),
    ])
      .then(([todos, propios, clientesGarantes]) => {
        if (!activo) return;
        setReferentes(todos);
        setIdsReferentes(propios.map((r) => r.id));
        setIdsClientes(clientesGarantes.map((r) => r.id));
      })
      .catch(() => activo && toast.error("No se pudieron cargar los referentes."))
      .finally(() => activo && setCargando(false));

    return () => {
      activo = false;
    };
  }, [clienteId]);

  const alternar = (lista: number[], set: (v: number[]) => void, id: number) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarReferentesDeCliente(clienteId, idsReferentes);
      await guardarClientesReferentes(clienteId, idsClientes);
      toast.success("Referentes actualizados.");
      onGuardado();
      onCerrar();
    } catch {
      toast.error("No se pudieron guardar los referentes.");
    } finally {
      setGuardando(false);
    }
  };

  /** Un referente recién creado entra ya tildado */
  const alCrear = (nuevo: ReferenteSuelto) => {
    setReferentes((r) => [...r, nuevo]);
    setIdsReferentes((ids) => [...ids, nuevo.id]);
    setAltaAbierta(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Referentes de {clienteNombre}</DialogTitle>
        <DialogDescription>
          Quién responde si el cliente deja de pagar. Se guardan las dos listas juntas.
        </DialogDescription>
      </DialogHeader>

      <NotasCliente clienteId={clienteId} />

      {cargando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
                Garantes ({idsReferentes.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setAltaAbierta(true)}>
                <UserPlus />
                Nuevo
              </Button>
            </div>

            {referentes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay referentes cargados todavía. Creá uno con &quot;Nuevo&quot;.
              </p>
            ) : (
              <ul className="max-h-52 space-y-1 overflow-y-auto">
                {referentes.map((r) => (
                  <Fila
                    key={r.id}
                    titulo={r.nombreCompleto}
                    detalle={[r.dni && `DNI ${r.dni}`, r.telefonos[0]?.numero]
                      .filter(Boolean)
                      .join(" · ")}
                    marcado={idsReferentes.includes(r.id)}
                    onToggle={() => alternar(idsReferentes, setIdsReferentes, r.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 border-t pt-3">
            <h3 className="text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
              Otros clientes que lo garantizan ({idsClientes.length})
            </h3>
            <ul className="max-h-52 space-y-1 overflow-y-auto">
              {clientes
                // Un cliente no puede ser garante de sí mismo.
                .filter((c) => c.id !== clienteId)
                .map((c) => (
                  <Fila
                    key={c.id}
                    titulo={c.nombreCompleto}
                    detalle={`DNI ${c.dni}`}
                    marcado={idsClientes.includes(c.id)}
                    onToggle={() => alternar(idsClientes, setIdsClientes, c.id)}
                  />
                ))}
            </ul>
          </section>
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={guardando || cargando}>
          {guardando && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
      </DialogFooter>

      <AltaReferenteDialog open={altaAbierta} onOpenChange={setAltaAbierta} onCreado={alCrear} />
    </>
  );
}

function Fila({
  titulo,
  detalle,
  marcado,
  onToggle,
}: {
  titulo: string;
  detalle: string;
  marcado: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
        <input type="checkbox" checked={marcado} onChange={onToggle} className="size-4" />
        <span className="min-w-0 flex-1 truncate font-medium">{titulo}</span>
        <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">{detalle}</span>
      </label>
    </li>
  );
}

/** Alta de un referente nuevo, sin salir de la ficha del cliente */
function AltaReferenteDialog({
  open,
  onOpenChange,
  onCreado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreado: (nuevo: ReferenteSuelto) => void;
}) {
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefonos, setTelefonos] = useState<string[]>([""]);
  const [guardando, setGuardando] = useState(false);

  const completo = dni.trim() !== "" && nombre.trim() !== "";

  const crear = async () => {
    setGuardando(true);
    const guardables = telefonos.filter(esTelefonoGuardable);
    try {
      const id = await crearReferente({
        dni: dni.trim(),
        nombreCompleto: nombre.trim(),
        direccion: direccion.trim() || null,
        telefonos: guardables,
      });
      toast.success("Referente creado.");
      onCreado({
        id,
        dni: dni.trim(),
        nombreCompleto: nombre.trim(),
        telefonos: guardables.map((numero, i) => ({ id: -i - 1, numero })),
      });
      setDni("");
      setNombre("");
      setDireccion("");
      setTelefonos([""]);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No se pudo crear el referente.";
      toast.error(msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo referente</DialogTitle>
          <DialogDescription>
            Queda creado y tildado como garante de este cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="ref-dni">DNI *</Label>
          <Input
            id="ref-dni"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ref-nombre">Nombre completo *</Label>
          <Input id="ref-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ref-direccion">Dirección</Label>
          <Input
            id="ref-direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </div>

        <TelefonosInput valores={telefonos} onChange={setTelefonos} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X />
            Cancelar
          </Button>
          <Button onClick={crear} disabled={!completo || guardando}>
            {guardando ? <Loader2 className="animate-spin" /> : <Plus />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
