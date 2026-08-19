"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MensajeWhatsappDialog, type Reclamo } from "@/components/shared/mensaje-whatsapp-dialog";
import type { DatosMensaje } from "@/lib/plantillas";
import type { Telefono } from "@/types";

interface WhatsappButtonProps {
  telefonos: Telefono[];
  /** Texto ya armado, para los envíos que traen el suyo */
  mensaje?: string;
  /** Con qué se reemplazan los comodines de la plantilla elegida */
  datos?: Partial<DatosMensaje>;
  /** Presente = es un reclamo: va con PDF y queda registrado */
  reclamo?: Reclamo;
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
  reclamo,
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
      {/* Un <span> y no un <button>: el trigger YA es un botón, y anidar dos
          es HTML inválido — React tira un error de hidratación y el navegador
          arma un DOM distinto al del servidor. `contents` hace que el wrapper
          no ocupe lugar, y el click llega igual desde el botón de adentro, que
          es el que recibe foco y responde al Enter. */}
      <span
        className="contents"
        onClick={(e) => {
          // Muchos de estos botones viven dentro de cards clickeables: sin esto
          // se abriría también la ficha detrás del diálogo.
          e.stopPropagation();
          if (telefonos.length > 0) setAbierto(true);
        }}
      >
        {trigger}
      </span>

      {/* Montado solo al abrir: así el texto arranca del `mensaje` de ahora y
          no del que había la primera vez que se renderizó el botón.

          El `stopPropagation` del wrapper no es de más: un portal de React
          manda sus eventos por el árbol de COMPONENTES, no por el DOM. Este
          botón vive dentro de cards clickeables, así que cada click en el
          diálogo —incluido abrir el select de plantilla— llegaba al onClick de
          la card y abría la ficha del cliente por detrás.

          `display: contents` para que el wrapper no ocupe lugar en el flex de
          la card. */}
      {abierto && (
        <span
          className="contents"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <MensajeWhatsappDialog
            telefonos={telefonos}
            mensajeInicial={mensaje}
            datos={datos}
            reclamo={reclamo}
            titulo={titulo}
            descripcion={descripcion}
            open
            onOpenChange={setAbierto}
          />
        </span>
      )}
    </>
  );
}
