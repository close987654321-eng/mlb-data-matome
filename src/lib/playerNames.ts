import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPlayerByMlbId, getPlayerByEnName } from './players';
import type { Player } from './players';

/**
 * 現地選手の日本語（カタカナ）表記。試合結果ボックスの本塁打・勝敗投手が読む。
 *
 * なぜ必要か: 記事JSONには MLB公式の英語表記しか持っていない（表記の正をコードに寄せる方針）。
 * 日本人向けサイトで「Alex Bregman」と出ると読者が読み飛ばすので、カタカナに当てて出す。
 * 日本人選手はカタログ（players.ts）が正＝日本語表記＋選手ハブへのリンクまで持つので先に引く。
 *
 * data/player-names-ja.json は「公式英語表記 → カタカナ」の手当て表。同姓同名（Will Smith 等）も
 * カタカナは同じなので名前キーで足りる。未収録の選手（初本塁打の若手など）は英語表記のまま出す＝
 * 捏造しない・壊れない。未収録の洗い出しは `node scripts/check-player-names.mjs`。
 */
const FILE = path.join(process.cwd(), 'data', 'player-names-ja.json');

let cache: Record<string, string> | null = null;

async function load(): Promise<Record<string, string>> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as Record<string, string>;
  } catch {
    cache = {}; // 表が無くてもビルドは通す（英語表記のまま出る）
  }
  return cache;
}

/** 表示する選手名＋（カタログにある選手だけ）ハブ slug。 */
/** nameJa はカタログ一致時のみ。選手LP（/tag/{nameJa}）へのリンク判定に使う（label は locale で変わるため別持ち）。 */
export type PlayerLabel = { label: string; slug?: string; nameJa?: string };

/**
 * 選手の表示名を解決する。優先順は カタログ（ID 一致→英語名一致）→ カタカナ表 → 公式英語表記。
 * locale が ja 以外のときは英語表記のまま（表記の正は MLB公式）。
 */
export async function playerLabel(
  nameEn: string,
  opts: { locale: string; mlbId?: number },
): Promise<PlayerLabel> {
  const catalog: Player | undefined =
    (opts.mlbId != null ? getPlayerByMlbId(opts.mlbId) : undefined) ?? getPlayerByEnName(nameEn);
  if (opts.locale !== 'ja')
    return { label: catalog?.nameEn ?? nameEn, slug: catalog?.slug, nameJa: catalog?.nameJa };
  if (catalog) return { label: catalog.nameJa, slug: catalog.slug, nameJa: catalog.nameJa };
  const names = await load();
  return { label: names[nameEn] ?? nameEn };
}
