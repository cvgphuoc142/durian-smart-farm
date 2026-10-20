import { searchTokens } from '@/content/fold';
import type {
  Article,
  ChatResponse,
  ContentManifest,
  ContentRelease,
  Locale,
  StandardItem,
  StandardVersion,
} from '@/types';

/**
 * Sample content for development only. It stands in for what the admin site publishes, so the
 * screens can be built and tested; none of it is real agronomy or regulation text, and the app
 * ships with no content of its own.
 */

const STAMP = '2026-10-01T03:00:00.000Z';
const STAMP_2 = '2026-10-10T03:00:00.000Z';

function article(
  id: string,
  locale: Locale,
  fields: Partial<Article> & Pick<Article, 'title' | 'body'>,
): Article {
  return {
    id,
    version_id: `${id}-v1`,
    version_no: 1,
    translation_revision: 1,
    locale,
    is_fallback: false,
    source_locale: 'vi',
    category: null,
    disease_code: null,
    plant_parts: [],
    stages: [],
    source_links: ['https://example.org/source'],
    published_at: STAMP,
    ...fields,
  };
}

function items(prefix: string, texts: { vi: [string, string][]; en: [string, string][] }) {
  const make = (locale: Locale): StandardItem[] =>
    texts[locale].map(([title, body], i) => ({
      id: `${prefix}-item-${i + 1}`,
      item_key: `${prefix}.${i + 1}`,
      sort_order: i + 1,
      title,
      body,
      source_link: 'https://example.org/standard',
      source_checked_at: STAMP,
    }));
  return { vi: make('vi'), en: make('en') };
}

function standardVersion(
  id: string,
  profileId: string,
  versionNo: number,
  locale: Locale,
  list: StandardItem[],
): StandardVersion {
  return {
    id,
    profile_id: profileId,
    version_no: versionNo,
    effective_on: '2026-09-01',
    source_locale: 'vi',
    locale,
    is_fallback: false,
    source_links: ['https://example.org/standard'],
    items: list,
  };
}

const CN_V1 = items('cn1', {
  vi: [
    ['Mã vùng trồng (mẫu)', 'Nội dung mẫu để phát triển.'],
    ['Nhật ký sử dụng thuốc (mẫu)', 'Nội dung mẫu để phát triển.'],
    ['Thu hoạch đúng độ chín (mẫu)', 'Nội dung mẫu để phát triển.'],
  ],
  en: [
    ['Growing area code (sample)', 'Sample text for development.'],
    ['Pesticide use record (sample)', 'Sample text for development.'],
    ['Harvest at the right maturity (sample)', 'Sample text for development.'],
  ],
});
const CN_V2 = items('cn2', {
  vi: [
    ['Mã vùng trồng (mẫu)', 'Nội dung mẫu, bản 2.'],
    ['Nhật ký sử dụng thuốc (mẫu)', 'Nội dung mẫu, bản 2.'],
    ['Thu hoạch đúng độ chín (mẫu)', 'Nội dung mẫu, bản 2.'],
    ['Hồ sơ truy xuất (mẫu)', 'Mục mới của bản 2.'],
  ],
  en: [
    ['Growing area code (sample)', 'Sample text, version 2.'],
    ['Pesticide use record (sample)', 'Sample text, version 2.'],
    ['Harvest at the right maturity (sample)', 'Sample text, version 2.'],
    ['Traceability record (sample)', 'New item of version 2.'],
  ],
});

