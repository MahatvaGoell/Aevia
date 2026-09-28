export function MoonArt({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 120 96" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx=".35" cy=".35" r=".8">
          <stop offset="0" stopColor="#F3DDB8" />
          <stop offset=".6" stopColor="#A9855E" />
          <stop offset="1" stopColor="#3A2C1F" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="48" rx="54" ry="30" fill="none" stroke="#5A4836" strokeWidth="1" />
      <ellipse cx="60" cy="48" rx="40" ry="44" fill="none" stroke="#3E362C" strokeWidth="1" transform="rotate(35 60 48)" />
      <circle cx="60" cy="48" r="24" fill={`url(#${id})`} />
      <circle cx="112" cy="40" r="3" fill="#EDCFA3" />
      <circle cx="14" cy="62" r="2" fill="#C9A176" />
      <circle cx="84" cy="10" r="1.6" fill="#C9A176" />
    </svg>
  );
}

export function Ring({ value, id, size = 92 }: { value: number; id: string; size?: number }) {
  const c = 2 * Math.PI * 38;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg viewBox="0 0 92 92" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EFD2A6" />
          <stop offset="1" stopColor="#8E6A48" />
        </linearGradient>
      </defs>
      <circle cx="46" cy="46" r="38" fill="none" stroke="#2E2923" strokeWidth="7" />
      <circle cx="46" cy="46" r="38" fill="none" stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * v).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 46 46)" />
      <text x="46" y="52" textAnchor="middle" fill="#EEE7DB" fontFamily="var(--body)" fontSize="20" fontWeight="600">
        {Math.round(v * 100)}%
      </text>
    </svg>
  );
}
