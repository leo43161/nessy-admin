"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { NavTabs } from "@/components/layout/nav-tabs";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { restoreSession } from "@/store/slices/auth.slice";
import { initRango } from "@/store/slices/ui.slice";
import { fetchCobradores } from "@/store/slices/admin.slice";
import { RANURA_ACCIONES } from "@/components/shared/acciones-fab";

/**
 * Shell del panel: restaura la sesión guardada y el filtro de fecha antes de
 * renderizar nada. proxy.ts ya corta el acceso sin cookie; esto cubre el
 * token expirado. Los cobradores se cargan una vez acá porque los tres tabs
 * los necesitan para ordenar columnas y asignar colores.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.auth.status);
  const cobradoresStatus = useAppSelector((s) => s.admin.cobradores.status);

  useEffect(() => {
    dispatch(initRango());
  }, [dispatch]);

  useEffect(() => {
    if (status === "idle") dispatch(restoreSession());
    if (status === "unauthenticated") router.replace("/login");
  }, [status, dispatch, router]);

  useEffect(() => {
    if (status === "authenticated" && cobradoresStatus === "idle") {
      dispatch(fetchCobradores());
    }
  }, [status, cobradoresStatus, dispatch]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    // La navegación es fija: abajo en el teléfono (pb-24 para que no tape el
    // final del listado) y como franja a la izquierda desde `sm` (pl-18).
    <div className="min-h-screen bg-background sm:pl-18">
      <Topbar />
      {/* El colchón de abajo tiene que despejar DOS cosas fijas: la barra de
          navegación y el botón de opciones que flota encima de ella. En el
          teléfono eso son 56 px de barra + 68 px de botón; desde `sm` la
          navegación pasa al costado y solo queda el botón. Con menos, la
          última fila de cualquier listado queda cortada y no hay forma de
          scrollear para verla. */}
      <main className="pb-36 sm:pb-24">{children}</main>
      <NavTabs />

      {/* Hueco del botón de acciones (AccionesFab se dibuja acá por portal).
          Va en el layout y no en cada pantalla porque dónde entra depende del
          armazón: en el teléfono la navegación es una barra al pie de 56 px y
          el botón tiene que quedar arriba de ella; desde `sm` la navegación
          pasa a ser la franja lateral de 72 px y abajo queda libre.
          `pointer-events-none` para que el hueco no tape los clics del listado
          que hay detrás; el botón se los devuelve. */}
      <div
        id={RANURA_ACCIONES}
        className="pointer-events-none fixed bottom-[calc(4.25rem_+_env(safe-area-inset-bottom))] left-0 z-50 pl-4 sm:bottom-6 sm:left-18"
      />
    </div>
  );
}
