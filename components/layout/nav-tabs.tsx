"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MODOS, modoDeRuta } from "@/lib/navegacion";

/** Pestañas del modo activo. En móvil scrollean horizontalmente. */
export function NavTabs() {
  const pathname = usePathname();
  const tabs = MODOS[modoDeRuta(pathname)].tabs;

  return (
    <nav className="scrollbar-none flex gap-0.5 overflow-x-auto border-b-2 border-border bg-card px-2">
      {tabs.map((tab) => {
        const activo = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "-mb-0.5 flex min-w-20 flex-1 flex-col items-center gap-0.5 border-b-[2.5px] px-2 pt-2.5 pb-2 text-xs font-semibold whitespace-nowrap transition-colors",
              activo
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="text-base leading-none">{tab.icono}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
