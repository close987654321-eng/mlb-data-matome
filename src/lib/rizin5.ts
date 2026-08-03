/**
 * 超RIZIN.5 特設ハブ（/rizin5）のコンテンツ＝唯一の正。
 *
 * 「開催前から1URLを育てる」イベント観測ハブの初号機（allstar.ts の期間限定ハブ＋
 * player-journal の記事育成型を合体させた器）。散発記事でなくこのLPに
 * 因縁×戦績×ロード（開催までの動き）を積み、開催が近づくほど中身が盛り上がる構造にする。
 * 将来の VOD アフィリエイト（ABEMA 等）の成約導線＝money page もここ（#watch）。
 *
 * ⚠️ 事実整合ルール（CLAUDE.md §4.4 と同じ）:
 * - 書いてよいのは公式発表・報道・Wikipedia の戦績表で裏取りした事実だけ。未確認は「未発表」と正直に書く。
 * - 引用（quotes）は報道された発言の逐語＋出典。創作・要約改変は禁止。
 * - 戦績・直近試合は recordAsOf / 日付を必ず持つ（fighters.ts と同じ規律）。
 * - 写真は Wikimedia Commons の CC ライセンス画像だけ（public/media/rizin5/）。クレジット必須。
 *   放送画面・公式サイトからの転載は絶対にしない。
 * - 地の文（story / road body）は俺ボイス＝山場は人が書く。クラウド無人実行では
 *   このファイルの編集をしない（season-journal と同じ規律＝matome 手順5c）。
 *
 * 会期後: enabled=false で sitemap から外し、ページは記録として残すか撤去を判断。
 */

export type Rizin5Quote = {
  /** 発言者（表記は報道どおり） */
  speaker: string;
  /** 報道された発言の逐語（一字も変えない） */
  text: string;
  /** 出典（媒体名・会見名など） */
  source: string;
};

export type Rizin5Fight = {
  /** 試合日（表示用・YYYY.M.D） */
  date: string;
  /** 対戦相手 */
  vsJa: string;
  /** 結果（○/×/NC＋決着。公式リザルトのみ） */
  resultJa: string;
};

export type Rizin5Fighter = {
  name: string;
  /** 肩書き・一言（裏取りした事実のみ） */
  noteJa?: string;
  /** 通算戦績の表示文字列（例「MMA19勝6敗1無効試合」）。未検証なら持たない */
  record?: string;
  /** 戦績の基準日＝最終試合日（record を持つなら必須） */
  recordAsOf?: string;
  /** 直近の試合（新しい順・Wikipedia 戦績表で裏取り済みのみ） */
  recentFights?: Rizin5Fight[];
  /** 選手写真（Wikimedia Commons の CC ライセンス画像のみ・クレジット必須） */
  photo?: { src: string; creditJa: string; href: string };
};

export type Rizin5Card = {
  order: number;
  weightJa: string;
  /** タイトルマッチ等の公式表記（通常試合は持たない） */
  titleJa?: string;
  left: Rizin5Fighter;
  right: Rizin5Fighter;
  /** 因縁ラベル（このカードの背景を1行で。無いカードは持たない） */
  feudJa?: string;
  /** 因縁の地の文（俺ボイス）。空配列＝まだ書いていない（画面には出さない） */
  story: string[];
  /** 会見・報道の実在発言（逐語＋出典） */
  quotes?: Rizin5Quote[];
};

export type Rizin5RoadEntry = {
  /** 出来事の日付（試合日・会見日基準＝season-journal と同じ） */
  date: string;
  titleJa: string;
  body: string[];
  /** 関連リンク（内部記事 or 公式）。internal=true ならサイト内パス */
  link?: { href: string; labelJa: string; internal?: boolean };
};

