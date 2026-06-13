#!/usr/bin/env node
// Reddit から「海外の反応」まとめの元データを取得する（MLB / ボクシング / MMA）。
//
// 競技ごとの取得元 subreddit:
//   MLB     : r/baseball, r/mlb
//   Boxing  : r/Boxing
//   UFC     : r/MMA, r/ufc
// 取得した内容を data/threads/{sport}/{id}.json（src/types/thread.ts の Thread 形式）へ。
//
// 未認証の www.reddit.com/.json は IP ブロックで 403 になるため、必ず公式 OAuth
// （script アプリの password grant）を使う。これはブロックを受けない。
//
// 事前準備:
//   1. https://www.reddit.com/prefs/apps で "script" タイプのアプリを作成
//   2. 以下を環境変数に設定（.env.local 等。リポジトリにコミットしないこと）
//        REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET,
//        REDDIT_USERNAME, REDDIT_PASSWORD,
//        REDDIT_USER_AGENT  (例: "mlb-matome/0.1 by /u/yourname")
//
// 使い方:
//   node scripts/fetch-reddit.mjs list r/baseball week 8     # 人気スレ一覧（MLB）
//   node scripts/fetch-reddit.mjs list r/Boxing week 8       # 〃（ボクシング）
//   node scripts/fetch-reddit.mjs list r/MMA week 8          # 〃（UFC/MMA）
//   node scripts/fetch-reddit.mjs thread <permalink|url> 40  # スレ本文+上位コメント
//
// 出力は生 JSON（整形済み）。これを Claude に渡して data/threads/{season}/{id}.json
// （src/types/thread.ts の Thread 形式）へ翻訳・要約させる。

const UA = process.env.REDDIT_USER_AGENT ?? 'mlb-matome/0.1';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}. See the header of this file for setup.`);
    process.exit(1);
  }
  return v;
}

async function getToken() {
  const id = requireEnv('REDDIT_CLIENT_ID');
  const secret = requireEnv('REDDIT_CLIENT_SECRET');
  const username = requireEnv('REDDIT_USERNAME');
  const password = requireEnv('REDDIT_PASSWORD');

  const body = new URLSearchParams({ grant_type: 'password', username, password });
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body,
  });
  if (!res.ok) {
    console.error(`Token request failed: HTTP ${res.status}\n${await res.text()}`);
    process.exit(1);
  }
  return (await res.json()).access_token;
}

async function api(token, pathAndQuery) {
  const url = `https://oauth.reddit.com${pathAndQuery}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA },
  });
  if (!res.ok) {
    console.error(`API failed: HTTP ${res.status} for ${url}\n${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

function permalinkToPath(input) {
  // フル URL でもパスだけでも受ける
  try {
    return new URL(input).pathname;
  } catch {
    return input.startsWith('/') ? input : `/${input}`;
  }
}

async function main() {
  const [cmd, arg, arg2, arg3] = process.argv.slice(2);
  const token = await getToken();

  if (cmd === 'list') {
    const sub = (arg ?? 'r/baseball').replace(/^\//, '');
    const t = arg2 ?? 'week';
    const limit = arg3 ?? '8';
    const data = await api(token, `/${sub}/top?t=${t}&limit=${limit}&raw_json=1`);
    const rows = data.data.children.map((c) => ({
      title: c.data.title,
      flair: c.data.link_flair_text,
      score: c.data.score,
      num_comments: c.data.num_comments,
      permalink: c.data.permalink,
      url: `https://www.reddit.com${c.data.permalink}`,
    }));
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (cmd === 'thread') {
    if (!arg) {
      console.error('Usage: node scripts/fetch-reddit.mjs thread <permalink|url> [commentLimit]');
      process.exit(1);
    }
    const path = permalinkToPath(arg).replace(/\/$/, '');
    const limit = arg2 ?? '50';
    const data = await api(token, `${path}?limit=${limit}&sort=top&raw_json=1`);
    const post = data[0].data.children[0].data;
    const comments = data[1].data.children
      .filter((c) => c.kind === 't1')
      .map((c) => ({ author: c.data.author, score: c.data.score, body: c.data.body }));
    console.log(
      JSON.stringify(
        {
          title: post.title,
          subreddit: `r/${post.subreddit}`,
          flair: post.link_flair_text,
          num_comments: post.num_comments,
          url: `https://www.reddit.com${post.permalink}`,
          selftext: post.selftext || null,
          comments,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.error('Usage:\n  node scripts/fetch-reddit.mjs list <subreddit> <hour|day|week|month> <limit>\n  node scripts/fetch-reddit.mjs thread <permalink|url> <commentLimit>');
  process.exit(1);
}

main();
