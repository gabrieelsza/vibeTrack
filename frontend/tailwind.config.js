/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        poster: {
          cream: '#FDF9F3',
          paper: '#F4EDE2',
          red: '#B91C1C',
          redDark: '#991B1B',
          redLight: '#FEE2E2',
          ink: '#141413',
          muted: '#57534E',
          border: '#E5DEC9',
        },
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Rubik"', 'Impact', 'sans-serif'],
        sans: ['"Rubik"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        polaroid:
          '0 12px 24px -6px rgba(20, 20, 19, 0.14), 0 4px 10px -3px rgba(20, 20, 19, 0.07)',
        poster: '0 10px 22px -6px rgba(185, 28, 28, 0.28)',
      },
    },
  },
  plugins: [],
};
