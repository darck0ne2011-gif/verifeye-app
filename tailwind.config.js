/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'dropdown-in': 'dropdownIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        dropdownIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      colors: {
        verifeye: {
          dark: '#1A1A1A',
          card: '#252525',
          accent: '#66FF00',
          'accent-hover': '#52cc00',
          muted: '#9ca3af',
          warning: '#FF4444',
        }
      }
    },
  },
  plugins: [],
}
