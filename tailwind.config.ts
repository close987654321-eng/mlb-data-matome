import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        mlbnavy: '#041e42',
        mlbred: '#bf0d3e',
      },
      fontFamily: {
        sans: ['Inter', 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
