/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4da6d9',
          dark:    '#2e86c1',
          light:   '#e0f4fb',
          pale:    '#f0faff',
        },
        pastel: {
          green:  '#72c08a',
          yellow: '#f0b942',
          red:    '#e07070',
          gray:   '#b0bec5',
        }
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    }
  },
  plugins: [],
}
