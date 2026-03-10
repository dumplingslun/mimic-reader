/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'paper': {
          50: '#faf9f6',
          100: '#f4f1ea',
          200: '#e8e3d5',
          300: '#d9d1bc',
          400: '#c5b89a',
          500: '#b0a37a',
        }
      },
      transformStyle: {
        'preserve-3d': 'preserve-3d',
      },
      perspective: {
        '2000': '2000px',
        '1000': '1000px',
      }
    },
  },
  plugins: [],
}
