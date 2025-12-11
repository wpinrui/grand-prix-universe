interface SectionHeadingProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeading({ children, className = '' }: SectionHeadingProps) {
  const baseClass = 'text-lg font-bold text-primary uppercase tracking-wide mb-4 flex items-center gap-3';
  const combinedClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <h2 className={combinedClass}>
      <span>{children}</span>
      <div className="flex-1 h-px bg-[var(--neutral-600)]" />
    </h2>
  );
}
