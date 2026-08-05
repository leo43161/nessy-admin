export function SectionHeader({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  /** Acción o contador alineado a la derecha */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2.5">
      <div className="min-w-0">
        <h1 className="text-base font-bold">{titulo}</h1>
        {subtitulo && <div className="mt-px text-xs text-muted-foreground">{subtitulo}</div>}
      </div>
      {children}
    </div>
  );
}

/** Contador redondo de la derecha del encabezado */
export function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 font-mono text-[0.7rem] font-bold text-primary-foreground">
      {children}
    </span>
  );
}
