import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 無彩色階調（クリーム地→ニュートラルな紙白へ）。暖色みを抜き、テキストは3段の
        // グレースケールで階層を作る。色は赤の一点のみに絞る＝「色は極小」の方針。
        paper: '#FAFAF9', // 紙白（ページ背景）。ほぼ無彩色、ごく僅かな温かみだけ残す
        surface: '#FFFFFF', // カードなど
        ink: '#191A1C', // 主要テキスト（ニア・ブラック）
        'ink-soft': '#565659', // 副次テキスト（ニュートラルグレー）
        'ink-mute': '#97979B', // 三次テキスト＝日付・件数・ラベル等のメタ情報
        line: '#E7E6E3', // 区切り線（ヘアライン）
        accent: '#C8102E', // 差し色（赤）— サイト唯一の色。意味のある一点にだけ使う
        'accent-ink': '#9E0C24', // 赤のホバー
      },
      // 角は「シャープ寄り」で統一（モダンミニマル）。写真カードは 0 だと硬いので 2–6px に抑え、
      // 旧来の lg=8 / xl=12 / 2xl=16 の“ぽってり角丸”を一掃する。円（dot/バッジ）は full を温存。
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '2px',
        md: '3px',
        lg: '3px',
        xl: '4px',
        '2xl': '6px',
        '3xl': '8px',
        full: '9999px',
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
