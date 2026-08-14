"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
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
import {
  aplicarPlantilla,
  comodinesDesconocidos,
  COMODINES,
  EJEMPLO,
} from "@/lib/plantillas";
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
      {/* Sin pantalla completa en móvil, a diferencia de la ficha y los
          formularios: acá el contenido es corto —una lista de dos o tres
          plantillas— y forzar `h-dvh` estiraba las filas del grid hasta llenar
          la pantalla, dejando el encabezado de 60px ocupando 200. */}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
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
  const [aBorrar, setABorrar] = useState<Plantilla | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Cómo va a leerlo el cliente, con datos de mentira.
  const vistaPrevia = aplicarPlantilla(mensaje, EJEMPLO);
  const desconocidos = comodinesDesconocidos(mensaje);

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

  const borrar = async () => {
    if (!aBorrar) return;
    try {
      await eliminarPlantilla(aBorrar.id);
      toast.success("Plantilla eliminada.");
      setABorrar(null);
      await recargar();
    } catch {
      toast.error("No se pudo eliminar.");
    }
  };

  /**
   * Inserta el comodín donde está el cursor, no al final.
   *
   * Al final servía solo si se escribía de corrido: para meter `{monto}` en
   * medio de una frase ya escrita había que cortar y pegar a mano.
   */
  const insertarComodin = (clave: string) => {
    const el = textarea.current;
    const marca = `{${clave}}`;

    if (!el) {
      setMensaje((m) => m + marca);
      return;
    }

    const { selectionStart: desde, selectionEnd: hasta } = el;
    setMensaje((m) => m.slice(0, desde) + marca + m.slice(hasta));

    // El cursor queda después de lo insertado, listo para seguir escribiendo.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(desde + marca.length, desde + marca.length);
    });
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
              ref={textarea}
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
                  onClick={() => insertarComodin(c.clave)}
                  className="rounded-full border border-input px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground hover:text-foreground"
                >
                  {`{${c.clave}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Un comodín mal escrito sale crudo al chat y no hay forma de
              deshacerlo: se avisa acá, que es cuando se puede corregir. */}
          {desconocidos.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {desconocidos.map((c) => `{${c}}`).join(", ")}{" "}
                {desconocidos.length === 1 ? "no existe" : "no existen"} y se van a mandar tal
                cual. Usá los de la lista.
              </span>
            </p>
          )}

          {/* Cómo lo va a leer el cliente. El admin escribe {monto} y sin esto
              no sabe cómo queda hasta que se lo manda a alguien. */}
          {mensaje.trim() !== "" && (
            <div className="space-y-1">
              <div className="text-[0.68rem] font-bold tracking-wider text-muted-foreground uppercase">
                Así lo recibe el cliente
              </div>
              <p className="rounded-lg rounded-bl-none bg-[#25D366]/15 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap">
                {vistaPrevia}
              </p>
            </div>
          )}

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
                        onClick={() => setABorrar(p)}
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

      {/* Antes el tacho borraba de una. Es baja lógica y no se pierde nada en
          la base, pero desde el panel no hay forma de recuperarla. */}
      <AlertDialog open={aBorrar !== null} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{aBorrar?.titulo}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer al mandar mensajes. Los que ya enviaste no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrar}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
