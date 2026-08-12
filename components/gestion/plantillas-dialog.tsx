"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COMODINES } from "@/lib/plantillas";
import {
  crearPlantilla,
  editarPlantilla,
  eliminarPlantilla,
  getPlantillas,
  type Plantilla,
} from "@/services/plantillas.service";

/**
 * ABM de plantillas de mensaje.
 *
 * Los textos los escribe el admin: el sistema no trae ninguno porque cada
 * cartera le habla distinto a su gente. Los comodines entre llaves se
 * reemplazan al mandar el mensaje.
 */
export function PlantillasDialog({
  open,
  onOpenChange,
  onCambio,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Avisa que la lista cambió, para que quien la esté usando la recargue */
  onCambio?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg max-sm:h-dvh max-sm:max-h-none max-sm:max-w-full max-sm:rounded-none">
        {open && <Contenido onCerrar={() => onOpenChange(false)} onCambio={onCambio} />}
      </DialogContent>
    </Dialog>
  );
}

function Contenido({ onCerrar, onCambio }: { onCerrar: () => void; onCambio?: () => void }) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // null = no se está editando nada; 0 = alta nueva
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");

  const recargar = async () => {
    const lista = await getPlantillas().catch(() => {
      toast.error("No se pudieron cargar las plantillas.");
      return [] as Plantilla[];
    });
    setPlantillas(lista);
    setCargando(false);
    onCambio?.();
  };

  // La carga inicial va con promesas y no llamando a `recargar`: el estado se
  // toca recién en el `.then`, nunca en el cuerpo del efecto.
  useEffect(() => {
    let activo = true;
    getPlantillas()
      .then((l) => activo && setPlantillas(l))
      .catch(() => activo && toast.error("No se pudieron cargar las plantillas."))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  const abrirAlta = () => {
    setEditandoId(0);
    setTitulo("");
    setMensaje("");
  };

  const abrirEdicion = (p: Plantilla) => {
    setEditandoId(p.id);
    setTitulo(p.titulo);
    setMensaje(p.mensaje);
  };

  const guardar = async () => {
    if (titulo.trim() === "" || mensaje.trim() === "") return;
    setGuardando(true);
    try {
      if (editandoId === 0) await crearPlantilla(titulo.trim(), mensaje.trim());
      else if (editandoId != null) await editarPlantilla(editandoId, titulo.trim(), mensaje.trim());
      toast.success("Plantilla guardada.");
      setEditandoId(null);
      await recargar();
    } catch {
      toast.error("No se pudo guardar la plantilla.");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (p: Plantilla) => {
    try {
      await eliminarPlantilla(p.id);
      toast.success("Plantilla eliminada.");
      await recargar();
    } catch {
      toast.error("No se pudo eliminar.");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Plantillas de mensaje</DialogTitle>
        <DialogDescription>
          Los textos que se le mandan al cliente por WhatsApp.
        </DialogDescription>
      </DialogHeader>

      {editandoId !== null ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="plantilla-titulo">Título</Label>
            <Input
              id="plantilla-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Recordatorio de cuota vencida"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plantilla-mensaje">Mensaje</Label>
            <Textarea
              id="plantilla-mensaje"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={5}
              placeholder="Hola {cliente}, tenés una cuota de {monto} vencida hace {dias} días."
            />
            <div className="flex flex-wrap gap-1">
              {/* Se insertan con un click: escribirlos a mano es la forma más
                  fácil de equivocarse y que el comodín salga crudo. */}
              {COMODINES.map((c) => (
                <button
                  key={c.clave}
                  type="button"
                  title={c.ejemplo}
                  onClick={() => setMensaje((m) => `${m}{${c.clave}}`)}
                  className="rounded-full border border-input px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground hover:text-foreground"
                >
                  {`{${c.clave}}`}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={guardando || titulo.trim() === "" || mensaje.trim() === ""}
            >
              {guardando && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </>
      ) : (
        <>
          {cargando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : plantillas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Todavía no hay plantillas. Creá la primera.
            </p>
          ) : (
            <ul className="space-y-2">
              {plantillas.map((p) => (
                <li key={p.id} className="rounded-lg border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 text-sm font-semibold">{p.titulo}</span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Editar ${p.titulo}`}
                        onClick={() => abrirEdicion(p)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Eliminar ${p.titulo}`}
                        onClick={() => borrar(p)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
                    {p.mensaje}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onCerrar}>
              Cerrar
            </Button>
            <Button onClick={abrirAlta}>
              <Plus />
              Nueva plantilla
            </Button>
          </DialogFooter>
        </>
      )}
    </>
  );
}
