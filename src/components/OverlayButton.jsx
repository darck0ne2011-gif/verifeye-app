export default function OverlayButton({ onClick, disabled = false, faded = false, mode = 'default' }) {
  const isNewScanMode = mode === 'newScan'
  const isDisabled = disabled || faded
  const isInteractive = !isDisabled

  const getButtonContent = () => {
    if (disabled && !faded) return 'Out of Credits'
    if (isNewScanMode) return 'NEW SEARCH'
    return 'START SCANNING'
  }

  const getBaseStyles = () => {
    if (disabled && !faded) {
      return {
        background: 'rgb(71 85 105)',
        boxShadow: 'none',
      }
    }
    if (faded) {
      return {
        background: 'rgba(51, 65, 85, 0.6)',
        boxShadow: 'none',
        opacity: 0.5,
      }
    }
    if (isNewScanMode) {
      return {
        background: 'radial-gradient(ellipse 80% 80% at 35% 35%, rgba(52,211,153,0.9) 0%, rgba(20,184,166,0.85) 45%, rgba(13,148,136,0.8) 75%, rgba(6,95,70,0.85) 100%)',
        boxShadow: `
          inset 0 0 80px rgba(255,255,255,0.1),
          inset 0 -25px 50px rgba(0,0,0,0.25),
          0 0 50px rgba(52,211,153,0.5),
          0 0 90px rgba(20,184,166,0.35),
          0 0 130px rgba(20,184,166,0.12)
        `,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }
    }
    return {
      background: 'radial-gradient(ellipse 80% 80% at 35% 35%, rgba(34,211,238,0.9) 0%, rgba(168,85,247,0.85) 50%, rgba(88,28,135,0.85) 100%)',
      boxShadow: `
        inset 0 0 80px rgba(255,255,255,0.08),
        inset 0 -25px 50px rgba(0,0,0,0.3),
        0 0 50px rgba(34,211,238,0.45),
        0 0 90px rgba(168,85,247,0.35),
        0 0 130px rgba(168,85,247,0.12)
      `,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }
  }

  const getTextStyles = () => {
    if (disabled && !faded) return 'text-slate-500'
    if (faded) return 'text-slate-400'
    return 'text-white font-extrabold drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] drop-shadow-[0_0_1px_rgba(255,255,255,0.3)]'
  }

  const baseStyles = getBaseStyles()

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={baseStyles}
      className={`
        relative w-56 h-56 md:w-64 md:h-64 rounded-full
        flex items-center justify-center
        transition-all duration-300 ease-out
        disabled:cursor-not-allowed disabled:hover:scale-100
        ${isInteractive ? 'hover:scale-105 active:scale-[1.02]' : 'hover:scale-100'}
      `}
    >
      <span className={`font-extrabold text-xs md:text-sm tracking-widest uppercase px-6 text-center leading-tight ${getTextStyles()}`}>
        {getButtonContent()}
      </span>
    </button>
  )
}
