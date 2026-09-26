/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0B0D',
        card: '#141417',
        line: '#26262B',
        muted: '#8A8A93',
        accent: { DEFAULT: '#FF6A1A', light: '#FF8A3D' },
      },
      fontFamily: {
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        hand: ['Caveat', 'cursive'],
      },
      borderRadius: { card: '18px' },
      boxShadow: {
        glow: '0 0 24px rgba(255,106,26,0.45), 0 0 4px rgba(255,138,61,0.6)',
        'glow-sm': '0 0 12px rgba(255,106,26,0.35)',
      },
      letterSpacing: { wide3: '0.3em' },
    },
  },
  plugins: [],
};
