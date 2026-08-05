export function StatCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 rounded-2xl border-[1.5px] border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3.5 flex items-center gap-1.5 text-[0.73rem] font-bold tracking-[0.07em] text-text-secondary uppercase">
        <span aria-hidden className="h-3.5 w-[3px] shrink-0 rounded-sm bg-primary" />
        {titulo}
      </h2>
      {children}
    </section>
  );
}
