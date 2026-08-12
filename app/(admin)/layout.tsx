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
      <main className="pb-24 sm:pb-8">{children}</main>
      <NavTabs />
    </div>
  );
}
