/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './index.html',
  ],
  theme: {
    extend: {
      colors: {
        fintech: {
          bg: '#080705',
          card: '#0f0c08',
          cardSubtle: '#15120c',
          cardHover: '#1c1710',
          border: '#2e271c',
          borderLight: '#453d32',
          gold: '#e5a944',
          goldLight: '#fcd34d',
          goldMuted: '#926a27',
          verified: '#10b981',
          stopped: '#ef4444',
          textPrimary: '#f4ede2',
          textSecondary: '#a89f91',
          textMuted: '#7a7164',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Space Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
