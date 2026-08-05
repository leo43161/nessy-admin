"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { BalanceGlobal } from "@/components/cierre/balance-global";
import { LedgerCobrador } from "@/components/cierre/ledger-cobrador";
import { balanceDelPeriodo, cierrePorCobrador } from "@/lib/agregados";
import { usePeriodo } from "@/hooks/use-periodo";

export default function CierrePage() {
  const { cobros, cobradores, hoy, cargando, error, etiquetaRango } = usePeriodo();

  const balance = useMemo(() => balanceDelPeriodo(cobros, hoy), [cobros, hoy]);
  const cierres = useMemo(
    () => cierrePorCobrador(cobros, cobradores, hoy),
    [cobros, cobradores, hoy],
  );

  return (
    <>
      <SectionHeader titulo="Cierre de caja" subtitulo={etiquetaRango} />

      <div className="px-4">
        {cargando ? (
          <div className="space-y-3">
            <Skeleton className="h-46 rounded-3xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : error ? (
          <EmptyState icon="⚠️">{error}</EmptyState>
        ) : (
          <>
            <BalanceGlobal balance={balance} />
            {cierres.length === 0 ? (
              <EmptyState icon="💸">Sin movimientos en este período.</EmptyState>
            ) : (
              cierres.map((cierre) => <LedgerCobrador key={cierre.cobradorId} cierre={cierre} />)
            )}
          </>
        )}
      </div>
    </>
  );
}
