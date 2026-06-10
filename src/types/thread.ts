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
  tags?: string[]; // 日本語タグ（選手名・話題）
  isSample?: boolean; // 開発用ダミーであることを明示するフラグ
};

export type ThreadFile = {
  updatedAt: string;
  threads: Thread[];
};
