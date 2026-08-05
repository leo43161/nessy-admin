import { fmtMoney, formatFecha } from "@/lib/format";
import type { CobroCruzado } from "@/types";

/**
 * Cuotas que cobró un cobrador distinto al asignado.
 *
 * En la DB esto no es una columna: se deduce de que
 * `Pagos_realizados.id_Cobrador` no coincida con el de `Cliente_Cobrador`.
 */
export function CobrosCruzados({ filas }: { filas: CobroCruzado[] }) {
  if (filas.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Sin cobros cruzados.</p>;
  }

  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-[1.5px] border-border text-left">
            {["Fecha", "Cliente", "Asignado", "Cobró", "Monto"].map((th) => (
              <th
                key={th}
                className="px-2 py-1.5 text-[0.63rem] font-bold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase"
              >
                {th}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.cobroId} className="border-b border-border last:border-0">
              <td className="px-2 py-2 text-xs whitespace-nowrap">{formatFecha(fila.fecha)}</td>
              <td className="px-2 py-2 text-xs">{fila.clienteNombre}</td>
              <td className="px-2 py-2 text-xs whitespace-nowrap">{fila.asignadoA}</td>
              <td className="px-2 py-2 text-xs font-bold whitespace-nowrap text-primary">
                {fila.cobradoPor}
              </td>
              <td className="px-2 py-2 font-mono text-xs font-bold whitespace-nowrap text-primary">
                {fmtMoney(fila.monto)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
