#!/usr/bin/env bash
# 無人クラウド routine（[[daily-jp-games-cloud-routine]]）の公開前 build ゲート“専用”のビルド。
# fd 上限の低いコンテナで `next build` が EMFILE(too many open files) で落ち、「build 通過時のみ公開」の
# 安全弁が実質 OFF になっていた問題（記事は正常なのにインフラ都合で毎回未公開）への恒久対処。3段構え:
#   1) soft の open-files 上限を hard まで引き上げる（soft<hard の環境で効く。既に最大なら no-op）
#   2) MATOME_BUILD_LEAN=1 で next.config のワーカー数/同時実行を絞り、fd 圧をホストのコア数から切り離す
#   3) graceful-fs を preload し、JS の fs 側で出る一過性の EMFILE をキュー再試行に変える
# Vercel 本番は `npm run build`（このスクリプトを通さない）＝全開のまま。
set -eu
ulimit -n "$(ulimit -Hn)" 2>/dev/null || true
export MATOME_BUILD_LEAN=1
export NODE_OPTIONS="${NODE_OPTIONS:-} --require $(pwd)/scripts/patch-graceful-fs.cjs"
exec ./node_modules/.bin/next build
