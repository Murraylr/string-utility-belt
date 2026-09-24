/** @type {import('tailwindcss').Config} */
const token = name => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  // `.dark` on <html> switches the token set; see src/index.css
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular'],
      },
      colors: {
        // semantic tokens — prefer these over raw palette colours in new UI
        canvas: token('canvas'),        // page background
        surface: token('surface'),      // cards, inputs
        'surface-2': token('surface-2'),// subtle panels, previews
        fg: token('fg'),                // primary text
        muted: token('muted'),          // secondary text
        line: token('line'),            // borders, dividers
        danger: token('danger'),
        success: token('success'),
        warn: token('warn'),
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
      borderColor: {
        DEFAULT: token('line'),
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