/** The release the "server" has published. `n` picks the sample release: 1 first, 2 later. */
export function buildRelease(n: number): ContentRelease {
  const phyto = (locale: Locale, rev: number) =>
    article('art-phyto', locale, {
      translation_revision: rev,
      category: 'disease',
      disease_code: 'phytophthora',
      plant_parts: ['leaf', 'fruit'],
      title: locale === 'vi' ? 'Bệnh xì mủ (mẫu)' : 'Phytophthora canker (sample)',
      body:
        locale === 'vi'
          ? 'Nội dung mẫu để phát triển.\n\nTriệu chứng: vết úng nước, chảy mủ nâu.'
          : rev === 1
            ? 'Sample text for development.\n\nSymptoms: water-soaked lesions, brown gum.'
            : 'Sample text for development, revised.\n\nSymptoms: water-soaked lesions, brown gum, bark cracking.',
    });

  const articles: Article[] = [
    phyto('vi', 1),
    phyto('en', n >= 2 ? 2 : 1),
    // No English translation: an English phone shows this one in Vietnamese, marked as such.
    article('art-rot', 'vi', {
      category: 'disease',
      disease_code: 'fruit_rot',
      plant_parts: ['fruit'],
      title: 'Thối trái (mẫu)',
      body: 'Nội dung mẫu để phát triển.\n\nTriệu chứng: vỏ trái thâm, mềm nhũn.',
    }),
    article('art-fert', 'vi', {
      category: 'care',
      stages: ['fruit_growth'],
      title: 'Bón phân giai đoạn nuôi trái (mẫu)',
      body: 'Nội dung mẫu để phát triển.',
    }),
    article('art-fert', 'en', {
      category: 'care',
      stages: ['fruit_growth'],
      title: 'Fertilising while fruit grows (sample)',
      body: 'Sample text for development.',
    }),
  ];
  if (n >= 2) {
    articles.push(
      article('art-flower', 'vi', {
        category: 'care',
        stages: ['flowering_fruit_set'],
        published_at: STAMP_2,
        title: 'Chăm sóc giai đoạn ra hoa (mẫu)',
        body: 'Nội dung mẫu để phát triển.',
      }),
    );
  }

  const cnVersionId = n >= 2 ? 'std-cn-v2' : 'std-cn-v1';
  const cnVersions =
    n >= 2
      ? (['vi', 'en'] as Locale[]).map((l) =>
          standardVersion('std-cn-v2', 'profile-cn-fresh', 2, l, CN_V2[l]),
        )
      : (['vi', 'en'] as Locale[]).map((l) =>
          standardVersion('std-cn-v1', 'profile-cn-fresh', 1, l, CN_V1[l]),
        );

  return {
    ...buildManifest(n),
    diseases: [
      { code: 'phytophthora', names: { vi: 'Xì mủ', en: 'Phytophthora canker' } },
      { code: 'fruit_rot', names: { vi: 'Thối trái', en: 'Fruit rot' } },
    ],
    articles,
    standard_profiles: [
      {
        id: 'profile-cn-fresh',
        market_code: 'CN',
        product_form_code: 'fresh',
        name: 'CN',
        published_version_id: cnVersionId,
      },
      // The EU profile exists but nothing is approved yet: the app must show an empty state.
      {
        id: 'profile-eu-fresh',
        market_code: 'EU',
        product_form_code: 'fresh',
        name: 'EU',
        published_version_id: null,
      },
    ],
    standard_versions: cnVersions,
    contacts: [
      {
        id: 'contact-store-1',
        kind: 'store',
        name: 'Cửa hàng vật tư (mẫu) A',
        province: 'Đắk Lắk',
        locality: 'Buôn Ma Thuột',
        address: 'Địa chỉ mẫu',
        phone: '0900000001',
        zalo: null,
        contact_url: 'https://example.org/store-a',
        source_link: 'https://example.org/source',
        verified_at: STAMP,
        description: 'Hồ sơ mẫu để phát triển.',
        specialty: null,
      },
      {
        id: 'contact-store-2',
        kind: 'store',
        name: 'Cửa hàng vật tư (mẫu) B',
        province: 'Tiền Giang',
        locality: 'Cai Lậy',
        address: null,
        phone: null,
        zalo: null,
        contact_url: null,
        source_link: null,
        verified_at: null,
        description: null,
        specialty: null,
      },
      {
        id: 'contact-expert-1',
        kind: 'expert',
        name: 'Chuyên gia bệnh cây (mẫu)',
        province: 'Đắk Lắk',
        locality: null,
        address: null,
        phone: '0900000002',
        zalo: '0900000002',
        contact_url: null,
        source_link: 'https://example.org/source',
        verified_at: STAMP,
        description: null,
        specialty: 'Bệnh hại sầu riêng',
      },
    ],
    tombstones: [],
  };
}

export function buildManifest(n: number): ContentManifest {
  return {
    release_no: n,
    schema_version: 1,
    available_locales: ['vi', 'en'],
    checksum: `mock-release-${n}`,
    created_at: n >= 2 ? STAMP_2 : STAMP,
  };
}

/**
 * A stand-in for the RAG service: answers only from the sample articles, in the language asked,
 * and cites the exact version and translation revision it read. A question with no match gets the
 * "not enough sources" answer rather than an invented one.
 */
export function answerFromSamples(
  question: string,
  locale: Locale,
  releaseNo: number,
): Pick<ChatResponse, 'answer' | 'status' | 'citations'> {
  const tokens = searchTokens(question);
  const rows = buildRelease(releaseNo).articles;
  const hits: Article[] = [];
  for (const id of new Set(rows.map((r) => r.id))) {
    const mine = rows.filter((r) => r.id === id);
    const matches = mine.some((r) => {
      const words = searchTokens(`${r.title} ${r.body}`);
      return tokens.some((t) => words.some((w) => w.startsWith(t)));
    });
    if (!matches) continue;
    // Prefer the question's language; otherwise cite the source text and say so.
    hits.push(
      mine.find((r) => r.locale === locale) ?? mine.find((r) => r.locale === r.source_locale)!,
    );
  }
  if (hits.length === 0) {
    return {
      status: 'insufficient_sources',
      answer:
        locale === 'en'
          ? 'There are not enough approved sources to answer this.'
          : 'Chưa có đủ nguồn đã duyệt để trả lời câu hỏi này.',
      citations: [],
    };
  }
  return {
    status: 'answered',
    answer:
      locale === 'en'
        ? `Based on the approved articles: ${hits.map((h) => h.title).join('; ')}.`
        : `Theo các bài đã duyệt: ${hits.map((h) => h.title).join('; ')}.`,
    citations: hits.slice(0, 3).map((h) => ({
      article_id: h.id,
      version_id: h.version_id,
      version_no: h.version_no,
      translation_revision: h.translation_revision,
      source_locale: h.locale,
      title: h.title,
    })),
  };
}
