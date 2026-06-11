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
};

/** 海外掲示板スレッドの日本語まとめ 1 件 */
export type Thread = {
  id: string; // "2026-06-09-judge-walkoff" のような日付プレフィックス付き kebab-case
  sport: Sport; // どの競技か（data/threads/{sport}/ のフォルダから決まる）
  subreddit: string; // "r/baseball" など、転載元コミュニティの表示名
  sourceUrl: string; // 元スレ URL。引用要件を満たすため必須・必ず送客する
  fetchedAt: string; // ISO8601（JST）
  title: LocalizedName; // スレタイの原文(en)と訳(ja)
  summaryJa: string; // スレの流れ・論点の日本語要約（導入文）
  flair?: string; // "Game Thread" などの Reddit フレア
  totalComments: number; // 元スレの総コメント数（抜粋元の規模を示す）
  comments: ThreadComment[]; // 抜粋・翻訳済みコメント
  media?: ThreadMedia; // 代表メディア（カードサムネ＆記事 hero に使う）
  gallery?: ThreadMedia[]; // 追加メディア（記事本文に順に差し込む。連続フレーム等）
  tags?: string[]; // 日本語タグ（選手名・話題）
  isSample?: boolean; // 開発用ダミーであることを明示するフラグ
};

export type ThreadFile = {
  updatedAt: string;
  threads: Thread[];
};
