interface SectionHeadingProps {
  children: React.ReactNode;
}

export function SectionHeading({ children }: SectionHeadingProps) {
  return (
    <h2 className="text-lg font-bold text-primary uppercase tracking-wide mb-4 flex items-center gap-3">
      <span>{children}</span>
      <div className="flex-1 h-px bg-[var(--neutral-600)]" />
    </h2>
  );
}
