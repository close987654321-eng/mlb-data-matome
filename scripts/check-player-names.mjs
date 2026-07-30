#!/usr/bin/env node
/**
 * 試合結果ボックスに出る選手名で、日本語表記が当たっていないものを洗い出す。
 *
 * 記事JSON（data/threads/mlb/*.json）の game.away/home.homers[].name と game.decisions の
 * 勝敗投手・セーブを集め、players.ts のカタログにも data/player-names-ja.json にも無い名前を並べる。
 * 出たぶんを player-names-ja.json にカタカナで足せば、既存記事も次のビルドから日本語表記になる
 * （未収録は英語表記のまま出るだけ＝壊れないので、毎日ではなく気づいた時に流す運用でよい）。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const namesJa = JSON.parse(readFileSync(path.join(root, 'data/player-names-ja.json'), 'utf8'));
// players.ts は TS なので import せず、公式英語表記だけ拾う（カタログにある選手はハブ側が正）。
const catalog = new Set(
  [...readFileSync(path.join(root, 'src/lib/players.ts'), 'utf8').matchAll(/nameEn:\s*'([^']+)'/g)].map(
    (m) => m[1],
  ),
);

const dir = path.join(root, 'data/threads/mlb');
const missing = new Map(); // 名前 → 出てくる記事の数（多い順に足すと効く）
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.json')) continue;
  const { game } = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
  if (!game) continue;
  const found = [];
  for (const side of [game.away, game.home]) for (const h of side?.homers ?? []) found.push(h.name);
  for (const key of ['winner', 'loser', 'save']) if (game.decisions?.[key]) found.push(game.decisions[key]);
  for (const name of found) {
    if (catalog.has(name) || namesJa[name]) continue;
    missing.set(name, (missing.get(name) ?? 0) + 1);
  }
}

if (!missing.size) {
  console.log(`OK: 日本語表記が当たっていない選手はいません（表 ${Object.keys(namesJa).length} 人）。`);
  process.exit(0);
}
console.log(`未収録 ${missing.size} 人（data/player-names-ja.json にカタカナで追記する）:`);
for (const [name, count] of [...missing].sort((a, b) => b[1] - a[1])) {
  console.log(`  "${name}": "",   // ${count}記事`);
}
