export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="vw-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--vw-accent)" />
          <stop offset=".55" stopColor="var(--vw-bg-2)" />
          <stop offset="1" stopColor="var(--vw-bg-3)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="var(--vw-elevated)" stroke="var(--vw-border)" />
      <path d="M13 20 L25 46 L32 31 L39 46 L51 20" fill="none" stroke="url(#vw-logo)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="51" cy="13" r="3" fill="var(--vw-text)" opacity=".85" />
    </svg>
  );
}
