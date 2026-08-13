import { readFileSync } from 'node:fs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n.ts');

// 撤去した記事の id 一覧。元動画が YouTube から消えると引用の出典（＝送客先）が失われ、記事が
// 「出典の無いコメント転載」になってしまうので記事ごと削除する。ただし削除＝404 だと既存の被リンク・
// 索引を捨てることになるため、いちばん近い常設面へ 301 で引き継ぐ。
//
// 転送先は `to` に**ロケール接頭辞を除いたパスで明示する**（ルートを決め打ちしない）。当店のエンティティ
// 面は選手＝/player/{slug}、ファイター＝/tag/{日本語タグ} と route が分かれており、「選手ページへ」の
// ような決め打ちは片方で 404 になるため（2026-08-13 に /player/conor-mcgregor で実際に踏んだ。
// ファイターの日誌は tag LP に載る）。省略時はカテゴリ一覧へ。ロケール別に分けたいときは {ja,en}。
// 検出は scripts/check-dead-videos.mjs（kpi-weekly の週次チェック）。
/** @type {{sport:string,id:string,to?:string|{ja?:string,en?:string},videoId?:string,reason?:string}[]} */
const deleted = JSON.parse(readFileSync(new URL('./data/deleted-ids.json', import.meta.url), 'utf8'));

