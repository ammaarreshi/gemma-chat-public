/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      colors: {
        ink: {
          50: '#f8f8f8',
          100: '#e8e8e8',
          200: '#d0d0d0',
          400: '#888888',
          600: '#4a4a4a',
          800: '#1f1f1f',
          900: '#0e0e0e',
          950: '#050505'
        }
      }
    }
  },
  plugins: []
}
