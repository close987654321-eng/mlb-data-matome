import type { Locale } from '@/lib/i18n';

// 運営者名・連絡先はここが唯一の正（about / privacy / contact ページが参照）。
// 2026-06-13 にユーザー決定: 運営者はサイト名で表示、問い合わせは Google フォーム。
export const OPERATOR_NAME = '「海外の反応まとめ」運営';
// 問い合わせ用 Google フォーム（about / contact ページの CTA リンク先）。
export const CONTACT_FORM_URL = 'https://forms.gle/Gh6pjqdCR3ijLJqW8';
// 最終更新日（ポリシー改定時に手で更新する）。
export const LEGAL_UPDATED = '2026-06-13';

/** 法務系ページ1本の構造化コンテンツ（見出し＋段落＋箇条書き）。 */
export type LegalSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
};
export type LegalDoc = {
  title: string;
  intro?: string;
  sections: LegalSection[];
};

const PRIVACY: Record<Locale, LegalDoc> = {
  ja: {
    title: 'プライバシーポリシー',
    intro:
      '当サイト「海外の反応まとめ」（以下「当サイト」）における、利用者の情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。',
    sections: [
      {
        heading: 'アクセス解析ツールについて',
        paragraphs: [
          '当サイトでは、Google による解析ツール「Google アナリティクス」を利用しています。Google アナリティクスはトラフィックデータの収集のために Cookie を使用します。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。',
          'この機能は Cookie を無効にすることで収集を拒否できますので、お使いのブラウザの設定をご確認ください。Google アナリティクスの利用規約・プライバシーポリシーについては、Google のサイトをご確認ください。',
        ],
      },
      {
        heading: '広告の配信について',
        paragraphs: [
          '当サイトは、第三者配信の広告サービス（Google アドセンス等）を利用する場合があります。このような広告配信事業者は、利用者の興味に応じた商品やサービスの広告を表示するため、当サイトや他サイトへのアクセスに関する情報（氏名・住所・メールアドレス・電話番号は含みません）を使用することがあります。',
          'Cookie を無効にする方法や Google アドセンスに関する詳細は、「広告 – ポリシーと規約 – Google」をご確認ください。第三者配信による広告のパーソナライズは、Google の「広告設定」から無効にできます。',
        ],
      },
      {
        heading: '引用・著作権について',
        paragraphs: [
          '当サイトの各まとめは、海外掲示板（Reddit 等）や YouTube の公開コメントを、抜粋・翻訳のうえ、必ず元のスレッド・動画へのリンクを添えて紹介する編集物です。コメント本文の全文転載は行いません。',
          '引用元コンテンツの著作権は、各権利者に帰属します。掲載内容について権利者の方からご連絡があった場合は、確認のうえ速やかに対応（修正・削除）いたします。お問い合わせフォームよりご連絡ください。',
        ],
      },
      {
        heading: '免責事項',
        paragraphs: [
          '当サイトに掲載する翻訳・要約は、正確性を期すよう努めますが、その内容の完全性・正確性を保証するものではありません。当サイトの情報を利用して生じたいかなる損害についても、当サイトは責任を負いかねます。',
          '当サイトからリンクやバナーなどによって他のサイトに移動した場合、移動先サイトで提供される情報・サービス等について当サイトは一切の責任を負いません。',
        ],
      },
      {
        heading: 'プライバシーポリシーの変更',
        paragraphs: [
          '当サイトは、必要に応じて本ポリシーの内容を変更することがあります。変更後のプライバシーポリシーは、本ページに掲載した時点から効力を生じるものとします。',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    intro:
      'This page sets out how “Overseas Reactions” (this site) handles visitor information.',
    sections: [
      {
        heading: 'Analytics',
        paragraphs: [
          'This site uses Google Analytics, which uses cookies to collect traffic data. The data is collected anonymously and does not identify individuals.',
          'You can opt out by disabling cookies in your browser settings. For details, please refer to Google’s terms and privacy policy.',
        ],
      },
      {
        heading: 'Advertising',
        paragraphs: [
          'This site may use third-party ad services such as Google AdSense. These providers may use information about your visits to this and other sites (excluding your name, address, email, or phone number) to show ads relevant to your interests.',
          'For details on cookies and AdSense, see “Advertising – Policies & Terms – Google.” You can disable personalized advertising via Google’s Ads Settings.',
        ],
      },
      {
        heading: 'Quotation & Copyright',
        paragraphs: [
          'Each digest excerpts and translates public comments from overseas forums (such as Reddit) and YouTube, always linking back to the original thread or video. We do not reproduce comments in full.',
          'Copyright in the source content belongs to the respective rights holders. If a rights holder contacts us about any content, we will review and respond (correct or remove) promptly. Please reach us via the contact form.',
        ],
      },
      {
        heading: 'Disclaimer',
        paragraphs: [
          'While we strive for accuracy, we do not guarantee the completeness or accuracy of translations and summaries, and we are not liable for any damages arising from use of this site’s information.',
          'We are not responsible for the content or services of external sites reached via links or banners on this site.',
        ],
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'We may update this policy as needed. The updated policy takes effect once posted on this page.',
        ],
      },
    ],
  },
};

const ABOUT: Record<Locale, LegalDoc> = {
  ja: {
    title: '運営者情報',
    sections: [
      {
        heading: '運営者',
        paragraphs: [`当サイトは ${OPERATOR_NAME}（個人）が運営しています。`],
      },
      {
        heading: 'サイトの内容',
        paragraphs: [
          '当サイト「海外の反応まとめ」は、MLB・ボクシング・MMA（UFC・RIZIN）をテーマに、海外掲示板（Reddit 等）や YouTube で話題になったスレッド・動画への現地ファンの反応を、日本語に翻訳してまとめて紹介するサイトです。',
          '英語が読めなくても海外の盛り上がりを楽しめることを目的に、現地のコメントを抜粋・翻訳し、必ず出典元へのリンクを添えてお届けしています。',
        ],
      },
      {
        heading: '著作権・引用方針',
        paragraphs: [
          '各まとめはコメントの全文転載ではなく、抜粋＋翻訳＋出典リンクによる編集物です。引用元の著作権は各権利者に帰属します。掲載内容に関するご連絡は、お問い合わせフォームよりお願いいたします。',
        ],
      },
      {
        heading: 'お問い合わせ',
        paragraphs: [
          'ご意見・削除依頼・取材などのご連絡は、お問い合わせフォームよりお願いいたします。',
        ],
      },
    ],
  },
  en: {
    title: 'About',
    sections: [
      {
        heading: 'Operator',
        paragraphs: [`This site is run by ${OPERATOR_NAME} (an individual).`],
      },
      {
        heading: 'What this site is',
        paragraphs: [
          '“Overseas Reactions” curates and translates into Japanese how overseas fans react to buzzing threads and videos about MLB, Boxing, and MMA (UFC, RIZIN) on forums like Reddit and on YouTube.',
          'Our goal is to let Japanese fans enjoy the overseas buzz even without reading English. We excerpt and translate local comments and always link back to the source.',
        ],
      },
      {
        heading: 'Copyright & quotation',
        paragraphs: [
          'Each digest is an edited work of excerpts, translation, and source links — not a full reproduction. Copyright in source content belongs to the respective rights holders. For any inquiries about content, please use the contact form.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['For feedback, removal requests, or press inquiries, please use the contact form.'],
      },
    ],
  },
};

const CONTACT: Record<Locale, LegalDoc> = {
  ja: {
    title: 'お問い合わせ',
    intro:
      '当サイトへのご意見・ご感想、掲載内容に関する削除依頼、取材・お仕事のご依頼などは、以下のフォームよりお気軽にお問い合わせください。',
    sections: [
      {
        paragraphs: [
          '内容を確認のうえ、必要に応じてご返信いたします。掲載コンテンツの著作権に関するご連絡には、確認後すみやかに対応いたします。',
        ],
      },
    ],
  },
  en: {
    title: 'Contact',
    intro:
      'For feedback, removal requests regarding published content, or press/business inquiries, please use the form below.',
    sections: [
      {
        paragraphs: [
          'We review every message and reply as needed. We respond promptly to any inquiries about the copyright of published content.',
        ],
      },
    ],
  },
};

export function getPrivacyDoc(locale: Locale): LegalDoc {
  return PRIVACY[locale];
}
export function getAboutDoc(locale: Locale): LegalDoc {
  return ABOUT[locale];
}
export function getContactDoc(locale: Locale): LegalDoc {
  return CONTACT[locale];
}
