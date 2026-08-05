interface EmptyStateProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

export function EmptyState({ icon, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center text-muted-foreground">
      <div className="text-4xl [&_svg]:size-10">{icon}</div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
