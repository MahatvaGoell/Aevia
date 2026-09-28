/** The Aevia mark: an A whose crossbar is a gold horizon arc. */
export function Mark({ id, className = "mark" }: { id: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8E6A48" />
          <stop offset=".55" stopColor="#C9A176" />
          <stop offset="1" stopColor="#EFD2A6" />
        </linearGradient>
      </defs>
      <path d="M49 5 L57 5 L88 90 L70 90 L52 36 Z" fill="currentColor" />
      <path d="M49 5 L52 12 L26 90 L20 90 Z" fill="currentColor" />
      <path d="M13 90 C30 66 55 49 86 50 C62 55 40 68 24 90 Z" fill={`url(#${id})`} />
    </svg>
  );
}

export function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
