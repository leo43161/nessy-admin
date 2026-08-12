"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";
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
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { PlantillasDialog } from "@/components/gestion/plantillas-dialog";
import { aplicarPlantilla } from "@/lib/plantillas";
import { getPlantillas, type Plantilla } from "@/services/plantillas.service";
import { diasEntre } from "@/lib/cuotas";
import { fmtMoney, formatFecha, todayISO } from "@/lib/format";
import type { CobroDelDia } from "@/types";

/**
 * Mensaje al cliente que se atrasó.
 *
 * El texto sale de una plantilla que escribió el admin, con los datos del
 * cliente y de la cuota ya reemplazados. Queda editable antes de mandarlo:
 * una plantilla nunca cubre todos los casos y obligar a usarla tal cual
 * termina en mensajes que no vienen al caso.
 */
export function MensajeAtrasoDialog({
  cobro,
  open,
  onOpenChange,
}: {
  cobro: CobroDelDia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [gestionAbierta, setGestionAbierta] = useState(false);

  const hoy = todayISO();
  const dias = cobro ? diasEntre(cobro.fechaAcordada, hoy) : 0;

  const cargar = () => {
    getPlantillas()
      .then(setPlantillas)
      .catch(() => toast.error("No se pudieron cargar las plantillas."))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    if (!open) return;
    cargar();
  }, [open]);

  if (!cobro) return null;

  const datos = {
    cliente: cobro.cliente.nombreCompleto.split(" ")[0],
    monto: fmtMoney(cobro.montoEsperado),
    fecha: formatFecha(cobro.fechaAcordada),
    dias,
    plan: cobro.planNombre,
  };

  const elegir = (id: string) => {
    const p = plantillas.find((x) => x.id === Number(id));
    setTexto(p ? aplicarPlantilla(p.mensaje, datos) : "");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mensaje por atraso</DialogTitle>
            <DialogDescription>
              {cobro.cliente.nombreCompleto} · {fmtMoney(cobro.montoEsperado)} vencidos hace{" "}
              {dias} {dias === 1 ? "día" : "días"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="plantilla">Plantilla</Label>
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
                id="plantilla"
                onChange={(e) => elegir(e.target.value)}
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
            <Label htmlFor="texto-mensaje">Mensaje</Label>
            <Textarea
              id="texto-mensaje"
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
            <WhatsappButton telefonos={cobro.cliente.telefonos} mensaje={texto}>
              <Button disabled={texto.trim() === "" || cobro.cliente.telefonos.length === 0}>
                Abrir WhatsApp
              </Button>
            </WhatsappButton>
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
