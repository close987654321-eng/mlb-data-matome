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
        // 日本語 Web フォント（Noto Sans JP）は CDN が漢字サブセットを woff2 60本超・計1MB+ で
        // 配信し、モバイルのクリティカルパス(~520ms)・強制リフロー(font swap)・LCP遅延の主因だった。
        // ブランドはロゴ画像が担うため本文は OS 同梱のゴシックで十分上質。ダウンロード 0 にする。
        // Hiragino=Mac/iOS, Yu Gothic/Meiryo=Windows, Noto Sans JP=ローカルにあれば使う(DLなし)。
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Yu Gothic"',
          'YuGothic',
          'Meiryo',
          '"Noto Sans JP"',
          'sans-serif',
        ],
      },
      maxWidth: {
        prose: '42rem', // 記事本文の読みやすい幅
      },
    },
  },
  plugins: [],
};

export default config;
