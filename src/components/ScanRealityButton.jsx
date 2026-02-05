const MagnifyingGlassIcon = () => (
  <svg className="w-8 h-8 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

export default function ScanRealityButton({ onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        flex items-center justify-center gap-3
        w-72 h-72 rounded-full
        bg-verifeye-accent hover:bg-verifeye-accent-hover active:bg-verifeye-accent-hover
        text-white font-bold text-xl md:text-2xl
        shadow-[0_0_40px_rgba(102,255,0,0.4)]
        transition-all duration-200
        hover:scale-[1.02] active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
      "
    >
      <MagnifyingGlassIcon />
      <span>Scan Reality</span>
    </button>
  )
}
