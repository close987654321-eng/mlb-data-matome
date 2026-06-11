import type { LocalizedName } from './common';
import type { Sport } from '@/lib/sports';
import type { ThreadMedia } from './thread';

/** 引用（インタビューの発言・名言）。cite は発言者・出典の補足。 */
export type Quote = {
  text: string;
  cite?: string;
};

/**
 * コラム／インタビュー本文の構成ブロック。
 * 反応まとめ（Thread）と違い「現地ファンのコメント集」ではなく、
 * 1 本の読み物（リード＋見出し＋段落＋引用）として組む。
 */
export type ColumnBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; quote: Quote }
  | { type: 'video'; media: ThreadMedia }; // 本文に挿し込む動画（YouTube 等の視聴 URL）

/** インタビュー／コラム記事 1 件 */
export type Column = {
  id: string; // "2026-06-11-freddie-freeman-2500-hits" 形式（日付プレフィックス付き kebab-case）
  sport: Sport; // キービジュアルの写真プールと競技ラベルに使う
  kind: 'interview' | 'column'; // 記事の種別（バッジ表示に使う）
  source?: string; // 出典の表示名（例: "MLB Network『MLB Central』"）
  sourceUrl?: string; // 出典 URL（あれば送客リンクを出す）
  publishedAt: string; // ISO8601（JST）
  title: LocalizedName; // タイトルの原文(en)と訳(ja)
  lead: string; // リード文（導入・日本語）
  heroQuote?: Quote; // 冒頭に大きく掲げるフック引用
  blocks: ColumnBlock[]; // 本文（見出し・段落・引用の並び）
  tags?: string[]; // 日本語タグ（選手名・話題）
};
