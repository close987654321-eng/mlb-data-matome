# kpi-weekly 初回セットアップ（人タスク＝村山さん・所要15分）

> ✅ **両店とも設定済み（2026-07-02 開通確認）**。以下は再発行・3号店追加時の手順。
> 確定値: SA=`kpi-weekly@gen-lang-client-0996954181.iam.gserviceaccount.com`（鍵は
> `~/secrets/kpi-weekly-sa.json`）/ GA4 プロパティID: 1号店=541315640・2号店=541564295
> （※397718724 は**アカウントID**なので使わない＝初回に403でハマった原因）/
> GSC: 両ドメインとも sc-domain 型で SA に制限付き権限付与済み。

コードは全部できている。足りないのは Google の鍵だけ。以下を1回だけやれば動く。

## §1. サービスアカウントを作る（Google Cloud Console）

1. https://console.cloud.google.com/ → プロジェクトを選ぶ
   （YouTube API キーを発行したのと同じプロジェクトでよい。新規でもよい）
2. 「APIとサービス」→「ライブラリ」で以下2つを**有効化**:
   - **Google Analytics Data API**
   - **Google Search Console API**
3. 「APIとサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」
   - 名前: `kpi-weekly`（任意）。ロールは**付けなくてよい**（GA4/GSC側で権限を付けるため）
4. 作ったサービスアカウントを開く →「キー」タブ →「鍵を追加」→「新しい鍵を作成」→ **JSON**
   - ダウンロードされた JSON を安全な場所に置く（例: `~/secrets/kpi-weekly-sa.json`）
   - ⚠️ この JSON は**絶対にリポジトリに置かない・コミットしない**
5. サービスアカウントの**メールアドレス**（`kpi-weekly@〜.iam.gserviceaccount.com`）をコピーしておく

## §2. 閲覧権限を付ける（GA4 と Search Console）

1. **GA4**: https://analytics.google.com/ → 管理（歯車）→ プロパティの「アクセス管理」→
   「＋」→ §1-5 のメールを追加 → 役割は**閲覧者**
2. 同じ管理画面の「プロパティ設定」で **プロパティID（数値）** を控える
   （`G-XSL1S5LQH0` は測定ID。それではなく数値のID）
3. **Search Console**: https://search.google.com/search-console → 設定 →「ユーザーと権限」→
   「ユーザーを追加」→ 同じメール → 権限は**制限付き**で足りる

## §3. 環境変数を置く

### ローカル（手動実行用）

`.env.local` に追記:

```
GA4_PROPERTY_ID=（§2-2 の数値）
GOOGLE_APPLICATION_CREDENTIALS=/Users/rt_murayama/secrets/kpi-weekly-sa.json
# GSC のプロパティが URL プレフィックス型の場合のみ（既定は sc-domain:matome-mlb-kaigai.jp）
# GSC_SITE=https://matome-mlb-kaigai.jp/
```

動作確認:

```bash
node scripts/fetch-kpi.mjs weekly        # サマリが出ればOK
node scripts/fetch-kpi.mjs sites         # GSC 403/404 の時はここで正しいサイト表記を確認
```

### クラウド（毎週月曜 07:00 JST の定期実行用）

jp-games ルーティンと同じ環境シークレットに登録:

- `GA4_PROPERTY_ID` = 数値ID
- `GOOGLE_SERVICE_ACCOUNT_JSON_B64` = JSONキーの base64。作り方:
  ```bash
  base64 -i ~/secrets/kpi-weekly-sa.json | pbcopy
  ```
- （必要なら）`GSC_SITE`

登録できたら Claude に「kpi-weekly のクラウドルーティン作って」と言えば、
毎週月曜 07:00 JST・kpi-weekly スキル実行・Slack DM 送付のルーティンを登録する
（jp-games の trig_01APonKgT3N64SDM3TeB9Cc5 と同じ仕組み・別トリガー）。

## つまずきポイント

- **GSC 403**: §2-3 の権限追加漏れ、またはサイト表記ズレ（sc-domain 型 vs URLプレフィックス型）。
  `sites` コマンドで一覧を見て `GSC_SITE` を合わせる。
- **GA4 403**: §2-1 の閲覧者追加漏れ、または API 有効化漏れ（§1-2）。
- **Discover の数字が全部0**: 異常ではない。未点火なだけ（それを毎週監視するのがこのスキル）。
- **GA4 と GSC で数字が合わない**: 仕様（計測方法が違う）。ダイジェストは比較しない設計にしてある。
