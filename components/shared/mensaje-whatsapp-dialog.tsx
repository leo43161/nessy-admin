"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PlantillasDialog } from "@/components/gestion/plantillas-dialog";
import { aplicarPlantilla, type DatosMensaje } from "@/lib/plantillas";
import { whatsappUrl } from "@/lib/format";
import { LEYENDA_RECLAMO } from "@/lib/estado-cuenta";
import { enviarEstadoCuenta } from "@/lib/compartir";
import { getPlantillas, type Plantilla } from "@/services/plantillas.service";
import { getEstadoDeCuenta } from "@/services/clientes.service";
import { marcarReclamoEnviado } from "@/services/cobros.service";
import type { Telefono } from "@/types";

/**
 * Reclamo por una cuota que no se pudo cobrar.
 *
 * Cuando viene esto, el envío deja de ser "abrir el chat": adjunta el estado
 * de cuenta en PDF y, al salir, marca la cuota como reclamada en la base.
 */
export interface Reclamo {
  cuotaId: number;
  clienteId: number;
  clienteNombre: string;
  clienteDni: string;
  clienteDireccion: string | null;
  /** Para refrescar el tablero cuando la cuota pasa a "Reclamo realizado" */
  onReclamado?: () => void;
}

interface MensajeWhatsappDialogProps {
  telefonos: Telefono[];
  /** Texto ya armado, para los envíos que traen el suyo (estado de cuenta) */
  mensajeInicial?: string;
  /** Con qué se reemplazan los comodines de la plantilla */
  datos?: Partial<DatosMensaje>;
  /** Presente = es un reclamo: va con PDF y queda registrado */
  reclamo?: Reclamo;
  titulo?: string;
  descripcion?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * El paso previo a abrir WhatsApp desde el panel.
 *
 * Antes el botón abría el chat vacío y el admin escribía a mano cada vez. Acá
 * elige el número —si hay más de uno—, elige una plantilla y ve el texto ya
 * armado antes de mandarlo.
 *
 * El texto queda editable a propósito: ninguna plantilla cubre todos los casos,
 * y obligar a mandarla tal cual termina en mensajes que no vienen al caso.
 */
export function MensajeWhatsappDialog({
  telefonos,
  mensajeInicial,
  datos,
  reclamo,
  titulo = "Mensaje por WhatsApp",
  descripcion,
  open,
  onOpenChange,
}: MensajeWhatsappDialogProps) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState(mensajeInicial ?? "");
  const [numero, setNumero] = useState(telefonos[0]?.numero ?? "");
  const [gestionAbierta, setGestionAbierta] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cargar = () => {
    getPlantillas()
      .then(setPlantillas)
      .catch(() => toast.error("No se pudieron cargar las plantillas."))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    if (!open) return;
    let activo = true;
    getPlantillas()
      .then((l) => activo && setPlantillas(l))
      .catch(() => activo && toast.error("No se pudieron cargar las plantillas."))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [open]);

  const elegirPlantilla = (id: string) => {
    const p = plantillas.find((x) => x.id === Number(id));
    if (p) setTexto(aplicarPlantilla(p.mensaje, datos ?? {}));
  };

  /**
   * Un mensaje suelto abre el chat y listo.
   *
   * Un reclamo hace tres cosas más: arma el estado de cuenta en PDF, lo manda
   * adjunto —en el celular con la hoja de compartir; en escritorio no se puede
   * adjuntar desde el navegador, así que se descarga— y deja registrado que se
   * reclamó, que es lo que pinta la cuota de amarillo en el tablero.
   */
  const enviar = async () => {
    if (numero === "") return;

    if (!reclamo) {
      window.open(whatsappUrl(numero, texto.trim() === "" ? undefined : texto), "_blank");
      onOpenChange(false);
      return;
    }

    setEnviando(true);
    try {
      const { estadoDeCuenta } = await getEstadoDeCuenta(reclamo.clienteId);
      const { archivoEstadoCuentaPdf, descargarArchivo } = await import(
        "@/lib/pdf/estado-cuenta-pdf"
      );

      const archivo = await archivoEstadoCuentaPdf(
        estadoDeCuenta,
        {
          nombreCompleto: reclamo.clienteNombre,
          dni: reclamo.clienteDni,
          direccion: reclamo.clienteDireccion,
          localidadNombre: null,
        },
        LEYENDA_RECLAMO,
      );

      const salio = await enviarEstadoCuenta(archivo, texto, numero, descargarArchivo);
      if (!salio) return; // canceló la hoja de compartir: no se mandó nada

      await marcarReclamoEnviado(reclamo.cuotaId);
      toast.success("Reclamo enviado y registrado.");
      reclamo.onReclamado?.();
      onOpenChange(false);
    } catch {
      toast.error("No se pudo generar el reclamo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
          </DialogHeader>

          {/* Un solo teléfono no necesita elección: se muestra y listo. */}
          {telefonos.length > 1 ? (
            <div className="space-y-1.5">
              <Label htmlFor="destinatario-wsp">Número</Label>
              <select
                id="destinatario-wsp"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-sm shadow-xs"
              >
                {telefonos.map((t) => (
                  <option key={t.id} value={t.numero}>
                    {t.numero}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">
              {numero === "" ? "Este contacto no tiene teléfono cargado." : numero}
            </p>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="plantilla-wsp">Plantilla</Label>
              <Button variant="ghost" size="xs" onClick={() => setGestionAbierta(true)}>
                <Settings2 />
                Administrar
              </Button>
            </div>

            {cargando ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : plantillas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay plantillas cargadas. Creá una con &quot;Administrar&quot;, o escribí el
                mensaje a mano acá abajo.
              </p>
            ) : (
              <select
                id="plantilla-wsp"
                onChange={(e) => elegirPlantilla(e.target.value)}
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="">Elegir plantilla</option>
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="texto-wsp">Mensaje</Label>
            <Textarea
              id="texto-wsp"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              placeholder="Elegí una plantilla o escribí el mensaje."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={numero === "" || enviando}>
              {enviando ? <Loader2 className="animate-spin" /> : <MessageCircle />}
              {enviando ? "Generando PDF…" : reclamo ? "Enviar reclamo con PDF" : "Abrir WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlantillasDialog
        open={gestionAbierta}
        onOpenChange={setGestionAbierta}
        onCambio={cargar}
      />
    </>
  );
}