// 無人クラウドの build ゲート（scripts/build-gate.sh 経由・[[daily-jp-games-cloud-routine]]）は
// fd 上限の低い(≈4096)コンテナで走る。next build の静的生成ワーカー数は既定で os.cpus()-1＝コア数に
// 比例するため、コアの多いクラウドほど同時プリレンダーが増える。各レンダーが OG 画像(sharp/next-og)や
// inlineCss(lightningcss) の“ネイティブ fd”を開くが、これは graceful-fs では待避できず（graceful-fs は
// JS の fs しかパッチしない）、同時 fd が上限を超えて EMFILE(too many open files) で build が落ちる。
// ＝graceful-fs だけでは足りなかった真因。MATOME_BUILD_LEAN=1 のときだけワーカー数と同時実行を絞り、
// fd 圧をホストのコア数から切り離す。Vercel 本番(npm run build)は無指定＝全開のまま（fd 上限に余裕あり）。
const leanBuild = process.env.MATOME_BUILD_LEAN === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 選手別 OG 画像（[slug]/opengraph-image）は generateImageMetadata 由来で動的レンダリングになる
  // （ハブ OG と違い prerender されない）。実行時に satori 用フォント・背景・成績JSON を
  // process.cwd() 経由で fs 読みするが、このパスは静的解析できず @vercel/nft がトレースしないため、
  // Vercel のサーバーレス関数バンドルに同梱されず実行時 500 になる（ローカルは cwd に実在し 200）。
  // → 該当ファイルを明示同梱して「ローカルで動く＝Vercel でも動く」状態に揃える。
  outputFileTracingIncludes: {
    '/**': [
      './src/assets/fonts/*.ttf',
      './src/assets/og/*.jpg',
      './data/jp-players-stats.json',
      // 予測ボードの OG（cy-young/[id]・mvp/[id] も generateImageMetadata 由来で動的）が実行時に読む
      './data/cy-young-board.json',
      './data/mvp-board.json',
    ],
  },
  // CSS を <style> で HTML にインライン化し、描画をブロックする外部 CSS <link> を無くす
  // （Next 15.2+ 第一者機能。critters/optimizeCss と違い追加依存なし）。本サイトは Discover
  // 由来のワンショット流入が主で回遊が少ないため、ページ毎インラインの欠点が出にくく FCP/LCP に効く。
  experimental: {
    inlineCss: true,
    // ↓ 無人クラウドの build ゲートでだけ有効化（上の leanBuild コメント参照）。記事数が増えるにつれ
    //   cpus=2/maxConcurrency=4（旧設定）でも同時 fd が上限を超えるようになった（2026-07-31 実測・
    //   digest 3948951212 で /tag/[tag] がランダムに失敗）。ワーカー1・同時レンダー1まで絞って
    //   fd 圧を実質シリアライズし直す（遅いが確実）。Vercel/ローカルの通常ビルドには一切効かない（既定＝全開）。
    ...(leanBuild ? { cpus: 1, staticGenerationMaxConcurrency: 1 } : {}),
  },
  images: {
    // Vercel の画像最適化(/_next/image)は無料枠=5,000変換/月で、更新頻度の高い本サイトでは
    // すぐ使い切る。枠が尽きると optimizer が 402(OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED)を
    // 返し、サムネ・カード・ロゴまでサイト全体の画像が一斉に壊れる（2026-06 に発生）。
    // → カスタムローダで Vercel を通さず各CDN直配信に切替（恒久無料・枠なし）。Unsplash は
    //   自前CDNでリサイズ、YouTube/redd/imgur/ローカルは直リンク（src/lib/imageLoader.js）。
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.js',
    // ↓ deviceSizes/imageSizes はカスタムローダが srcset を作る際の要求幅として今も有効
    //   （Unsplash の w= リサイズに効く）。formats/remotePatterns は Vercel optimizer 用なので
    //   カスタムローダでは未使用だが、許可ホストの記録として残す。
    deviceSizes: [640, 828, 1200, 1920], // モバイル / タブレット / Discover(1200px) / デスクトップ高DPI
    imageSizes: [128, 256], // サムネ・アバター等の小画像用
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' }, // 競技ストック写真
      { protocol: 'https', hostname: 'i.redd.it' }, // Reddit 直リンク画像
      { protocol: 'https', hostname: 'i.imgur.com' }, // imgur 直リンク画像
      { protocol: 'https', hostname: 'i.ytimg.com' }, // YouTube サムネ
      { protocol: 'https', hostname: 'www.mlbstatic.com' }, // チームロゴ（teams.ts）
      { protocol: 'https', hostname: 'img.mlbstatic.com' }, // 選手ヘッドショット（teams.ts）
    ],
  },
  async redirects() {
    // 撤去記事は ja/en 双方の記事 URL を `to` のパスへ 301（既定ロケール ja は prefix 無しが正規・
    // 英語は /en）。エンティティ面はそのロケールに記事がある対象しか生成されないことがあるので、
    // **デプロイ後に両ロケールで 200 を実測してから確定する**（片面だけ落ちるなら {ja,en} で分ける）。
    const deletedRedirects = deleted.flatMap(({ sport, id, to }) => {
      const dest = typeof to === 'string' ? { ja: to, en: to } : (to ?? {});
      return [
        {
          source: `/${sport}/${id}`,
          destination: dest.ja ?? `/${sport}`,
          permanent: true,
        },
        {
          source: `/en/${sport}/${id}`,
          destination: `/en${dest.en ?? `/${sport}`}`,
          permanent: true,
        },
      ];
    });

    return [
      ...deletedRedirects,
      // 本番の vercel.app は独自ドメインと重複コンテンツになるため、apex（正規）へ恒久転送して
      // SEO を一本化する。host 条件付きなのでプレビューデプロイの個別 URL には影響しない。
      // ドメイン正規化を先に効かせる（その後 ufc→mma は新ドメイン側で適用される）。
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'mlb-data-matome.vercel.app' }],
        destination: 'https://matome-mlb-kaigai.jp/:path*',
        permanent: true,
      },
      // 2026-06-13 にカテゴリを ufc → mma へ改名。既に共有済みの旧 URL を恒久転送する。
      { source: '/ufc', destination: '/mma', permanent: true },
      { source: '/ufc/:path*', destination: '/mma/:path*', permanent: true },
      { source: '/en/ufc', destination: '/en/mma', permanent: true },
      { source: '/en/ufc/:path*', destination: '/en/mma/:path*', permanent: true },
      // 同一動画(7zappcIDCZs)を二重記事化してしまった重複コンテンツの正規化（2026-07-23）。
      // コメント抜粋が厚い 06-21 版へ寄せる。
      {
        source: '/mlb/2026-06-20-ohtani-homer-second-child',
        destination: '/mlb/2026-06-21-ohtani-homer-second-child',
        permanent: true,
      },
      {
        source: '/en/mlb/2026-06-20-ohtani-homer-second-child',
        destination: '/en/mlb/2026-06-21-ohtani-homer-second-child',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
