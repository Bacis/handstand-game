/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        ink: {
          900: '#0a0a0b',
          800: '#111113',
          700: '#1c1c20',
        },
        brand: {
          accent: '#ff4d2e',
          accent2: '#ff7a5c',
          paper: '#16161a',
          surface: '#1c1c20',
          border: '#2a2a2d',
          mute: '#777',
        },
        aura: {
          blue: '#3B82F6',
          green: '#22C55E',
          purple: '#A855F7',
          gold: '#EAB308',
          cyan: '#22D3EE',
        },
      },
      boxShadow: {
        glow: '0 0 30px rgba(168, 85, 247, 0.5)',
        'glow-lg': '0 0 60px rgba(168, 85, 247, 0.6)',
        'glow-cyan': '0 0 30px rgba(34, 211, 238, 0.5)',
        'glow-gold': '0 0 30px rgba(234, 179, 8, 0.55)',
      },
      backgroundImage: {
        'aura-gradient': 'linear-gradient(135deg, #22D3EE, #A855F7, #EAB308)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.45)' },
          '50%':      { boxShadow: '0 0 60px rgba(168, 85, 247, 0.85)' },
        },
        kineticSlide: {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-150% 0' },
          '100%': { backgroundPosition: '150% 0' },
        },
        countPop: {
          '0%':   { transform: 'scale(1)' },
          '50%':  { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        toastIn: {
          '0%':   { opacity: '0', transform: 'translateY(10px) translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0) translateX(0)' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        'kinetic-slide': 'kineticSlide 500ms ease-out',
        shimmer: 'shimmer 3s linear infinite',
        'count-pop': 'countPop 200ms ease-out',
        'toast-in': 'toastIn 260ms ease-out',
        'float-y': 'floatY 3.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
