import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF8F4', // クリーム地（ページ背景）
        surface: '#FFFFFF', // カードなど
        ink: '#1A1A1A', // 主要テキスト（チャコール）
        'ink-soft': '#6F6A62', // 副次テキスト（温かみのあるグレー）
        line: '#E7E2D8', // 区切り線
        accent: '#C8102E', // 差し色（赤）— 最小限に使う
        'accent-ink': '#9E0C24', // 赤のホバー
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'Hiragino Sans', 'Meiryo', 'sans-serif'],
      },
      maxWidth: {
        prose: '42rem', // 記事本文の読みやすい幅
      },
    },
  },
  plugins: [],
};

export default config;
