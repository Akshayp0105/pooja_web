/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FFFBF4',
        parchment: '#F9F0E1',
        sand: '#EFDDBF',
        gold: { DEFAULT: '#B8862F', soft: '#E6C98A', deep: '#8A621C' },
        saffron: '#DD7420',
        marigold: '#F3A53A',
        lotus: { DEFAULT: '#E58F88', soft: '#FCE8E3' },
        maroon: '#6A1F1B',
        ink: '#2A1A12',
        muted: '#76604F',
        leaf: '#5F7F4F',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        ml: ['"Noto Serif Malayalam"', 'serif'],
        mlsans: ['"Noto Sans Malayalam"', 'Manrope', 'sans-serif'],
      },
      maxWidth: { wide: '1560px' },
      boxShadow: {
        soft: '0 1px 2px rgba(106,31,27,.04), 0 18px 50px -20px rgba(138,98,28,.25)',
        lift: '0 1px 2px rgba(106,31,27,.05), 0 30px 80px -30px rgba(138,98,28,.38)',
        glow: '0 10px 40px -10px rgba(221,116,32,.55)',
      },
    },
  },
  plugins: [],
};
