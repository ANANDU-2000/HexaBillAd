module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Arabic glyphs fall through to Noto Sans Arabic (bilingual names, RTL screens).
        sans: ['Inter', '"Noto Sans Arabic"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      fontSize: {
        // Mirrors --h*-size in src/styles/tokens.css.
        'display': ['28px', { lineHeight: '1.2' }],
        'h1': ['24px', { lineHeight: '1.2' }],
        'h2': ['20px', { lineHeight: '1.25' }],
        'h3': ['16px', { lineHeight: '1.3' }],
        'body': ['14px', { lineHeight: '1.5' }],
        'caption': ['12px', { lineHeight: '1.4' }],
        'micro': ['11px', { lineHeight: '1.3' }], // smallest permitted size (--micro-size)
      },
      zIndex: {
        // Mirrors --z-* in tokens.css.
        'sticky': '20',
        'nav': '30',
        'dropdown': '40',
        'modal': '50',
        'sheet': '60',
        'toast': '80',
        'tooltip': '90',
      },
      spacing: {
        'grid-1': '8px',
        'grid-2': '16px',
        'grid-3': '24px',
        'grid-4': '32px',
        'grid-6': '48px',
      },
      maxWidth: {
        'content': '1280px', // --content-max
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E5E7EB',
        },
        text: {
          primary: '#0F172A',
          secondary: '#475569',
        },
        accent: '#10B981',
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        // Status: DEFAULT is the solid colour; fg/bg/border are the tinted trio
        // (mirrors --{status}-fg/-bg/-border). Always pair colour with text or an icon.
        success: { DEFAULT: '#059669', fg: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
        warning: { DEFAULT: '#d97706', fg: '#b45309', bg: '#fffbeb', border: '#fde68a' },
        error: { DEFAULT: '#dc2626', fg: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
        info: { DEFAULT: '#3b82f6', fg: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
        tenant: 'var(--tenant-brand)',
      },
      transitionDuration: {
        'fast': '100ms',
        'ui': '150ms',
        'panel': '200ms',
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.2, 0, 0, 1)',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(4px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        pulse: {
          '50%': { opacity: 0.5 },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        slideUp: 'slideUp 200ms ease-out',
        shake: 'shake 300ms ease-in-out',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}
