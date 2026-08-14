"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { ReferentesEditor } from "@/components/gestion/referentes-editor";
import { getClientesReferentes, getReferentesDeCliente } from "@/services/referentes.service";
import { cn } from "@/lib/utils";
import type { ReferenteDeCliente } from "@/types";

interface ReferentesClienteProps {
  clienteId: number;
  clienteNombre: string;
  /** Ya cargados por la ficha: evitan pedirlos de nuevo */
  referentes?: ReferenteDeCliente[];
  /** Arranca plegado — en el modal de cobro, para no empujar el botón abajo */
  plegado?: boolean;
  /** Sin esto no se muestra el botón de editar (el cobro no es lugar para eso) */
  editable?: boolean;
  onEditado?: () => void;
}

/**
 * Quién responde por el cliente, con su WhatsApp a un toque.
 *
 * El teléfono del garante hace falta justo cuando el cliente no atiende, así
 * que va donde se está trabajando —la ficha y el cobro— y no detrás de otra
 * pantalla.
 */
export function ReferentesCliente({
  clienteId,
  clienteNombre,
  referentes,
  plegado = false,
  editable = false,
  onEditado,
}: ReferentesClienteProps) {
  const [propios, setPropios] = useState<ReferenteDeCliente[] | null>(referentes ?? null);
  const [abierto, setAbierto] = useState(!plegado);
  const [editorAbierto, setEditorAbierto] = useState(false);

  useEffect(() => {
    if (referentes) return;
    let activo = true;
    Promise.all([getReferentesDeCliente(clienteId), getClientesReferentes(clienteId)])
      .then(([externos, clientes]) => activo && setPropios([...externos, ...clientes]))
      .catch(() => activo && setPropios([]));
    return () => {
      activo = false;
    };
  }, [clienteId, referentes]);

  if (propios === null) return <Skeleton className="h-10" />;

  // Sin referentes y sin poder editarlos no hay nada que mostrar; con permiso
  // de edición sí, porque el vacío es justo lo que hay que corregir.
  if (propios.length === 0 && !editable) return null;

  return (
    <>
      <section className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            className="flex items-center gap-1.5 text-[0.7rem] font-bold tracking-[0.06em] text-muted-foreground uppercase"
          >
            <Users className="size-3.5" />
            Referentes ({propios.length})
            <ChevronDown className={cn("size-3.5 transition-transform", abierto && "rotate-180")} />
          </button>

          {editable && (
            <Button variant="ghost" size="sm" onClick={() => setEditorAbierto(true)}>
              Editar
            </Button>
          )}
        </div>

        {abierto &&
          (propios.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nadie responde por este cliente.</p>
          ) : (
            <ul className="space-y-1.5">
              {propios.map((ref) => (
                <li
                  key={`${ref.tipo}-${ref.id}`}
                  className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1.5 text-xs"
                >
                  <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-bold text-primary">
                    {ref.tipo}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{ref.nombreCompleto}</div>
                    <div className="truncate font-mono text-[0.62rem] text-muted-foreground">
                      {[ref.dni && `DNI ${ref.dni}`, ref.direccion].filter(Boolean).join(" · ") ||
                        "—"}
                    </div>
                  </div>
                  {ref.telefonos.length > 0 && <WhatsappButton telefonos={ref.telefonos} />}
                </li>
              ))}
            </ul>
          ))}
      </section>

      {editable && editorAbierto && (
        <ReferentesEditor
          clienteId={clienteId}
          clienteNombre={clienteNombre}
          open
          onOpenChange={(o) => !o && setEditorAbierto(false)}
          onGuardado={() => onEditado?.()}
        />
      )}
    </>
  );
}
