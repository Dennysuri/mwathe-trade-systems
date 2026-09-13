/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mwathe: {
          orange: '#FF7A00',
          green: '#00C853',
          skyblue: '#00B0FF',
          black: '#0A0A0A',
          darkgray: '#1A1A1A',
          white: '#FFFFFF',
          gray: '#888888',
        }
      },
    },
  },
  plugins: [],
}
