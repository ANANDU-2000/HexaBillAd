module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['28px', { lineHeight: '1.2' }],
        'h1': ['28px', { lineHeight: '1.25' }],
        'h2': ['22px', { lineHeight: '1.3' }],
        'h3': ['18px', { lineHeight: '1.35' }],
        'body': ['14px', { lineHeight: '1.5' }],
        'caption': ['12px', { lineHeight: '1.4' }],
      },
      spacing: {
        'grid-1': '8px',
        'grid-2': '16px',
        'grid-3': '24px',
        'grid-4': '32px',
        'grid-6': '48px',
      },
      maxWidth: {
        'content': '1400px',
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
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      transitionDuration: {
        'ui': '150ms',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(4px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        pulse: {
          '50%': { opacity: 0.5 },
        },
      },
      animation: {
        slideUp: 'slideUp 200ms ease-out',
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