export const RIZIN5 = {
  enabled: true,
  /** 開催日（JST） */
  eventDate: '2026-09-10',
  dateLabelJa: '2026年9月10日（木）',
  doorLabelJa: '15:00開場／17:00開演予定',
  venueJa: '京セラドーム大阪',
  nameJa: '超RIZIN.5 浪速の超復活祭り',
  /** ページ内容の最終更新日（dateModified・sitemap lastmod に使う） */
  updatedAt: '2026-08-03',
  /** この大会の反応記事を束ねるタグ（記事の tags に付けるとハブの関連枠に自動で並ぶ） */
  matchTags: ['RIZIN', '超RIZIN.5'],

  /** 導入の地の文（俺ボイス）＝このハブの編集の背骨。 */
  introJa: [
    '大会名は浪速の超復活祭り。でも俺にはどうしても、朝倉未来サーガの総集編に見えてる。発表された8試合の名簿を眺めてたら気づいてしまった。朝倉未来と過去に拳を交えた男が、この大会に6人いる。',
    'RIZINに来て最初の相手が未来だったダウトベック。2020年に初めて土をつけた斎藤裕。2023年の王座戦で未来を絞め落としたケラモフ。同じ年にキックのリングで77秒で沈めたYA-MAN。2024年、引退宣言まで追い込んだ平本蓮。そして去年の大晦日、担架で運ばれるまで壊したシェイドゥラエフ。全員が同じ夜の京セラドームに集まってくる。',
    'しかもこの6人、互いにも潰し合ってる。平本は斎藤に負けてYA-MANに勝ってて、そのYA-MANはダウトベックに負けてる。ケラモフはサトシの王座にも挑んで散ってる。相関図を書いたら線が渋滞して読めなくなった。こんな大会は見たことがない。',
    'で、当の本人の復帰戦の相手が、11年ぶりに帰ってきた青木真也。こんな配牌ある？',
    'このページは超RIZIN.5の観測所。カードの因縁と戦績を下に全部並べて、ここから開催当日まで、会見も練習動画の騒ぎも現地の反応も全部ここに書き足していく。ブックマークしておいてもらえたら、9月10日はたぶんもっと楽しい。',
  ],

  /** 視聴方法（#watch）。公式発表が出るまで「未発表」を正直に出す。 */
  viewing: {
    /** 公式発表があったら true にして platforms を確定情報に書き換える */
    announced: false,
    noteJa:
      '超RIZIN.5の配信・PPVの公式発表はまだ出ていない（2026年8月3日時点）。これまでのRIZINの大型大会はABEMA・U-NEXT・スカパー!・RIZIN LIVEなどでPPV販売されてきたので、発表され次第この欄を更新する。',
  },

  cards: [
    {
      order: 1,
      weightJa: '66.0kg',
      titleJa: 'RIZIN＆PFLフェザー級タイトルマッチ',
      left: {
        name: 'ラジャブアリ・シェイドゥラエフ',
        noteJa: 'RIZINフェザー級王者・キルギス。19戦全勝で判定決着ゼロ（7KO・12一本）',
        record: 'MMA19勝0敗',
        recordAsOf: '2026-04-12',
        recentFights: [
          { date: '2026.4.12', vsJa: '久保優太', resultJa: '○ 1R 4:13 TKO' },
          { date: '2025.12.31', vsJa: '朝倉未来', resultJa: '○ 1R 2:54 TKO' },
          { date: '2025.9.28', vsJa: 'ビクター・コレスニック', resultJa: '○ 1R 0:33 TKO' },
        ],
        photo: {
          src: '/media/rizin5/shaydullaev.jpg',
          creditJa: 'ホタテマン0010（CC BY 4.0・Wikimedia Commons）',
          href: 'https://commons.wikimedia.org/wiki/File:Razhabali_Shaidulloev.png',
        },
      },
      right: {
        name: 'AJ・マッキー',
        noteJa: '元Bellator世界フェザー級王者・米国。PFL参戦中で3連勝',
        record: 'MMA25勝2敗',
        recordAsOf: '2026-06-27',
        recentFights: [
          { date: '2026.6.27', vsJa: 'サラマト・イスブラエフ', resultJa: '○ 判定3-0' },
          { date: '2026.3.20', vsJa: 'アダム・ボリッチ', resultJa: '○ 判定3-0' },
          { date: '2025.7.19', vsJa: 'アフメド・マゴメドフ', resultJa: '○ 判定3-0' },
        ],
      },
      feudJa: 'シェイドゥラエフは2025年大晦日に朝倉未来を1R2分54秒TKOで沈めた現王者',
      story: [
        'メインはそのシェイドゥラエフ。19戦19勝、判定までいったことが一度もない。7つのKOと12の一本で全部フィニッシュ。大晦日に未来を沈めたあの圧を、今度は元Bellator世界王者のAJマッキーにぶつける。RIZINとPFLの2本のベルトが懸かるダブルタイトルマッチで、いま日本のリングで組める最高峰だと思う。',
        'マッキーも役者が違う。デビューから18連勝でBellatorの頂点まで駆け上がって、ピットブルを1Rで絞め落として賞金100万ドルのグランプリまで獲った男。いまはPFLで3連勝中と仕上がってる。無敗の怪物に初めて土をつけるならこいつしかいないっていう配役で、王者の底が見えるのか、化け物の証明がまた1個増えるのか。どっちに転んでも歴史の目撃者になれる。',
      ],
    },
    {
      order: 2,
      weightJa: '71.0kg',
      left: {
        name: '朝倉未来',
        noteJa: '34歳。担架で運ばれた大晦日の王座挑戦から253日ぶりの復帰戦',
        record: 'MMA19勝6敗1無効試合',
        recordAsOf: '2025-12-31',
        recentFights: [
          { date: '2025.12.31', vsJa: 'シェイドゥラエフ', resultJa: '× 1R 2:54 TKO' },
          { date: '2025.7.27', vsJa: 'クレベル・コイケ', resultJa: '○ 判定2-1' },
          { date: '2025.5.4', vsJa: '鈴木千裕', resultJa: '○ 3R 1:57 TKO' },
          { date: '2024.7.28', vsJa: '平本蓮', resultJa: '× 1R 2:18 TKO' },
        ],
        photo: {
          src: '/media/rizin5/mikuru-asakura.jpg',
          creditJa: 'Gyutan329pii（2019年RIZIN.15・CC BY-SA 4.0・Wikimedia Commons）',
          href: 'https://commons.wikimedia.org/wiki/File:%E6%9C%9D%E5%80%89%E6%9C%AA%E6%9D%A5.jpg',
        },
      },
      right: {
        name: '青木真也',
        noteJa: '43歳。元DREAM・元ONE世界ライト級王者。RIZIN参戦は旗揚げ戦以来11年ぶり',
        record: 'MMA50勝12敗',
        recordAsOf: '2025-11-16',
        recentFights: [
          { date: '2025.11.16', vsJa: '手塚裕之', resultJa: '× 2R TKO' },
          { date: '2025.3.23', vsJa: 'エドゥアルド・フォラヤン', resultJa: '○ 1R 0:53 腕ひしぎ十字' },
          { date: '2024.1.28', vsJa: 'ジョン・リネカー', resultJa: '○ 1R 一本' },
        ],
        photo: {
          src: '/media/rizin5/shinya-aoki.jpg',
          creditJa: 'Evolve MMA（2011年撮影・CC BY 3.0・Wikimedia Commons）',
          href: 'https://commons.wikimedia.org/wiki/File:Shinya_Aoki_at_Evolve_MMA_in_Singapore_(cropped).jpg',
        },
      },
      feudJa: '本人。この大会に出る6人と拳を交えてきた男が、7人目の因縁を作りに戻ってくる',
      story: [
        '去年の大晦日を見てた人なら分かると思う。シェイドゥラエフに1R2分54秒で壊されて、担架で運ばれていった朝倉未来。3度目の王座挑戦がいちばん残酷な形で終わって、正直もう見られないかもしれないと思った。その復帰戦の相手が青木真也。RIZINのリングは旗揚げ戦で桜庭和志を破った2015年12月以来、11年ぶりになる。',
        '43歳の青木は直近の11月、ONEで手塚裕之に2RTKOで敗れてる。恥ずかしながら、恥を忍んで、という会見の言葉は負けた直後の帰還だからこそ重い。ただ、枯れたと思ったら多分火傷する。去年3月にはフォラヤンを53秒の腕十字で極めてるし、その前のリネカー戦も1Rで終わらせた。50勝のうち一本勝ちが32。この年齢でも極めの精度が落ちてない寝技師とか、普通にホラーでしょ。',
        '未来はグラップリングでも負ける気はしないと言い切った。それに対する青木の返しが、残念だったな俺だよ。この距離感のまま9月10日まで転がっていくと思うと、もう楽しみで仕方ない。',
      ],
      quotes: [
        {
          speaker: '朝倉未来',
          text: '日本が盛り上がるカード。グラップリングでも負ける気はしない',
          source: 'デイリースポーツ（7月20日・対戦カード発表会見）',
        },
        {
          speaker: '朝倉未来',
          text: '1ラウンドで終わらせます',
          source: 'デイリースポーツ（7月20日・対戦カード発表会見）',
        },
        {
          speaker: '青木真也',
          text: '残念だったな、俺だよ',
          source: '東スポWEB（7月20日）・本人のYouTubeでも同題の動画を公開',
        },
        {
          speaker: '青木真也',
          text: '恥ずかしながら。恥を忍んで帰ってきました',
          source: 'TOKYO HEADLINE（7月20日・対戦カード発表会見）',
        },
      ],
    },
    {
      order: 3,
      weightJa: '71.0kg',
      left: {
        name: 'ホベルト・サトシ・ソウザ',
        noteJa: '元RIZINライト級王者。2025年大晦日、開始13秒の膝で王座陥落',
        record: 'MMA20勝4敗',
        recordAsOf: '2025-12-31',
        recentFights: [
          { date: '2025.12.31', vsJa: 'イルホム・ノジモフ', resultJa: '× 1R 0:13 KO' },
          { date: '2025.9.28', vsJa: '堀江圭功', resultJa: '○ 1R 1:40 リアネイキドチョーク' },
          { date: '2025.5.31', vsJa: 'キ・ウォンビン', resultJa: '○ 1R 0:50 リアネイキドチョーク' },
        ],
        photo: {
          src: '/media/rizin5/satoshi-souza.jpg',
          creditJa: 'Gyutan329pii（2020年RIZIN.22・CC BY-SA 4.0・Wikimedia Commons）',
          href: 'https://commons.wikimedia.org/wiki/File:%E3%83%9B%E3%83%99%E3%83%AB%E3%83%88%E3%83%BB%E3%82%B5%E3%83%88%E3%82%B7%E3%83%BB%E3%82%BD%E3%82%A6%E3%82%B6.jpg',
        },
      },
      right: {
        name: '野村駿太',
        noteJa: '28歳・アメリカン・トップチーム。現王者グスタボとパトリッキー・ピットブルを連破',
        record: 'MMA10勝2敗',
        recordAsOf: '2025-07-27',
        recentFights: [
          { date: '2025.7.27', vsJa: 'パトリッキー・ピットブル', resultJa: '○ 判定3-0' },
          { date: '2025.3.30', vsJa: 'ルイス・グスタボ', resultJa: '○ 3R テクニカル判定3-0' },
          { date: '2024.9.16', vsJa: '江藤公洋', resultJa: '○ 判定5-0' },
        ],
      },
      feudJa: '怪我で何度も流れた末にようやく実現する、元王者と王者キラーの宿題マッチ',
      story: [
        'サトシの大晦日は13秒だった。ノジモフの右膝一発で王座もろとも吹き飛んで、ライト級の勢力図はそこから一気に動いた。柔術仕込みの絞めで長くライト級に君臨してきた男が、キャリアでいちばん残酷な負け方をした夜。',
        'で、相手の野村駿太が地味にいちばん危ない。パトリッキー・ピットブルを破って、いまのライト級王者グスタボにも勝ってる28歳。この一戦は野村の眼窩底骨折や膝の大怪我で何度も流れてきた宿題で、ようやく実現する。元王者の再起戦のはずが、中身はほぼ次期挑戦者決定戦になってしまった。',
      ],
      quotes: [
        {
          speaker: '野村駿太',
          text: '年末、僕の怪我でサトシ選手との試合を飛ばしてしまった',
          source: 'ゴング格闘技（7月20日・対戦カード発表会見）',
        },
      ],
    },
    {
      order: 4,
      weightJa: '66.0kg',
      left: {
        name: 'カルシャガ・ダウトベック',
        noteJa: '32歳・カザフスタン。11連勝中。アマボクシング国内王者出身の左ストレート',
        record: 'MMA20勝3敗',
        recordAsOf: '2026-07-18',
        recentFights: [
          { date: '2026.7.18', vsJa: '萩原京平', resultJa: '○ 1R 4:08 TKO' },
          { date: '2025.12.31', vsJa: '久保優太', resultJa: 'NC（偶発的なアイポーク）' },
          { date: '2025.3.30', vsJa: '鈴木千裕', resultJa: '○ 判定2-1' },
        ],
        photo: {
          src: '/media/rizin5/dautbek.jpg',
          creditJa: 'Наш БОЕЦ（YouTube・CC BY 3.0・Wikimedia Commons）',
          href: 'https://commons.wikimedia.org/wiki/File:Karshyga_Dautbek.png',
        },
      },
      right: {
        name: '平本蓮',
        noteJa: '28歳・剛毅會。MMAは2024年7月の朝倉未来戦以来774日ぶり',
        record: 'MMA4勝3敗（キック11勝4敗）',
        recordAsOf: '2024-07-28',
        recentFights: [
          { date: '2024.7.28', vsJa: '朝倉未来', resultJa: '○ 1R 2:18 TKO' },
          { date: '2023.12.31', vsJa: 'YA-MAN', resultJa: '○ 判定3-0' },
          { date: '2023.4.29', vsJa: '斎藤裕', resultJa: '× 判定1-2' },
        ],
        photo: {
          src: '/media/rizin5/ren-hiramoto.jpg',
          creditJa: 'ホタテマン0010（2024年超RIZIN.3・CC BY 4.0・Wikimedia Commons）',
          href: 'https://commons.wikimedia.org/wiki/File:%E5%B9%B3%E6%9C%AC%E8%93%AE_%E8%B6%85RIZIN3_(cropped).png',
        },
      },
      feudJa:
        '平本は2024年に朝倉未来を1R2分18秒KO。ダウトベックはRIZINデビュー戦（2018年）で唯一朝倉未来に敗れて以降11連勝',
      story: [
        '個人的にいちばんざわついてるのがこれ。平本蓮のMMAは、未来をKOしたあの夜以来774日ぶり。あの試合のあとドーピング疑惑で燃えに燃えて、検査結果は陰性。それでも消えなかった空気ごと全部、リングの上で晴らすしかない状況での復帰戦になる。',
        '相手が優しくない。ダウトベックはいま11連勝中で、7月には萩原京平を1Rで沈めたばかり。カザフスタンのアマボクシング王者上がりの左は、たぶん今のフェザー級でいちばん怖い一発。しかもその萩原、平本がMMAデビュー戦で敗れた相手でもある。平本が6年かけて越えてきた壁を、ダウトベックは4分で片付けてから来る。',
        'RIZINで負けたのがデビュー戦の朝倉未来だけっていうのも、この大会だと出来すぎてる。復帰戦で自分がいちばん強いと思う相手と当ててもらったと平本は言う。この男の大口が口だけで終わらなかったことは、未来戦を見た人なら知ってるはず。',
      ],
      quotes: [
        {
          speaker: '平本蓮',
          text: '死ぬつもりで勝ちに行きます',
          source: 'ENCOUNT（7月20日・対戦カード発表会見）',
        },
        {
          speaker: '平本蓮',
          text: '俺ならシェイドゥラエフをKOできるんじゃないかという試合を見せたい',
          source: 'TOKYO HEADLINE（7月20日・対戦カード発表会見）',
        },
      ],
    },
    {
      order: 5,
      weightJa: '66.0kg',
      left: {
        name: '斎藤裕',
        noteJa: '初代RIZINフェザー級王者。2024年7月以来2年ぶりの復帰戦',
        record: 'MMA21勝9敗2分',
        recordAsOf: '2024-07-28',
        recentFights: [
          { date: '2024.7.28', vsJa: '久保優太', resultJa: '× 2R 4:19 KO' },
          { date: '2023.12.31', vsJa: 'クレベル・コイケ', resultJa: '× 3R 1:22 ダースチョーク' },
          { date: '2023.4.29', vsJa: '平本蓮', resultJa: '○ 判定2-1' },
        ],
      },
      right: {
        name: 'YA-MAN',
        noteJa: 'キック14勝5敗からMMA転向。2023年にキックルールで朝倉未来を77秒KO',
        record: 'MMA3勝2敗',
        recordAsOf: '2025-07-27',
        recentFights: [
          { date: '2025.7.27', vsJa: '金原正徳', resultJa: '○ 3R 2:51 TKO' },
          { date: '2024.12.31', vsJa: 'カルシャガ・ダウトベック', resultJa: '× 判定0-3' },
          { date: '2024.7.28', vsJa: '鈴木博昭', resultJa: '○ 1R 3:28 KO' },
        ],
      },
      feudJa:
        '斎藤は2020年の王座決定戦で朝倉未来に勝利（翌年未来が雪辱）。YA-MANは2023年にキックで朝倉未来をKO。しかも2人とも平本蓮と対戦済み',
      story: [
        '復活祭りの看板にいちばん忠実なのは、実はこの試合かもしれない。斎藤裕は初代フェザー級王者で、2020年の王座決定戦で未来を判定で破った男。その斎藤も久保優太に沈められてから2年間リングを離れてて、崖っぷちからの復帰戦になる。最後に勝った相手が平本蓮っていうのがまた、この大会らしい。',
        'YA-MANは2023年11月、キックのリングで未来を77秒で沈めた男。MMAに転向してからは平本にもダウトベックにも敗れたけど、去年の夏に金原正徳をTKOで仕留めて流れが変わってきた。未来に勝った者同士が、未来の復帰戦の夜にMMAで交わる。相関図が渋滞してるとはこのこと。',
      ],
    },
    {
      order: 6,
      weightJa: '66.0kg',
      left: {
        name: 'ヴガール・ケラモフ',
        noteJa: '元RIZINフェザー級王者・アゼルバイジャン。2023年の王座決定戦で朝倉未来に一本勝ち',
        record: 'MMA21勝7敗',
        recordAsOf: '2025-12-31',
        recentFights: [
          { date: '2025.12.31', vsJa: 'クレベル・コイケ', resultJa: '× 判定0-3' },
          { date: '2025.6.14', vsJa: '木村柊也', resultJa: '○ 判定3-0' },
          { date: '2024.12.31', vsJa: 'ホベルト・サトシ・ソウザ', resultJa: '× 1R 4:45 三角絞め' },
        ],
        photo: {
          src: '/media/rizin5/keramov.jpg',
          creditJa: 'ホタテマン0010（CC BY 4.0・Wikimedia Commons）',
          href: 'https://commons.wikimedia.org/wiki/File:Vugar_Karamov.png',
        },
      },
      right: {
        name: '高木凌',
      },
      feudJa: 'ケラモフは2023年7月の王座決定戦で朝倉未来をリアネイキドチョークで下した元王者',
      story: [
        'ケラモフは2023年の王座決定戦で未来を絞め落とした元王者。そのあと鈴木千裕にベルトを奪われて、おととしの大晦日にはサトシのライト級王座にも挑んで三角絞めに散った。この大会の因縁の網は、ケラモフを経由してもつながってる。',
        '相手の高木凌についてはうちの取材がまだ薄い。ここは正直に、下のロードで追いかけながら書き足していく。',
      ],
    },
    {
      order: 7,
      weightJa: '49.0kg',
      left: {
        name: 'RENA',
        noteJa: 'シュートボクシング出身。RIZIN女子の看板を最初から背負ってきた',
      },
      right: {
        name: 'ナターシャ・クジュティナ',
      },
      story: [],
    },
    {
      order: 8,
      weightJa: '59.0kg',
      left: { name: '冨澤大智' },
      right: { name: 'ドンマイ川端' },
      story: [],
    },
  ] satisfies Rizin5Card[],

  /** ロード・トゥ・9.10（新しい順に表示。出来事の日付基準）。 */
  road: [
    {
      date: '2026-07-29',
      titleJa: '平本、神速の12秒',
      body: [
        '平本がSNSに上げた12秒のミット動画がざわつかせてる。ノーステップから放つ左のショートストレートが見たことない速さで、コメント欄はハンドスピードやばいだの誰も止められないだの、ほとんど前夜祭の空気。本人が動画に添えた一言は素数。相変わらず何を言ってるのか分からんけど、この分からなさ込みで平本蓮なんだよな。774日のブランクを感じさせる映像ではなかった。それだけは確か。',
      ],
    },
    {
      date: '2026-07-21',
      titleJa: '無課金おじさん、現る',
      body: [
        '会見翌日の主役はまさかのダウトベック。壇上の装いが上下ともGUの1990円、締めて4000円未満と特定されて、格闘技界の無課金おじさんの呼び名でSNSに拡散した。言われないと全然わからない、ダウトベックが着ると半端なくかっこいい、と妙な好感度の上がり方をしてる。11連勝中の最恐ストライカーが服に1円も課金してないの、逆に凄みが出てるでしょ。',
      ],
    },
    {
      date: '2026-07-20',
      titleJa: '全8カード一斉発表。この日の優勝は青木の第一声',
      body: [
        '都内で対戦カード発表会見。メインのダブルタイトルマッチから未来の復帰戦まで、一気に8試合が出た。この日の優勝は青木真也の第一声、残念だったな俺だよ。未来の相手は誰だと騒いでいたファンを一撃で黙らせて、そのまま恥を忍んで帰ってきましたと続けた。43歳が一番いい台詞を全部持っていった。',
        '平本も負けてない。シェイドゥラエフとダウトベックの陣営を前に、こいつらずっと仲良しこよしやってるんでと宣戦布告。カード発表の時点でここまで温度が上がる大会、そうはない。',
      ],
    },
    {
      date: '2026-07-18',
      titleJa: '前哨戦。ダウトベックの左が萩原を4分で片付けた',
      body: [
        '広島のLANDMARK15で、ダウトベックが萩原京平を1R4分8秒TKO。左フックからのパウンドで沈めて11連勝。ちなみに萩原は、平本がMMAデビュー戦で敗れた相手でもある。平本が6年かけて越えた壁を4分で処理して見せてから9月に来る、この巡り合わせが出来すぎてて怖い。この試合の海外の反応はまとめてあるので下から。',
      ],
      link: {
        href: '/mma/2026-07-18-rizin-landmark15-hagihara-dautbek',
        labelJa: '萩原京平vsダウトベック戦の海外の反応まとめを読む',
        internal: true,
      },
    },
    {
      date: '2025-12-31',
      titleJa: '前史。全員が底を見た夜',
      body: [
        'さいたまの師走の超強者祭り。未来はシェイドゥラエフに1R2分54秒で壊されて担架で運ばれ、サトシは開始13秒でノジモフの膝に王座を砕かれた。ダウトベックの久保優太戦もアイポークのノーコンテストで不完全燃焼。この夜に底を見た男たちが、揃って京セラドームに帰ってくる。だから9月10日は復活祭りなんだと思う。',
      ],
    },
  ] satisfies Rizin5RoadEntry[],
};

/** 開催日までの残り日数（0=当日・負=開催後）。JST の日付境界で数える。 */
export function daysUntilRizin5(now: Date = new Date()): number {
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate());
  const [y, m, d] = RIZIN5.eventDate.split('-').map(Number);
  const event = Date.UTC(y, m - 1, d);
  return Math.round((event - today) / 86_400_000);
}
