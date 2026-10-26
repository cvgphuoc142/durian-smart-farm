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
  fields: Partial<Article> & Pick<Article, 'title' | 'body'>,
): Article {
  return {
    id,
    version_id: `${id}-v1`,
    version_no: 1,
    category: null,
    disease_code: null,
    plant_parts: [],
    stages: [],
    source_links: ['https://example.org/source'],
    published_at: STAMP,
    ...fields,
  };
}

function items(prefix: string, texts: [string, string][]): StandardItem[] {
  return texts.map(([title, body], i) => ({
    id: `${prefix}-item-${i + 1}`,
    item_key: `${prefix}.${i + 1}`,
    sort_order: i + 1,
    title,
    body,
    source_link: 'https://example.org/standard',
    source_checked_at: STAMP,
  }));
}

function standardVersion(
  id: string,
  profileId: string,
  versionNo: number,
  list: StandardItem[],
): StandardVersion {
  return {
    id,
    profile_id: profileId,
    version_no: versionNo,
    title: `Tiêu chuẩn CN (mẫu) bản ${versionNo}`,
    description: null,
    effective_on: '2026-09-01',
    source_links: ['https://example.org/standard'],
    items: list,
  };
}

const CN_V1 = items('cn1', [
  ['Mã vùng trồng (mẫu)', 'Nội dung mẫu để phát triển.'],
  ['Nhật ký sử dụng thuốc (mẫu)', 'Nội dung mẫu để phát triển.'],
  ['Thu hoạch đúng độ chín (mẫu)', 'Nội dung mẫu để phát triển.'],
]);
const CN_V2 = items('cn2', [
  ['Mã vùng trồng (mẫu)', 'Nội dung mẫu, bản 2.'],
  ['Nhật ký sử dụng thuốc (mẫu)', 'Nội dung mẫu, bản 2.'],
  ['Thu hoạch đúng độ chín (mẫu)', 'Nội dung mẫu, bản 2.'],
  ['Hồ sơ truy xuất (mẫu)', 'Mục mới của bản 2.'],
]);

/** The release the "server" has published. `n` picks the sample release: 1 first, 2 later. */
export function buildRelease(n: number): ContentRelease {
  // Release 2 publishes a new version of the same article (a new version id), so a citation of the
  // first version opens the text it quoted only while that version is kept.
  const phyto = article('art-phyto', {
    version_id: n >= 2 ? 'art-phyto-v2' : 'art-phyto-v1',
    version_no: n >= 2 ? 2 : 1,
    category: 'disease',
    disease_code: 'phytophthora',
    plant_parts: ['leaf', 'fruit'],
    title: 'Bệnh xì mủ (mẫu)',
    body:
      n >= 2
        ? 'Nội dung mẫu để phát triển, bản sửa.\n\nTriệu chứng: vết úng nước, chảy mủ nâu, nứt vỏ.'
        : 'Nội dung mẫu để phát triển.\n\nTriệu chứng: vết úng nước, chảy mủ nâu.',
  });

  const articles: Article[] = [
    phyto,
    article('art-rot', {
      category: 'disease',
      disease_code: 'fruit_rot',
      plant_parts: ['fruit'],
      title: 'Thối trái (mẫu)',
      body: 'Nội dung mẫu để phát triển.\n\nTriệu chứng: vỏ trái thâm, mềm nhũn.',
    }),
    article('art-fert', {
      category: 'care',
      stages: ['fruit_growth'],
      title: 'Bón phân giai đoạn nuôi trái (mẫu)',
      body: 'Nội dung mẫu để phát triển.',
    }),
  ];
  if (n >= 2) {
    articles.push(
      article('art-flower', {
        category: 'care',
        stages: ['flowering_fruit_set'],
        published_at: STAMP_2,
        title: 'Chăm sóc giai đoạn ra hoa (mẫu)',
        body: 'Nội dung mẫu để phát triển.',
      }),
    );
  }

  const cnVersionId = n >= 2 ? 'std-cn-v2' : 'std-cn-v1';
  const cnVersion =
    n >= 2
      ? standardVersion('std-cn-v2', 'profile-cn-fresh', 2, CN_V2)
      : standardVersion('std-cn-v1', 'profile-cn-fresh', 1, CN_V1);

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
    standard_versions: [cnVersion],
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
    checksum: `mock-release-${n}`,
    created_at: n >= 2 ? STAMP_2 : STAMP,
  };
}

/**
 * A stand-in for the RAG service: answers only from the sample articles and cites the exact
 * version it read. A question with no match gets the "not enough sources" answer rather than an
 * invented one.
 */
export function answerFromSamples(
  question: string,
  locale: Locale,
  releaseNo: number,
): Pick<ChatResponse, 'answer' | 'status' | 'citations'> {
  const tokens = searchTokens(question);
  const rows = buildRelease(releaseNo).articles;
  const hits = rows.filter((r) => {
    const words = searchTokens(`${r.title} ${r.body}`);
    return tokens.some((t) => words.some((w) => w.startsWith(t)));
  });
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
      title: h.title,
    })),
  };
}
