"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DateFilter } from "@/components/layout/date-filter";
import { PlantillasDialog } from "@/components/gestion/plantillas-dialog";
import { APP_NAME } from "@/lib/constants";
import { EMPRESA_NOMBRE } from "@/lib/marca";
import { Isotipo } from "@/components/shared/isotipo";
import { modoDeRuta, usaFiltroDeFecha } from "@/lib/navegacion";
import { formatDayLabel, todayISO } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/slices/auth.slice";

export function Topbar() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const cuenta = useAppSelector((s) => s.auth.cuenta);
  const modo = modoDeRuta(pathname);
  const [plantillasAbierto, setPlantillasAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-[1.5px] border-border bg-card shadow-md">
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        {/* Nombre y logo salen de lib/marca.ts. */}
        <Isotipo className="size-9 rounded-[0.6rem] shadow-sm" />
        <div className="text-xl leading-none font-bold tracking-tight text-primary-dark">
          {EMPRESA_NOMBRE}
        </div>

        <div className="flex-1" />

        {/* Las plantillas se administran desde cualquier pantalla: colgarlas
            solo del reclamo las dejaba inalcanzables los días sin vencidas. */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Plantillas de mensaje"
          title="Plantillas de mensaje"
          onClick={() => setPlantillasAbierto(true)}
        >
          <MessageSquareText />
        </Button>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Cerrar sesión de ${cuenta?.nombreDeUsuario ?? APP_NAME}`}
          title={cuenta?.nombreDeUsuario}
          onClick={() => dispatch(logout())}
        >
          <LogOut />
        </Button>
      </div>

      {usaFiltroDeFecha(modo) ? (
        <DateFilter />
      ) : (
        <div className="px-4 pb-3 text-xs text-muted-foreground">
          Alta y edición de la cartera · {formatDayLabel(todayISO())}
        </div>
      )}

      <PlantillasDialog open={plantillasAbierto} onOpenChange={setPlantillasAbierto} />
    </header>
  );
}
