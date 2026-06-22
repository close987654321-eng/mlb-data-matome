/**
 * 日本人 MLB 選手カタログ（選手ハブ /player/[slug] とエンティティ紐付けの唯一の正）。
 * 「誰が現役か」は本来 MLB API（birthCountry==='Japan'）が最新だが、サイト本体は API を叩かない
 * 方針（CLAUDE.md・[[mlb-stats-enrichment-decision]]）なので、ハブ対象はここで静的に持つ。
 * 新しい日本人選手が記事に登場したら 1 行足す。所属チーム・成績は記事側の stats（編集時取得の事実）
 * から引くので、ここには持たない（古くなる情報を二重管理しない）。
 *
 * sameAs: エンティティSEO（Knowledge Graph 照合）用の外部権威URL。MLB.com は slug-id が正規形、
 * Wikipedia(日本語) は実在確認済みのものだけ入れる（404 を埋め込まない）。
 * mlbId は fetch-mlb-stats.mjs の JP_NAMES と一致させる。
 */
import type { Thread } from '@/types/thread';
import type { PlayerSeason } from './playerStats'; // 型のみ（fs 依存は持ち込まない）

export type Player = {
  slug: string; // URL用の英字スラッグ（例: "shohei-ohtani"）
  nameJa: string; // 日本語表記。記事の tags / stats[].player と突き合わせるキー
  nameEn: string;
  mlbId: number;
  bio: string; // E-E-A-T／独自性のための短い紹介（事実のみ・所属は書かない＝古くなるため）
  sameAs: string[]; // 外部権威URL（エンティティ照合）
  rival?: boolean; // 非日本人だが比較用に載せる選手（大谷のサイ・ヤング賞争いのライバル等）。
  // 一覧（/player）では日本人の比較表に混ぜず「サイヤング争い」専用ブロックに出す。詳細ページは通常どおり生成。
};

const mlb = (slug: string, id: number) => `https://www.mlb.com/player/${slug}-${id}`;
const wiki = (nameJa: string) => `https://ja.wikipedia.org/wiki/${encodeURIComponent(nameJa)}`;

