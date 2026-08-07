import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * チームLPの試合タイムラインに出す「1試合1件の現地の声」（data/game-voices.json）。
 *
 * なぜ記事と別レイヤーか: それまでタイムラインの声は「その試合のまとめ記事を書いたか」に
 * 100%連動していた。2026-07-30 に「日本人が絡む試合は日次記事1本に集約」と決めて1日あたりの
 * 記事本数が 6〜12本 → 1本に落ちた結果、声のカバー率が 60〜100% → 30〜40% に低下した。
 * 記事本数を戻すのは共食い回避の合意に逆行するので、声だけを記事から独立させる（2026-08-07）。
 *
 * 中身は scripts/fetch-game-voices.mjs が MLB公式ハイライトのコメントから機械的に書き出す。
 * 原文・著者・票数は人も AI も触らない＝捏造が構造的に起きない（2026-07-12 の事故対策）。
 */

/** 1試合1件。キーは data/team-games.json と同じ短縮形（毎日コミットされるファイルを小さく保つ）。 */
export type GameVoice = {
  d: string; // 試合日（JST）
  a: number; // ビジターの teamId
  h: number; // ホームの teamId
  as: number; // ビジターの得点
  hs: number; // ホームの得点
  v: string; // 引用元の YouTube 動画ID（送客先）
  author: string;
  score: number; // 👍 数
  en: string; // 原文（スクリプトが取得結果からそのまま書く）
  ja: string; // 日本語訳（ここだけ後から埋める）
};

type GameVoiceFile = { asOf: string; from: string; to: string; voices: GameVoice[] };

const FILE = path.join(process.cwd(), 'data', 'game-voices.json');

let cache: GameVoice[] | null = null;

/**
 * 訳が付いたものだけを返す。
 *
 * `ja` が空のエントリはスクリプトが取ってきたばかりの未訳＝**サイトに出さない**。
 * 「取得は自動・翻訳は後追い」の運用で、訳の付いていない英文がそのまま公開されるのを防ぐ安全弁。
 */
export async function getGameVoices(): Promise<GameVoice[]> {
  if (cache) return cache;
  try {
    const file = JSON.parse(await fs.readFile(FILE, 'utf8')) as GameVoiceFile;
    cache = (file.voices ?? []).filter((v) => v.ja?.trim());
  } catch {
    cache = []; // 未生成でもビルドは通す（声が無いタイムラインになるだけ）
  }
  return cache;
}
