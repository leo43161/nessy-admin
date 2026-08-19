"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, PiggyBank, Receipt, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { TABS, type Tab } from "@/lib/navegacion";

const ICONOS = {
  operaciones: ClipboardList,
  cierre: Wallet,
  balance: PiggyBank,
  analisis: BarChart3,
  clientes: Users,
  financiaciones: Receipt,
} satisfies Record<Tab["icono"], React.ElementType>;

/**
 * Navegación única del panel.
 *
 * En el teléfono va fija abajo, donde llega el pulgar, y `env(safe-area-inset-bottom)`
 * la levanta por encima de la barra de gestos. Desde `sm` pasa a ser una franja
 * vertical pegada a la izquierda, para no comerle alto al kanban y al análisis,
 * que son las dos pantallas anchas.
 *
 * Son cinco solapas y en un celular angosto entran justas: por eso el texto es
 * chico y el icono hace el trabajo de identificarlas.
 */
export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones del panel"
      className={cn(
        "fixed z-50 border-border bg-card",
        // Móvil: barra inferior de lado a lado
        "inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgb(0_0_0/0.06)]",
        // Escritorio: franja vertical a la izquierda
        "sm:inset-x-auto sm:top-0 sm:left-0 sm:h-dvh sm:w-18 sm:border-t-0 sm:border-r sm:pb-0 sm:shadow-none",
      )}
    >
      <div className="grid grid-cols-6 sm:flex sm:h-full sm:flex-col sm:gap-1 sm:pt-3">
        {TABS.map((tab) => {
          const Icono = ICONOS[tab.icono];
          // startsWith y no ===: /gestion/clientes mantiene la solapa marcada
          // aunque en el futuro cuelguen subrutas.
          const activo = pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[0.58rem] font-semibold transition-colors sm:mx-1.5 sm:min-h-16 sm:rounded-xl sm:text-[0.6rem]",
                activo
                  ? "text-primary sm:bg-primary/10"
                  : "text-muted-foreground hover:text-foreground sm:hover:bg-secondary",
              )}
            >
              <Icono className="size-5" />
              <span className="w-full truncate text-center">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
