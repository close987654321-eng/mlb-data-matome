import type { LocalizedName } from './common';
import type { Sport } from '@/lib/sports';

/** Reddit 等のスレッドから抜粋・翻訳した 1 コメント */
export type ThreadComment = {
  author: string; // 投稿者名。Reddit のユーザー名はそのまま表示する
  score: number; // upvote 数。並び替えと「人気コメント」判定に使う
  bodyEn: string; // 原文（引用の範囲で保持し、翻訳の透明性を担保する）
  bodyJa: string; // 日本語訳
  isHighlight?: boolean; // まとめのピックアップとして強調するか
  isHook?: boolean; // 冒頭に大きく掲げる「フック引用」（記事につき1つ）
  sourceUrl?: string; // 媒体引用（interview/海外メディア評価）で、その発言の出典URL。あると著者名がリンクになり媒体ごとに送客できる
};

/**
 * 元スレに紐づくメディア 1 点。ファイルはコミットせず URL 参照で持つ（CLAUDE.md §4.4）。
 * - image: 画像の直リンク（i.redd.it / i.imgur.com など、ホットリンク可能なもの）
 * - video: 動画の視聴 URL（YouTube / Streamable 等）。公式 iframe で埋め込む＝送客になる。
 *   v.redd.it は <video> 直貼り不可なので、外部ミラーの URL があればそれを使う。
 */
export type ThreadMedia = {
  kind: 'image' | 'video';
  url: string; // image=画像URL / video=視聴URL（埋め込みURLへは自動変換する）
  thumbUrl?: string; // video のカード/見出し用サムネ。無ければ自動取得かストックに退避
  caption?: string; // 日本語キャプション（任意）
  credit?: string; // 出典・帰属（例: "u/foo · r/baseball"）。必ず添える
  // ↓ video のときだけ。JSON-LD の VideoObject に使う（構造化データ用。画面表示はしない）。
  //   VideoObject は uploadDate が必須で、無いと動画リッチリザルト／Google動画タブに載れない。
  //   値は YouTube Data API（scripts/fetch-youtube.mjs の snippet.publishedAt / title）由来の
  //   実測値のみ＝捏造しない（CLAUDE.md §4.4）。取れていない記事は VideoObject を出さない。
  publishedAt?: string; // 動画の公開日時（ISO8601・YouTube 由来）
  videoTitle?: string; // 動画の原題（YouTube 由来）。VideoObject.name に使う
};

/**
 * 動画内のキャスター/解説者の会話（文字起こし＋日本語訳）。動画とコメントの間に差し込む。
 * MLB Network 等の番組セグメントを記事化するときに使う。発言者が特定できる場合のみ speaker を付ける。
 * 英語原文（en）はあれば添える。無ければ ja だけでよい（捏造しない）。
 */
export type ThreadTranscript = {
  speaker?: string; // 発言者名（分かる場合のみ）。例: "Mark DeRosa"
  ja: string; // 日本語訳（必須）
  en?: string; // 原文（あれば。無ければ省略）
};

/**
 * 「海外ファンと見る」シリーズ（看板の watch-along 企画）に属する記事のメタ情報。
 * これが付いた記事はタイトルを定型で自動生成し（src/lib/series.ts の seriesTitle）、
 * カード/記事にシリーズバッジを出し、/watch ハブにも載る。
 * シリーズ名・自軍名・接頭辞は data ではなく src/lib/series.ts のカタログが正。
 */
export type ThreadSeries = {
  id: string; // series カタログのキー（例: "dodgers"）。src/lib/series.ts の SERIES と一致させる
  date: string; // 試合日 "2026-06-10"（YYYY-MM-DD・JST）。タイトルの日付に使う
  opponent: LocalizedName; // 対戦相手名（vs の右）。例: { ja: "パイレーツ", en: "Pirates" }
  // ダブルヘッダーの試合番号（1 or 2）。シリーズ記事のタイトルは
  // 「{接頭辞} {日付} {自軍}対{相手}」の定型なので、同じ日に同じ相手と2試合やると
  // title/h1/og:title/JSON-LD headline が完全に一致し重複コンテンツになる（2026-07-30 実測で2組）。
  // ダブルヘッダーのときだけ立てて「第1戦/第2戦」を足し分ける。通常の試合では未設定。
  gameNo?: number;
};

/**
 * 記事にそえる「日本人選手の成績」1 件（matome R10）。summaryJa の下に専用ボックスで表示する。
 * 値は MLB公式 Stats API 由来の数値だけ（打率・本塁打・防御率＝公知の事実で著作権の対象外）。
 * scripts/fetch-mlb-stats.mjs で編集時に取得して書き込む（サイト本体は API を叩かない）。
 * MLB のロゴ・選手写真・成績表の丸ごと転載はしない（CLAUDE.md §4.5 / SKILL.md R10）。
 */
export type PlayerStat = {
  player: string; // 日本語表記（例: "大谷翔平"）
  team?: string; // 短い日本語のチーム名（例: "ドジャース"）
  today?: string; // その試合の成績（例: "2打数1安打1四球" / 二刀流は "投 6.0回… / 打 …"）
  season?: string; // 今季成績（例: "打率.297 16本 43打点 OPS.969"）
  war?: string; // 今季 WAR（二刀流は "5.4（投2.5 / 打2.9）"）。増減は API 仕様で取れず今季値のみ
  delta?: string; // 前回比＝この試合で今季成績がどれだけ動いたか（例: "OPS +.006" / "防御率 -0.02"）
  rank?: string; // 今季の MLB 順位（上位のときだけ・例: "防御率 MLB2位 / 本塁打 MLB18位"）
  note?: string; // 節目など強調したい一言（例: "今季16号"）。アクセント色のバッジで出る
};

