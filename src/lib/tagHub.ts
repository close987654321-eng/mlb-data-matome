import { getPlayerByJaName, type Player } from './players';
import { deriveRole } from './playerHero';
import type { PlayerSeason } from './playerStats';
import type { FeedItem } from './feed';
import type { TagCount } from './tags';
import type { Thread, ThreadComment } from '@/types/thread';
import { allComments } from './daily';

/**
 * タグLP（リッチ化するタグページ）の判定と導入文の唯一の正。
 *
 * 「海外の反応 {選手名}」系の検索は、SERP 上位が一覧ページ（競合のラベル/タグページ・
 * アンテナ特設）で占められている＝受け皿は記事フィードであるタグページ
 * （戦略: _local/strategy/2026-07-02-ohtani-seo-strategy.md）。
 * 選手ハブ /player は「{選手名} 成績」系KWの受け皿＝役割分担し、title を競合させない。
 *
 * 対象は日本人選手（非 rival）の正式名タグのみの opt-in:
 *  - 全タグを一律リッチ化すると生成文の薄いページを量産して品質評価を毀損する
 *  - エイリアス表記のタグ（例: フリーマン）までLP化すると同一選手で重複LPになる
 */
export function tagHubOf(tag: string): Player | null {
  const p = getPlayerByJaName(tag);
  if (!p || p.rival || p.nameJa !== tag) return null;
  return p;
}

/**
 * タグLPの H1 直下に出す導入文（ja）。数値は snapshot の実在値のみを使い、
 * 無い値は文ごと落とす（捏造しない＝CLAUDE.md §4.4）。成績が毎日動く＝文面が毎日変わる
 * ことが Discover/QDF 向けの鮮度シグナルを兼ねる。
 */
export function tagHubIntroJa(
  player: Player,
  season: PlayerSeason | null,
  year: number,
  articleCount: number,
): string {
  const sentences: string[] = [];
  sentences.push(
    `${player.nameJa}（${player.nameEn}）に対する海外の反応・現地ファンのコメントを日本語訳でまとめたページ。`,
  );
  if (season) {
    const role = deriveRole(season);
    const h = season.hitting;
    const p = season.pitching;
    const bat: string[] = [];
    if (h?.avg != null && h.avg !== '') bat.push(`打率${h.avg}`);
    if (h?.homeRuns != null && h.homeRuns !== '') bat.push(`${h.homeRuns}本塁打`);
    if (h?.ops != null && h.ops !== '') bat.push(`OPS${h.ops}`);
    const pit: string[] = [];
    if (p?.era != null && p.era !== '') pit.push(`防御率${p.era}`);
    if (p?.wins != null && p.wins !== '') pit.push(`${p.wins}勝`);
    if (p?.strikeOuts != null && p.strikeOuts !== '') pit.push(`${p.strikeOuts}奪三振`);
    const team = season.team ? `${season.team}で` : '';
    if (role === 'two-way' && (bat.length || pit.length)) {
      const parts: string[] = [];
      if (bat.length) parts.push(`打っては${bat.join('・')}`);
      if (pit.length) parts.push(`投げては${pit.join('・')}`);
      sentences.push(`${year}年は${team}${parts.join('、')}。`);
    } else if (role === 'pitcher' && pit.length) {
      sentences.push(`${year}年は${team}${pit.join('・')}。`);
    } else if (bat.length) {
      sentences.push(`${year}年は${team}${bat.join('・')}。`);
    }
  }
  sentences.push(
    `試合ハイライトへの現地実況や Reddit の話題スレから、生の反応を全${articleCount}件の記事で紹介している。`,
  );
  return sentences.join('');
}

/** タグLPに直接引用する「現地ファンの声」1件（記事＋その代表コメント）。 */
export type TagVoice = { thread: Thread; comment: ThreadComment };

/** LP に載せる声の総数と、畳んだ状態で見せる件数（残りは「もっと見る」で開く）。 */
export const VOICES_LIMIT = 20;
export const VOICES_VISIBLE = 5;

