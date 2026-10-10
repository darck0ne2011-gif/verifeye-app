/** The VerifEye mark (same drawing as public/icons/icon.svg, without the tile). */
export default function Logo({ className = 'w-8 h-8' }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="verifeye-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path
        d="M56 256c48-88 116-132 200-132s152 44 200 132c-48 88-116 132-200 132S104 344 56 256z"
        fill="none"
        stroke="url(#verifeye-logo-gradient)"
        strokeWidth="34"
        strokeLinejoin="round"
      />
      <circle cx="256" cy="256" r="70" fill="url(#verifeye-logo-gradient)" />
      <circle cx="256" cy="256" r="26" fill="#0b1220" />
      <path
        d="M186 356l48 48 100-112"
        fill="none"
        stroke="#0b1220"
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M186 356l48 48 100-112"
        fill="none"
        stroke="#34d399"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