/**
 * 試合の最終結果（スコア）。MLB公式スケジュールAPI由来の数値だけ＝公知の事実（著作権の対象外）。
 * scripts/fetch-mlb-stats.mjs backfill-games で編集時に取得して書き込む（サイト本体は API を叩かない）。
 * これがある MLB 記事は記事上に「試合結果ボックス」（src/components/GameBox.tsx）を出し、
 * 「試合結果カード」を画像出力できる（src/components/GameResultCard.tsx）。
 * away/home は API の実際の表/裏（ビジター/ホーム）。ロゴ/色は ja 名から teams.ts で解決する。
 *
 * ⚠️ record / rank は **その試合終了時点の値を焼き込む**（API の leagueRecord と日付指定 standings 由来）。
 * data/standings.json（＝常に最新）を記事に出すと、7月の試合の記事が9月には違う順位を表示してしまう。
 * 過去記事でも数字が狂わないことを優先して、記事ごとに固定する。
 */
export type ThreadGameSide = {
  ja: string; // 日本語短縮チーム名（例: "ドジャース"）。teams.ts の getTeam キー＝ロゴ/色を引ける
  en: string; // 公式英語名（例: "Los Angeles Dodgers"）
  score: number; // 最終得点
  /** 回ごとの得点。ホームが最終回を打たなかった回は null（表示は「−」）。延長は 10 要素以上になる */
  innings?: (number | null)[];
  hits?: number; // 安打（H）
  errors?: number; // 失策（E）
  lob?: number; // 残塁（LOB）
  /** この試合終了時点の勝敗（API の leagueRecord）。後から古くならない */
  record?: { w: number; l: number };
  rank?: number; // この試合終了時点の地区順位（1〜5）
  league?: 'AL' | 'NL'; // 地区ラベルの組み立て用（standings.ts の League と同じ）
  division?: 'East' | 'Central' | 'West'; // 同上（DivisionName と同じ）
};
export type ThreadGame = {
  away: ThreadGameSide; // ビジター（表）
  home: ThreadGameSide; // ホーム（裏）
  /** 勝敗投手・セーブ（API の decisions）。選手名は英語表記のまま＝公式表記 */
  decisions?: { winner?: string; loser?: string; save?: string };
};

/** 海外掲示板スレッドの日本語まとめ 1 件 */
export type Thread = {
  id: string; // "2026-06-09-judge-walkoff" のような日付プレフィックス付き kebab-case
  sport: Sport; // どの競技か（data/threads/{sport}/ のフォルダから決まる）
  subreddit: string; // "r/baseball" など、転載元コミュニティの表示名
  format?: 'reddit' | 'interview' | 'youtube'; // コメントの出所。'interview'=選手/監督インタビュー（u/接頭辞と▲スコアを出さない）。'youtube'=動画コメント（author そのまま・👍スコア）。既定は 'reddit'
  sourceUrl: string; // 元スレ URL。引用要件を満たすため必須・必ず送客する
  fetchedAt: string; // ISO8601（JST）
  // 公開後に本文を直したときだけ立てる ISO8601（JST）。JSON-LD の dateModified に出る。
  // 立てないと dateModified=datePublished のままで、コメント差し替え・誤訳修正・追記が
  // 鮮度シグナルとして検索側に伝わらない（fetchedAt は「取得日」なので後から動かさない）。
  updatedAt?: string;
  title: LocalizedName; // スレタイの原文(en)と訳(ja)
  summaryJa: string; // スレの流れ・論点の日本語要約（導入文）
  flair?: string; // "Game Thread" などの Reddit フレア
  totalComments: number; // 元スレの総コメント数（抜粋元の規模を示す）
  transcript?: ThreadTranscript[]; // 動画内の番組トーク（あれば動画とコメントの間に表示）
  comments: ThreadComment[]; // 抜粋・翻訳済みコメント
  media?: ThreadMedia; // 代表メディア（カードサムネ＆記事 hero に使う）
  gallery?: ThreadMedia[]; // 追加メディア（記事本文に順に差し込む。連続フレーム等）
  stats?: PlayerStat[]; // 日本人選手の成績ボックス（R10・MLB記事のみ）。summaryJa の直下に表示
  game?: ThreadGame; // 試合の最終スコア（MLB記事のみ）。あれば記事から「試合結果カード」を画像出力できる
  tags?: string[]; // 日本語タグ（選手名・話題）
  series?: ThreadSeries; // 「海外ファンと見る」シリーズ記事ならその情報（タイトル定型化＋バッジ＋/watch掲載）
  hideFromWatch?: boolean; // 動画つきでも /watch ハブ（注目の試合）に載せない。スタジオ解説/番組セグメント等、watch-along に馴染まない動画記事向け
  editorPick?: number; // トップ「本日の一面／編集部ピック」の優先度（小さいほど上位）。任意の手動キュレーション用。立っていない記事は自動フォールバック（直近×コメント数）で補う＝src/lib/frontpage.ts。JSONフラグだけで運用しSSGを保つ
  noindex?: boolean; // 手動で検索から下げる旗。薄い記事の自動判定は src/lib/threadIndex.ts の isThreadIndexable が正（youtube かつコメント10件未満は旗なしでも noindex）
  isSample?: boolean; // 開発用ダミーであることを明示するフラグ
};

export type ThreadFile = {
  updatedAt: string;
  threads: Thread[];
};