/** 声を探す記事の窓（この本数ぶんの記事を読む）。 */
const POOL_THREADS = 40;
/** 1記事から採る声の上限。1本の記事の話題でピックアップを埋めない。 */
const PER_THREAD = 2;
/** 一言レス（「うおおお」等）を弾く最小文字数。 */
const MIN_BODY = 16;

/** 声の主題（選手・ファイター・チーム）。表記ゆれを集めて「それを語っているか」を判定するのに使う。 */
export type VoiceSubject = {
  nameJa: string;
  nameEn: string;
  aliases?: string[];
  shortJa?: string[];
  /**
   * 与えた表記だけで照合する（語に割らない）。チーム主題で使う。
   * 人名は姓・名の単独表記で呼ばれる（Ohtani / 大谷）ので語に割って部分一致で拾うのが正しいが、
   * チームの英語名は短い一般語と同形（Mets ⊂ helmets / Reds ⊂ hundreds）で、同じ割り方をすると
   * そのチームに言及していないコメントを拾ってしまう。
   */
  exact?: boolean;
};

/** 比較用の正規化: 大小文字・アクセント・中黒/空白の差を消す（Sánchez=sanchez, ラーズ・ヌートバー=ラーズヌートバー）。 */
function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[・\s]/g, '');
}

/** 絵文字・記号を除いた実質の文字数。「㊗️🇯🇵スガノ ナイスピッチ👏🎉」のような一言レスを弾くために使う。 */
function textLength(s: string): number {
  return s.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{So}\p{Sk}\s]/gu, '').length;
}

/** 表示に使う本文（ja 優先・無ければ en）。 */
function voiceBody(c: ThreadComment): string {
  return (c.bodyJa ?? '').trim() || (c.bodyEn ?? '').trim();
}

/**
 * その主題を指す表記のゆれ一覧。日本語は姓・名の単独表記（shortJa）とタグのエイリアス、
 * 英語はフルネームと4文字以上のトークン（Ohtani / Shohei）。カタカナ名は「・」で割った要素も足す。
 * exact な主題（チーム）は語に割らず、与えた表記だけを使う（VoiceSubject.exact のコメント参照）。
 */
function subjectPatterns(subject: VoiceSubject): string[] {
  const given = [
    subject.nameJa,
    subject.nameEn,
    ...(subject.aliases ?? []),
    ...(subject.shortJa ?? []),
  ];
  const parts = subject.exact
    ? given
    : [
        ...given,
        ...subject.nameJa.split('・').filter((w) => w.length >= 3),
        ...subject.nameEn.split(/[\s-]+/).filter((w) => w.length >= 4),
      ];
  return [...new Set(parts.map(normalize).filter((w) => w.length >= 2))];
}

/** コメント本文（日英どちらでも）のどこでその人に言及しているか。none=言及なし / lead=書き出しが本人の話。 */
function mentionOf(comment: ThreadComment, patterns: string[]): 'none' | 'body' | 'lead' {
  let found: 'none' | 'body' = 'none';
  for (const text of [comment.bodyJa ?? '', comment.bodyEn ?? '']) {
    const hay = normalize(text);
    for (const p of patterns) {
      const at = hay.indexOf(p);
      if (at < 0) continue;
      if (at <= 40) return 'lead'; // 書き出しで名前が出る＝その人が主語のコメント
      found = 'body';
    }
  }
  return found;
}

/** 使えるコメント（本文があり、一言レスでない）を票数の多い順に。 */
function usableComments(thread: Thread): ThreadComment[] {
  return allComments(thread)
    .filter((c) => textLength(voiceBody(c)) >= MIN_BODY)
    .sort((a, b) => b.score - a.score);
}

/**
 * 声1件の「読ませる度」。記事をまたいで並べるので、票数の絶対値（YouTubeは万単位・Redditは数百）ではなく
 * **記事内での順位**を使う＝どの記事の声も同じものさしで比べられる。
 */
