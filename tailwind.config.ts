import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fb',
          400: '#36aaf5',
          500: '#0c8ee6',
          600: '#0070c4',
          700: '#01599f',
          800: '#064c83',
          900: '#0b406d',
          950: '#072849',
        },
        surface: {
          DEFAULT: '#f8fafc',
          card: '#ffffff',
          muted: '#f1f5f9',
        },
        // ARISE Athletic Shop · paleta de marca
        arise: {
          bg: '#07050B',
          bg2: '#100719',
          card: '#160A24',
          neon: '#A100FF',
          violet: '#7900FF',
          fuchsia: '#FF00E5',
          magenta: '#E000FF',
          lavender: '#D98BFF',
          deep: '#5200AE',
          border: '#34144D',
          text2: '#C9B8D9',
          muted: '#9787A7',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        elevated: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'elevated-lg': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.04)',
        glow: '0 0 15px rgba(161, 0, 255, 0.45)',
        'glow-strong': '0 0 30px rgba(161, 0, 255, 0.65)',
        'glow-fuchsia': '0 0 20px rgba(255, 0, 229, 0.45)',
      },
      backgroundImage: {
        'arise-primary': 'linear-gradient(135deg, #7900FF 0%, #A100FF 50%, #FF00E5 100%)',
        'arise-electric': 'linear-gradient(90deg, #5200AE, #7900FF, #D98BFF)',
        'arise-dark': 'linear-gradient(180deg, #07050B, #160A24)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'gradient-x': 'gradientX 8s ease infinite',
        'glow-pulse': 'glowPulse 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.06)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
