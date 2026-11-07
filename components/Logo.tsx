/** PETE Curriculum Mapper mark: a curriculum grid with a path climbing from I (blue) through R (amber) to M (green). */
export function LogoMark({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="64" height="64" rx="14" fill="#1F4E79" />
      <g fill="#FFFFFF" fillOpacity="0.16">
        <rect x="9" y="9" width="13" height="13" rx="3.5" />
        <rect x="25.5" y="9" width="13" height="13" rx="3.5" />
        <rect x="9" y="25.5" width="13" height="13" rx="3.5" />
        <rect x="42" y="25.5" width="13" height="13" rx="3.5" />
        <rect x="25.5" y="42" width="13" height="13" rx="3.5" />
        <rect x="42" y="42" width="13" height="13" rx="3.5" />
      </g>
      <path d="M15.5 48.5 L32 32 L48.5 15.5" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9" />
      <rect x="9" y="42" width="13" height="13" rx="3.5" fill="#7AA7FF" />
      <rect x="25.5" y="25.5" width="13" height="13" rx="3.5" fill="#F5B14C" />
      <rect x="42" y="9" width="13" height="13" rx="3.5" fill="#5BD18A" />
    </svg>
  );
}

/** Mark + "PETE / Curriculum Mapper" wordmark. */
export function Logo({ size = 40, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <span className="logo-lockup">
      <LogoMark size={size} />
      <span className="logo-words">
        <span className="logo-pete">PETE</span>
        <span className="logo-cm">Curriculum Mapper</span>
        {subtitle && <span className="logo-sub">{subtitle}</span>}
      </span>
    </span>
  );
}
