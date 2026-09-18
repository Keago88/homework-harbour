/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        cream: '#f4f0e6',
        lilac: '#e6d8f5',
        butter: '#f6e7a3',
        sage: '#d4e8c4',
        'ink-muted': '#6b655c',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        nb: '24px',
      },
      borderWidth: {
        2.5: '2.5px',
      },
    },
  },
  plugins: [],
};
