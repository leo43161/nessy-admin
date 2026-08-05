"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { SectionHeader } from "@/components/shared/section-header";
import { ClienteFormDialog } from "@/components/gestion/cliente-form-dialog";
import { cn } from "@/lib/utils";
import { CLIENTE_STATUS_BADGE } from "@/lib/status";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { eliminarCliente, fetchClientes } from "@/store/slices/clientes.slice";
import type { ClienteListado } from "@/types";

export default function GestionClientesPage() {
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((s) => s.clientes);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<ClienteListado | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState<ClienteListado | null>(null);

  useEffect(() => {
    if (status === "idle") dispatch(fetchClientes({ cobradorId: null, localidadId: null }));
  }, [status, dispatch]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.nombreCompleto.toLowerCase().includes(q) || c.dni.includes(q));
  }, [items, busqueda]);

  function abrirAlta() {
    setEditando(null);
    setFormAbierto(true);
  }

  function abrirEdicion(cliente: ClienteListado) {
    setEditando(cliente);
    setFormAbierto(true);
  }

  async function confirmarBaja() {
    if (!aEliminar) return;
    const res = await dispatch(eliminarCliente(aEliminar.id));
    setAEliminar(null);
    if (eliminarCliente.fulfilled.match(res)) toast.success("Cliente dado de baja");
    else toast.error(res.payload ?? "No se pudo dar de baja.");
  }

  const cargando = status === "idle" || status === "loading";

  return (
    <>
      <SectionHeader titulo="Clientes" subtitulo={`${items.length} en la cartera`}>
        <Button size="sm" onClick={abrirAlta}>
          <Plus />
          Nuevo
        </Button>
      </SectionHeader>

      <div className="relative px-4 pb-3">
        <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o DNI"
          aria-label="Buscar cliente"
          className="pl-9"
        />
      </div>

      <div className="space-y-2 px-4">
        {cargando ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-18 rounded-xl" />)
        ) : status === "failed" ? (
          <EmptyState icon="⚠️">{error}</EmptyState>
        ) : filtrados.length === 0 ? (
          <EmptyState icon="🔍">
            {busqueda ? "Ningún cliente coincide con la búsqueda." : "Todavía no hay clientes."}
          </EmptyState>
        ) : (
          filtrados.map((cliente) => (
            <article
              key={cliente.id}
              className="flex items-center gap-3 rounded-xl border-[1.5px] border-border bg-card p-3 shadow-sm"
            >
              <InitialsAvatar nombre={cliente.nombreCompleto} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-bold">
                    {cliente.nombreCompleto}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-px text-[0.6rem] font-bold",
                      CLIENTE_STATUS_BADGE[cliente.status],
                    )}
                  >
                    {cliente.status}
                  </span>
                </div>
                <div className="truncate font-mono text-[0.68rem] text-muted-foreground">
                  DNI {cliente.dni} · {cliente.localidadNombre ?? "sin localidad"}
                </div>
                <div className="truncate text-[0.68rem] text-muted-foreground">
                  Cobra: {cliente.cobradorAsignadoNombre ?? "sin asignar"}
                </div>
              </div>

              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${cliente.nombreCompleto}`}
                  onClick={() => abrirEdicion(cliente)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Dar de baja a ${cliente.nombreCompleto}`}
                  onClick={() => setAEliminar(cliente)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <ClienteFormDialog cliente={editando} open={formAbierto} onOpenChange={setFormAbierto} />

      <AlertDialog open={aEliminar !== null} onOpenChange={(o) => !o && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja a {aEliminar?.nombreCompleto}?</AlertDialogTitle>
            <AlertDialogDescription>
              Es una baja lógica: el cliente deja de aparecer, pero su historial de planes y pagos
              queda guardado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarBaja}>Dar de baja</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