function voiceQuality(
  comment: ThreadComment,
  rankInThread: number,
  totalInThread: number,
  feedIndex: number,
  mention: 'body' | 'lead',
): number {
  let q = totalInThread > 1 ? 1 - rankInThread / (totalInThread - 1) : 1; // 記事内の票数順位（1位=1）
  if (mention === 'lead') q += 0.4; // 本人が主語＝ついでに名前が出ただけの声より上に置く
  if (comment.isHook) q += 1.5; // 記事が冒頭に掲げた引用＝編集で選んだ一番の声
  if (comment.isHighlight) q += 0.8;
  const len = textLength(voiceBody(comment));
  if (len >= 40 && len <= 400) q += 0.6; // 一言でも長文コピペでもない“読ませる”長さ
  if (feedIndex < 8) q += 0.5; // 直近の記事を少しだけ優遇（LPの鮮度）
  else if (feedIndex < 20) q += 0.25;
  return q;
}

/**
 * タグLPの「現地ファンの声ピックアップ」。
 * **その選手/ファイターに言及しているコメントだけ**を直近 POOL_THREADS 本の記事から集め、
 * 読ませる度（voiceQuality）の高い順に limit 件返す。
 *
 * 以前は記事ごとの代表コメント＝票数最上位を機械的に採っていたが、試合まとめの最上位コメントは
 * 「チーム全体の話」「別の選手の話」であることが多く、選手LPに無関係な声が並んだ（2026-07-28 指摘）。
 * 名前で絞ることで「{選手名} 海外の反応」で来た読者が求める“その選手について何が言われているか”に揃う。
 * まず1記事 PER_THREAD 件までで拾って話題を散らし、枠が余ったら残りの言及コメントを質順に足す
 * （記事が少ない選手＝言及が数本の記事に集中する選手でも埋まるように）。
 * それでも VOICES_VISIBLE 件に満たないときだけ、記事の代表コメントで不足分を補って空欄を防ぐ。
 */
export function tagHubVoices(
  feed: FeedItem[],
  subject: VoiceSubject,
  limit = VOICES_LIMIT,
): TagVoice[] {
  const patterns = subjectPatterns(subject);
  const hits: { voice: TagVoice; q: number }[] = [];
  const spare: TagVoice[] = []; // 言及なしの代表コメント（不足時の埋め合わせ用）
  feed
    .flatMap((item) => (item.kind === 'thread' ? [item.thread] : []))
    .slice(0, POOL_THREADS)
    .forEach((thread, feedIndex) => {
      const comments = usableComments(thread);
      let hitInThread = 0;
      comments.forEach((comment, rank) => {
        const mention = mentionOf(comment, patterns);
        if (mention === 'none') return;
        hitInThread++;
        hits.push({
          voice: { thread, comment },
          q: voiceQuality(comment, rank, comments.length, feedIndex, mention),
        });
      });
      if (hitInThread === 0 && comments[0]) spare.push({ thread, comment: comments[0] });
    });

  hits.sort((a, b) => b.q - a.q);
  const picked: typeof hits = [];
  const overflow: typeof hits = [];
  const perThread = new Map<string, number>();
  for (const hit of hits) {
    const key = hit.voice.thread.id;
    const n = perThread.get(key) ?? 0;
    if (n < PER_THREAD && picked.length < limit) {
      picked.push(hit);
      perThread.set(key, n + 1);
    } else {
      overflow.push(hit); // 1記事の上限で溢れた分＝枠が余ったら質順に戻す
    }
  }
  for (const hit of overflow) {
    if (picked.length >= limit) break;
    picked.push(hit);
  }
  const voices = picked.sort((a, b) => b.q - a.q).map((p) => p.voice);
  for (const s of spare) {
    if (voices.length >= VOICES_VISIBLE) break;
    voices.push(s);
  }
  return voices;
}

/**
 * 記事が実在する選手タグLPの一覧（件数つき）。LP 同士を相互リンクする「選手別の海外の反応」網に使う。
 * 「{選手名} 海外の反応」系はどの選手も同型のクエリ＝LP クラスタ内の内部リンクを密にして
 * 個々の LP のクロール深度と内部評価を底上げする。tags は getAllTags()（件数降順）を渡す。
 */
export function playerTagHubs(tags: TagCount[]): { player: Player; count: number }[] {
  const hubs: { player: Player; count: number }[] = [];
  for (const { tag, count } of tags) {
    const player = tagHubOf(tag);
    if (player && count > 0) hubs.push({ player, count });
  }
  return hubs;
}
