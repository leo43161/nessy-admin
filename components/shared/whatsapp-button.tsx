"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { whatsappUrl } from "@/lib/format";
import type { Telefono } from "@/types";

interface WhatsappButtonProps {
  telefonos: Telefono[];
  mensaje?: string;
  /** Trigger a mostrar (por defecto, un botón "WhatsApp") */
  children?: React.ReactNode;
}

/**
 * Abre WhatsApp. Con varios teléfonos muestra un menú para elegir cuál;
 * con uno solo abre directo.
 */
export function WhatsappButton({ telefonos, mensaje, children }: WhatsappButtonProps) {
  const abrir = (numero: string) => window.open(whatsappUrl(numero, mensaje), "_blank");

  const trigger = children ?? (
    <Button variant="outline" size="sm" disabled={telefonos.length === 0}>
      <MessageCircle />
      WhatsApp
    </Button>
  );

  if (telefonos.length <= 1) {
    return (
      <button
        type="button"
        className="contents"
        disabled={telefonos.length === 0}
        onClick={() => telefonos[0] && abrir(telefonos[0].numero)}
      >
        {trigger}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Elegí el número</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {telefonos.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => abrir(t.numero)}>
            <MessageCircle />
            {t.numero}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
