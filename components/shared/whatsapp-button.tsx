"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MensajeWhatsappDialog } from "@/components/shared/mensaje-whatsapp-dialog";
import type { DatosMensaje } from "@/lib/plantillas";
import type { Telefono } from "@/types";

interface WhatsappButtonProps {
  telefonos: Telefono[];
  /** Texto ya armado, para los envíos que traen el suyo */
  mensaje?: string;
  /** Con qué se reemplazan los comodines de la plantilla elegida */
  datos?: Partial<DatosMensaje>;
  titulo?: string;
  descripcion?: string;
  /** Trigger a mostrar (por defecto, un botón "WhatsApp") */
  children?: React.ReactNode;
}

/**
 * Abre WhatsApp, pero nunca a ciegas.
 *
 * En el panel **todos** los envíos pasan por el mismo paso previo: elegir el
 * número si hay más de uno, elegir una plantilla y revisar el texto. Antes el
 * botón abría el chat vacío y el admin escribía lo mismo veinte veces por día.
 *
 * (En la app del cobrador no: ahí el botón abre el chat directo, porque está
 * parado frente al cliente y no tiene tiempo de elegir nada.)
 */
export function WhatsappButton({
  telefonos,
  mensaje,
  datos,
  titulo,
  descripcion,
  children,
}: WhatsappButtonProps) {
  const [abierto, setAbierto] = useState(false);

  const trigger = children ?? (
    <Button variant="outline" size="sm" disabled={telefonos.length === 0}>
      <MessageCircle />
      WhatsApp
    </Button>
  );

  return (
    <>
      <button
        type="button"
        className="contents"
        disabled={telefonos.length === 0}
        onClick={(e) => {
          // Muchos de estos botones viven dentro de cards clickeables: sin esto
          // se abriría también la ficha detrás del diálogo.
          e.stopPropagation();
          setAbierto(true);
        }}
      >
        {trigger}
      </button>

      {/* Montado solo al abrir: así el texto arranca del `mensaje` de ahora y
          no del que había la primera vez que se renderizó el botón. */}
      {abierto && (
        <MensajeWhatsappDialog
          telefonos={telefonos}
          mensajeInicial={mensaje}
          datos={datos}
          titulo={titulo}
          descripcion={descripcion}
          open
          onOpenChange={setAbierto}
        />
      )}
    </>
  );
}
