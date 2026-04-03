import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#1a1d27',
        surface2: '#232733',
        surface3: '#2c3040',
        border: '#333849',
        'text-base': '#e8eaf0',
        'text-dim': '#8b90a0',
        'text-faint': '#555a6e',
        accent: '#6c8cff',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        sm: '8px',
      },
    },
  },
  plugins: [],
}

export default config
