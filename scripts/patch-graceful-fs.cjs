// next build のビルド時プリロード（package.json の build スクリプトが NODE_OPTIONS 経由で読む）。
// graceful-fs は fs を差し替え、EMFILE(too many open files)/ENFILE が出たら即エラーにせず
// キューに積んで fd が空くまでリトライする。next build は全ページ(~1,800)を CPU コア数ぶんの
// jest-worker で並列プリレンダーし、各ワーカーが OG 画像生成(sharp/libvips=多数fd)や
// require で fd を大量に開く。ワーカー数がコア数に比例するため、コアの多い実行環境ほど
// プロセスの open-file 上限(open files のハードリミット)に当たりやすく EMFILE で build が落ちる。
// gracefulify はこの一過性の fd 枯渇を握りつぶさず「待って再試行」に変えるだけなので、
// 上限に余裕のある環境(ローカル/Vercel)では実質 no-op、余裕のない環境でだけ効く。
// NODE_OPTIONS='--require' で親と全ワーカー(env を継承する子プロセス)の双方に適用される。
require('graceful-fs').gracefulify(require('fs'));
