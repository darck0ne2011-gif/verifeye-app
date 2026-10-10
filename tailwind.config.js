/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Surfaces (dark theme only, for now)
        bg: '#0b1220',
        surface: {
          DEFAULT: '#111a2b',
          2: '#172238',
          3: '#1f2c45',
        },
        line: '#243149',
        // Text
        fg: '#e6ecf5',
        muted: '#8fa0b8',
        // One accent, plus the three verdict colors
        accent: {
          DEFAULT: '#22d3ee',
          hover: '#06b6d4',
          soft: 'rgba(34, 211, 238, 0.14)',
        },
        real: { DEFAULT: '#34d399', soft: 'rgba(52, 211, 153, 0.14)' },
        unclear: { DEFAULT: '#fbbf24', soft: 'rgba(251, 191, 36, 0.14)' },
        ai: { DEFAULT: '#f87171', soft: 'rgba(248, 113, 113, 0.14)' },
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 10px 30px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(34,211,238,0.35), 0 10px 40px -10px rgba(34,211,238,0.45)',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out forwards',
        'slide-up': 'slideUp 0.35s ease-out forwards',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
