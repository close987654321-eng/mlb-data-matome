#!/usr/bin/env node
/**
 * 格闘技記事に `fight`（1試合の決着）を後追いで入れる。
 *
 *   node scripts/backfill-fight-meta.mjs <抽出JSON>            # 下見（既定＝書かない）
 *   node scripts/backfill-fight-meta.mjs <抽出JSON> --apply    # 書き込む
 *
 * なぜ要るか: 検索結果用タイトル（src/lib/fightSeo.ts）を組むため。実測の背景は
 * src/types/thread.ts の ThreadFight のコメント参照。
 *
 * ⚠️ このスクリプトの本体は「書き込み」ではなく **照合** です。
 * 抽出JSON の値は記事本文から読み取ったものだが、読み違い・取り違えが混ざりうるので、
 * 書く前に必ず記事自身（title.ja / summaryJa / tags）と突き合わせて、
 * 裏が取れないものは **書かずに落とす**。捏造をパイプラインの構造で防ぐ
 * （CLAUDE.md §4.4・data/game-voices.json と同じ思想）。
 *
 * 抽出JSON の形（配列）:
 *   { "id": "...", "aJa": "...", "bJa": "...", "winnerJa": "...", "methodJa": "...", "round": 1, "eventJa": "..." }
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SPORTS = ['mma', 'boxing'];

/** 記事の探索（sport フォルダを総当たり）。 */
async function findArticle(id) {
  for (const sport of SPORTS) {
    const file = path.join(process.cwd(), 'data', 'threads', sport, `${id}.json`);
    try {
      return { file, sport, thread: JSON.parse(await fs.readFile(file, 'utf8')) };
    } catch {
      /* 次の競技を試す */
    }
  }
  return null;
}

/**
 * 名前が記事本文で裏取りできるか。
 * 記事は「アジズベク・テミロフ」をタグに持ちつつ本文では「テミロフ」と略すことがあるので、
 * フルネーム一致か、中黒で割った区切りのどれかが本文に出ていれば可とする。
 * 逆に**どの断片も出てこない名前は採用しない**（＝取り違えをここで落とす）。
 */
function nameFound(name, haystack) {
  if (haystack.includes(name)) return 'full';
  const parts = name.split(/[・=]/).filter((p) => p.length >= 2);
  for (const p of parts) if (haystack.includes(p)) return `part:${p}`;
  return null;
}

/** 決着の表記が本文にあるか（「判定3-0」は「判定」まで緩めて見る）。 */
function methodFound(method, haystack) {
  if (haystack.includes(method)) return true;
  const base = method.replace(/[0-9０-９\-‐−ー]/g, '');
  return base.length > 0 && haystack.includes(base);
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const src = argv.find((a) => !a.startsWith('-'));
  if (!src) {
    console.error('使い方: node scripts/backfill-fight-meta.mjs <抽出JSON> [--apply]');
    process.exit(1);
  }

  const rows = JSON.parse(await fs.readFile(src, 'utf8'));
  const wrote = [];
  const skipped = [];

  for (const row of rows) {
    const found = await findArticle(row.id);
    if (!found) {
      skipped.push([row.id, '記事が見つからない']);
      continue;
    }
    const { file, thread } = found;
    // 照合に使う干し草＝記事が自分で名乗っている文字列だけ（外部知識は混ぜない）。
    const hay = [thread.title?.ja ?? '', thread.title?.en ?? '', thread.summaryJa ?? '', ...(thread.tags ?? [])].join(
      '\n',
    );

    const a = nameFound(row.aJa, hay);
    const b = nameFound(row.bJa, hay);
    if (!a || !b) {
      skipped.push([row.id, `名前が本文で確認できない（${!a ? row.aJa : row.bJa}）`]);
      continue;
    }
    if (row.winnerJa && row.winnerJa !== row.aJa && row.winnerJa !== row.bJa) {
      skipped.push([row.id, `勝者が対戦者と一致しない（${row.winnerJa}）`]);
      continue;
    }
    if (row.methodJa && !methodFound(row.methodJa, hay)) {
      skipped.push([row.id, `決着「${row.methodJa}」が本文に無い`]);
      continue;
    }
    if (row.eventJa && !nameFound(row.eventJa, hay)) {
      skipped.push([row.id, `興行名「${row.eventJa}」が本文に無い`]);
      continue;
    }

    // 未定義キーを混ぜない（JSON に "winnerJa": null を残さない）。
    const fight = { aJa: row.aJa, bJa: row.bJa };
    if (row.winnerJa) fight.winnerJa = row.winnerJa;
    if (row.methodJa) fight.methodJa = row.methodJa;
    if (Number.isInteger(row.round)) fight.round = row.round;
    if (row.eventJa) fight.eventJa = row.eventJa;

    if (JSON.stringify(thread.fight) === JSON.stringify(fight)) {
      skipped.push([row.id, '変更なし']);
      continue;
    }

    /*
      ⚠️ JSON.parse → JSON.stringify で書き戻さない。
      記事JSONは「コメント1件＝1行」の詰めた書式で揃えてあり（matome が書く形）、
      再文字列化すると全行が展開されて1本あたり200行超の差分になる＝実際に足したのは
      6行なのにレビューできない差分になり、履歴も汚れる（2026-08-12 に一度やって戻した）。
      なので **テキストとして tags 行の直前に1行差し込む**。
    */
    const text = await fs.readFile(file, 'utf8');
    // 記事JSONの1行オブジェクトの書式（`{ "k": v, "k2": v2 }`）に合わせる＝コメント行・tags 行と同じ見た目。
    const inline = `{ ${Object.entries(fight)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(', ')} }`;
    const line = `  "fight": ${inline},\n`;
    let next;
    if (/^ {2}"fight":/m.test(text)) {
      // 既に持っている記事は、その1行だけを差し替える。
      next = text.replace(/^ {2}"fight":.*\n/m, line);
    } else if (/^ {2}"tags":/m.test(text)) {
      next = text.replace(/^( {2}"tags":)/m, `${line}$1`);
    } else {
      skipped.push([row.id, 'tags 行が見つからず挿入位置を決められない']);
      continue;
    }
    // 壊れたJSONを書かない最終ガード（差し込みは文字列操作なので必ず検算する）。
    try {
      const check = JSON.parse(next);
      if (JSON.stringify(check.fight) !== JSON.stringify(fight)) throw new Error('fight が一致しない');
    } catch (e) {
      skipped.push([row.id, `差し込み後のJSONが不正: ${e.message}`]);
      continue;
    }

    wrote.push([row.id, `${fight.aJa} vs ${fight.bJa}｜${fight.winnerJa ?? '勝者不明'} ${fight.methodJa ?? ''}`.trim()]);
    if (apply) await fs.writeFile(file, next);
  }

  for (const [id, note] of wrote) console.log(`${apply ? '書込' : '対象'}  ${id}\n        ${note}`);
  if (skipped.length) {
    console.log(`\n--- 見送り ${skipped.length} 件 ---`);
    for (const [id, why] of skipped) console.log(`  ${id}: ${why}`);
  }
  console.log(`\n${apply ? '書き込み' : '対象'} ${wrote.length} 件 / 見送り ${skipped.length} 件`);
  if (!apply) console.log('※ 下見のみ。書き込むには --apply');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
