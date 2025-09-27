/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular'],
      },
      colors: {
        ink: {
          50: '#f8fafc',
          100: '#eef2f7',
          200: '#e2e8f0',
          900: '#0b132a',
        },
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#5458ee',
          700: '#4338ca',
        }
      },
      boxShadow: {
        'soft': '0 10px 25px -10px rgba(0,0,0,0.15)',
        'glow': '0 0 0 2px rgba(99,102,241,.15), 0 10px 30px rgba(99,102,241,.25)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
