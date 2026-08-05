"use client";

import { usePathname } from "next/navigation";
import { Activity, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ModoSwitch } from "@/components/layout/modo-switch";
import { NavTabs } from "@/components/layout/nav-tabs";
import { DateFilter } from "@/components/layout/date-filter";
import { APP_NAME } from "@/lib/constants";
import { modoDeRuta, usaFiltroDeFecha } from "@/lib/navegacion";
import { formatDayLabel, todayISO } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/slices/auth.slice";

export function Topbar() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const cuenta = useAppSelector((s) => s.auth.cuenta);
  const modo = modoDeRuta(pathname);

  return (
    <header className="sticky top-0 z-50 border-b-[1.5px] border-border bg-card shadow-md">
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <div className="flex size-8.5 items-center justify-center rounded-[0.6rem] bg-gradient-to-br from-primary to-sky shadow-[0_2px_8px_rgba(26,111,232,0.3)]">
          <Activity className="size-4.5 text-white" strokeWidth={2.5} />
        </div>
        <div className="text-[1.05rem] leading-none font-bold tracking-tight text-primary-dark">
          Nessy<span className="text-sky">Admin</span>
        </div>

        <div className="flex-1" />

        <ModoSwitch modo={modo} />
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

      <NavTabs />
    </header>
  );
}