export const PLAYERS: Player[] = [
  { slug: 'shohei-ohtani', nameJa: '大谷翔平', nameEn: 'Shohei Ohtani', mlbId: 660271,
    bio: '投打二刀流でMLBを代表するスーパースター。先発登板と本塁打を同時にこなす。',
    sameAs: [mlb('shohei-ohtani', 660271), wiki('大谷翔平')] },
  { slug: 'yoshinobu-yamamoto', nameJa: '山本由伸', nameEn: 'Yoshinobu Yamamoto', mlbId: 808967,
    bio: '日本球界からMLBに渡った先発右腕のエース格。多彩な変化球と制球が武器。',
    sameAs: [mlb('yoshinobu-yamamoto', 808967), wiki('山本由伸_(野球)')] },
  { slug: 'roki-sasaki', nameJa: '佐々木朗希', nameEn: 'Roki Sasaki', mlbId: 808963,
    bio: '「令和の怪物」と呼ばれる剛速球右腕。',
    sameAs: [mlb('roki-sasaki', 808963), wiki('佐々木朗希')] },
  { slug: 'shota-imanaga', nameJa: '今永昇太', nameEn: 'Shota Imanaga', mlbId: 684007,
    bio: '緩急と制球を武器にする先発左腕。',
    sameAs: [mlb('shota-imanaga', 684007), wiki('今永昇太')] },
  { slug: 'kodai-senga', nameJa: '千賀滉大', nameEn: 'Kodai Senga', mlbId: 673540,
    bio: '「お化けフォーク」を操る先発右腕。',
    sameAs: [mlb('kodai-senga', 673540), wiki('千賀滉大')] },
  { slug: 'seiya-suzuki', nameJa: '鈴木誠也', nameEn: 'Seiya Suzuki', mlbId: 673548,
    bio: '長打力のある右の外野手。',
    sameAs: [mlb('seiya-suzuki', 673548), wiki('鈴木誠也')] },
  { slug: 'masataka-yoshida', nameJa: '吉田正尚', nameEn: 'Masataka Yoshida', mlbId: 807799,
    bio: 'コンタクト力に優れた外野手／DH。',
    sameAs: [mlb('masataka-yoshida', 807799), wiki('吉田正尚')] },
  { slug: 'yusei-kikuchi', nameJa: '菊池雄星', nameEn: 'Yusei Kikuchi', mlbId: 579328,
    bio: '力のある速球を投げる先発左腕。',
    sameAs: [mlb('yusei-kikuchi', 579328), wiki('菊池雄星')] },
  { slug: 'yuki-matsui', nameJa: '松井裕樹', nameEn: 'Yuki Matsui', mlbId: 673513,
    bio: '三振を奪うリリーフ左腕。',
    sameAs: [mlb('yuki-matsui', 673513), wiki('松井裕樹')] },
  { slug: 'tomoyuki-sugano', nameJa: '菅野智之', nameEn: 'Tomoyuki Sugano', mlbId: 608372,
    bio: '日本球界で多くのタイトルを獲った実績を持つ先発右腕。',
    sameAs: [mlb('tomoyuki-sugano', 608372), wiki('菅野智之')] },
  { slug: 'kazuma-okamoto', nameJa: '岡本和真', nameEn: 'Kazuma Okamoto', mlbId: 672960,
    bio: '長距離砲の内野手。',
    sameAs: [mlb('kazuma-okamoto', 672960), wiki('岡本和真')] },
  { slug: 'munetaka-murakami', nameJa: '村上宗隆', nameEn: 'Munetaka Murakami', mlbId: 808959,
    bio: '日本で本塁打記録を打ち立てた強打の内野手。',
    sameAs: [mlb('munetaka-murakami', 808959), wiki('村上宗隆')] },
  { slug: 'tatsuya-imai', nameJa: '今井達也', nameEn: 'Tatsuya Imai', mlbId: 837227,
    bio: '日本球界出身の先発右腕。',
    sameAs: [mlb('tatsuya-imai', 837227), wiki('今井達也')] },
  { slug: 'rikuu-nishida', nameJa: '西田陸羽', nameEn: 'Rikuu Nishida', mlbId: 807747,
    bio: 'MLB組織に所属する日本人選手。',
    sameAs: [mlb('rikuu-nishida', 807747)] },
  // 日系（母が日本人）。birthCountry は米国なので jp 名簿の自動抽出には載らない＝明示で追加。
  { slug: 'lars-nootbaar', nameJa: 'ヌートバー', nameEn: 'Lars Nootbaar', mlbId: 663457,
    bio: '母が日本人の外野手。2023年WBCの侍ジャパンで活躍し、日本でも高い人気を集める。出塁能力と勝負強さが持ち味。',
    sameAs: [mlb('lars-nootbaar', 663457), wiki('ラーズ・ヌートバー')] },

  // ───── サイ・ヤング賞争いのライバル（rival）。大谷の対抗馬として一覧の専用ブロックに出す。
  // nameJa は既存記事のタグ表記に合わせて hub に記事が紐づくようにしている（threadsOf）。
  { slug: 'paul-skenes', nameJa: 'ポール・スキーンズ', nameEn: 'Paul Skenes', mlbId: 694973, rival: true,
    bio: '豪速球とスプリットで球界を席巻するパイレーツの右腕。新人離れした支配力でサイ・ヤング賞争いの中心にいる。',
    sameAs: [mlb('paul-skenes', 694973)] },
  { slug: 'cristopher-sanchez', nameJa: 'クリストファー・サンチェス', nameEn: 'Cristopher Sánchez', mlbId: 650911, rival: true,
    bio: '鋭いチェンジアップを武器にするフィリーズの左腕先発。安定した防御率でナ・リーグの上位に名を連ねる。',
    sameAs: [mlb('cristopher-sanchez', 650911)] },
  { slug: 'jacob-misiorowski', nameJa: 'ミシオロウスキー', nameEn: 'Jacob Misiorowski', mlbId: 694819, rival: true,
    bio: '100マイル超の速球を投げ込むブルワーズの右腕。圧倒的な奪三振力で「歩くビデオゲーム」と称される剛腕。',
    sameAs: [mlb('jacob-misiorowski', 694819)] },
  { slug: 'chris-sale', nameJa: 'クリス・セール', nameEn: 'Chris Sale', mlbId: 519242, rival: true,
    bio: '長いキャリアで何度もサイ・ヤング賞争いに名を連ねるブレーブスの左腕エース。健康なら球界屈指の支配力を誇る。',
    sameAs: [mlb('chris-sale', 519242)] },
  { slug: 'mason-miller', nameJa: 'メイソン・ミラー', nameEn: 'Mason Miller', mlbId: 695243, rival: true,
    bio: '100マイル超を投げ込むアスレチックスの守護神。圧巻の奪三振率でリリーフながら大きな注目を集める右腕。',
    sameAs: [mlb('mason-miller', 695243)] },
];

const BY_SLUG = new Map(PLAYERS.map((p) => [p.slug, p]));
const BY_JA = new Map(PLAYERS.map((p) => [p.nameJa, p]));

export function getPlayer(slug: string): Player | undefined {
  return BY_SLUG.get(slug);
}

/** 日本語名（記事 tags / stats[].player の値）→ ハブ slug。StatBox の選手名リンクに使う。 */
export function playerSlugByJaName(nameJa: string): string | undefined {
  return BY_JA.get(nameJa)?.slug;
}

/** その選手の記事（タグ or 成績ボックスに名前がある記事）。ハブのクラスタ・対象判定で使う。 */
export function threadsOf(player: Player, all: Thread[]): Thread[] {
  return all.filter(
    (t) =>
      (t.tags ?? []).includes(player.nameJa) ||
      (t.stats ?? []).some((s) => s.player === player.nameJa),
  );
}

/** スナップショットに MLBロースター級の今季成績があるか（hitting/pitching＋所属リーグ確定）。AAA等は league=null で除外。 */
export function hasMlbStats(season?: PlayerSeason | null): boolean {
  return Boolean(season && (season.hitting || season.pitching) && season.league);
}

/** ハブ /player/[slug] を作る対象か＝記事がある or MLBの今季成績がある（成績つきなら“薄いページ”ではない）。 */
export function hubEligible(player: Player, all: Thread[], season?: PlayerSeason | null): boolean {
  return threadsOf(player, all).length > 0 || hasMlbStats(season);
}
