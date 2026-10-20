import { fold, searchTokens } from '@/content/fold';
import type {
  Article,
  Citation,
  Contact,
  ContactKind,
  ContentRelease,
  Disease,
  Locale,
  StandardProfile,
  StandardVersion,
} from '@/types';

import { getDb } from './client';

export interface ContentMeta {
  release_no: number;
  checksum: string;
  schema_version: number;
  locales: Locale[];
  installed_at: string;
  /** Last time the app asked the server whether a newer release exists. */
  checked_at: string;
}

interface ArticleRow {
  article_id: string;
  version_id: string;
  version_no: number;
  locale: Locale;
  translation_revision: number;
  source_locale: Locale;
  is_fallback: number;
  title: string;
  body: string;
  category: string | null;
  disease_code: string | null;
  plant_parts: string;
  stages: string;
  source_links: string;
  published_at: string;
}

const toArticle = (r: ArticleRow): Article => ({
  id: r.article_id,
  version_id: r.version_id,
  version_no: r.version_no,
  translation_revision: r.translation_revision,
  locale: r.locale,
  is_fallback: r.is_fallback === 1,
  source_locale: r.source_locale,
  title: r.title,
  body: r.body,
  category: r.category,
  disease_code: r.disease_code,
  plant_parts: JSON.parse(r.plant_parts),
  stages: JSON.parse(r.stages),
  source_links: JSON.parse(r.source_links),
  published_at: r.published_at,
});

/** Newest translation revision first. */
const byRevision = (a: Article, b: Article) => b.translation_revision - a.translation_revision;

/**
 * Which text of one article version to show in `locale` (FR-C04, AC-23): the translation if the
 * version has one, otherwise the source text **of the same version**, flagged as a fallback. A
 * translation of another version is never used in its place.
 */
function pickText(rows: Article[], locale: Locale): Article | null {
  const mine = rows.filter((r) => r.locale === locale).sort(byRevision)[0];
  if (mine) return mine;
  const source = rows.find((r) => r.locale === r.source_locale);
  const original = source
    ? rows
        .filter((r) => r.locale === source.locale)
        .sort(byRevision)
        .at(0)
    : rows.slice().sort(byRevision)[0];
  return original ? { ...original, is_fallback: true } : null;
}

/** The current (highest) version of an article, in the best language for `locale`. */
function resolveCurrent(rows: Article[], locale: Locale): Article | null {
  if (rows.length === 0) return null;
  const top = Math.max(...rows.map((r) => r.version_no));
  return pickText(
    rows.filter((r) => r.version_no === top),
    locale,
  );
}

const groupBy = <T>(rows: T[], key: (r: T) => string) => {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
};

async function allMeta(): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM content_meta',
  );
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getMeta(): Promise<ContentMeta | null> {
  const m = await allMeta();
  if (!m.has('release_no')) return null;
  return {
    release_no: Number(m.get('release_no')),
    checksum: m.get('checksum') ?? '',
    schema_version: Number(m.get('schema_version') ?? 1),
    locales: JSON.parse(m.get('locales') ?? '[]'),
    installed_at: m.get('installed_at') ?? '',
    checked_at: m.get('checked_at') ?? '',
  };
}

async function setMeta(entries: Record<string, string>) {
  const db = await getDb();
  for (const [key, value] of Object.entries(entries)) {
    await db.runAsync(
      `INSERT INTO content_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value,
    );
  }
}

/** The server was asked and had nothing newer. */
export async function touchChecked(at: string) {
  await setMeta({ checked_at: at });
}

/**
 * Replaces the whole pack in one transaction. Anything thrown inside rolls back, so a release
 * that fails halfway leaves the previous one exactly as it was (AC-25). Versions that were cited
 * or ticked (`content_pin`) stay even if the release dropped them, so an old citation still opens
 * the text it pointed at.
 */
export async function installRelease(release: ContentRelease, at: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM content_article WHERE article_id || '|' || version_id || '|' || translation_revision
         NOT IN (SELECT key FROM content_pin WHERE kind = 'article')`,
    );
    for (const a of release.articles) {
      await db.runAsync(
        `INSERT OR REPLACE INTO content_article
           (article_id, version_id, version_no, locale, translation_revision, source_locale,
            is_fallback, title, body, category, disease_code, plant_parts, stages, source_links,
            published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id,
        a.version_id,
        a.version_no,
        a.locale,
        a.translation_revision,
        a.source_locale,
        a.is_fallback ? 1 : 0,
        a.title,
        a.body,
        a.category,
        a.disease_code,
        JSON.stringify(a.plant_parts),
        JSON.stringify(a.stages),
        JSON.stringify(a.source_links),
        a.published_at,
      );
    }

    await db.runAsync('DELETE FROM content_disease');
    for (const d of release.diseases) {
      await db.runAsync(
        'INSERT INTO content_disease (code, names) VALUES (?, ?)',
        d.code,
        JSON.stringify(d.names),
      );
    }

    await db.runAsync('DELETE FROM content_standard_profile');
    for (const p of release.standard_profiles) {
      await db.runAsync(
        'INSERT INTO content_standard_profile (id, json) VALUES (?, ?)',
        p.id,
        JSON.stringify(p),
      );
    }
    await db.runAsync(
      `DELETE FROM content_standard_version
         WHERE id NOT IN (SELECT key FROM content_pin WHERE kind = 'standard')`,
    );
    for (const v of release.standard_versions) {
      await db.runAsync(
        `INSERT OR REPLACE INTO content_standard_version (id, locale, profile_id, version_no, json)
         VALUES (?, ?, ?, ?, ?)`,
        v.id,
        v.locale,
        v.profile_id,
        v.version_no,
        JSON.stringify(v),
      );
    }

    await db.runAsync('DELETE FROM content_contact');
    for (const c of release.contacts) {
      await db.runAsync(
        'INSERT INTO content_contact (id, kind, province, folded, json) VALUES (?, ?, ?, ?, ?)',
        c.id,
        c.kind,
        c.province,
        fold(
          [c.name, c.province, c.locality, c.address, c.specialty, c.description]
            .filter(Boolean)
            .join(' '),
        ),
        JSON.stringify(c),
      );
    }

    await rebuildIndex(release.diseases);

    await setMeta({
      release_no: String(release.release_no),
      checksum: release.checksum,
      schema_version: String(release.schema_version),
      locales: JSON.stringify(release.available_locales),
      installed_at: at,
      checked_at: at,
    });
  });
}

/** Folded text of every stored article row, with the names of its disease in every language. */
async function rebuildIndex(diseases: Disease[]) {
  const db = await getDb();
  const names = new Map(diseases.map((d) => [d.code, Object.values(d.names).join(' ')]));
  await db.runAsync('DELETE FROM content_article_fts');
  const rows = await db.getAllAsync<ArticleRow & { rid: number }>('SELECT * FROM content_article');
  for (const r of rows) {
    const text = fold(
      [r.title, r.body, r.category, r.disease_code ? names.get(r.disease_code) : null]
        .filter(Boolean)
        .join(' '),
    );
    await db.runAsync('INSERT INTO content_article_fts (rowid, text) VALUES (?, ?)', r.rid, text);
  }
}

export async function pin(kind: 'article' | 'standard', key: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR IGNORE INTO content_pin (kind, key) VALUES (?, ?)', kind, key);
}

export const citationKey = (
  c: Pick<Citation, 'article_id' | 'version_id' | 'translation_revision'>,
) => `${c.article_id}|${c.version_id}|${c.translation_revision}`;

/** Keeps the exact text a chatbot answer cited, whatever later releases do. */
export async function pinCitations(citations: Citation[]) {
  for (const c of citations) await pin('article', citationKey(c));
}

export async function pinStandardVersion(versionId: string) {
  await pin('standard', versionId);
}

// ---------------------------------------------------------------------------- articles

export interface ArticleQuery {
  locale: Locale;
  /** Words typed in the search box; diacritics and case do not matter. */
  text?: string;
  category?: string | null;
  part?: string | null;
  stage?: string | null;
  diseaseCode?: string | null;
}

/** `"tok"*` for every word: all words must match, each as a prefix. */
const matchExpression = (tokens: string[]) => tokens.map((t) => `"${t}"*`).join(' AND ');

/** Articles with their current text, best match first for a search, newest first otherwise. */
export async function listArticles(q: ArticleQuery): Promise<Article[]> {
  const db = await getDb();
  const tokens = searchTokens(q.text ?? '');
  let rows: ArticleRow[];
  if (tokens.length > 0) {
    // A hit on any language or version finds the article; it is then shown in the UI language.
    const ids = await db.getAllAsync<{ article_id: string }>(
      `SELECT DISTINCT a.article_id FROM content_article_fts f
         JOIN content_article a ON a.rid = f.rowid
         WHERE content_article_fts MATCH ?`,
      matchExpression(tokens),
    );
    if (ids.length === 0) return [];
    const marks = ids.map(() => '?').join(',');
    rows = await db.getAllAsync<ArticleRow>(
      `SELECT * FROM content_article WHERE article_id IN (${marks})`,
      ids.map((r) => r.article_id),
    );
  } else {
    rows = await db.getAllAsync<ArticleRow>('SELECT * FROM content_article');
  }

  const out: Article[] = [];
  for (const group of groupBy(rows.map(toArticle), (r) => r.id).values()) {
    const a = resolveCurrent(group, q.locale);
    if (!a) continue;
    if (q.category && a.category !== q.category) continue;
    if (q.part && !a.plant_parts.includes(q.part)) continue;
    if (q.stage && !a.stages.includes(q.stage)) continue;
    if (q.diseaseCode && a.disease_code !== q.diseaseCode) continue;
    out.push(a);
  }
  return out.sort(
    (a, b) => b.published_at.localeCompare(a.published_at) || a.title.localeCompare(b.title),
  );
}

/** Approved articles for a disease on a body part; one that names no part fits every part. */
export async function relatedArticles(
  diseaseCode: string,
  plantPart: string,
  locale: Locale,
): Promise<Article[]> {
  const list = await listArticles({ locale, diseaseCode });
  return list.filter((a) => a.plant_parts.length === 0 || a.plant_parts.includes(plantPart));
}

/**
 * One article. With a `versionId` (and revision) it is exactly that text: no newer version or
 * translation is put in its place, so a citation opens what was cited (FR-C05, AC-25). Returns
 * `null` when that text is not on the phone. A revision number belongs to one language, so a
 * citation also passes its `locale`.
 */
export async function getArticle(
  id: string,
  locale: Locale,
  exact?: { versionId: string; translationRevision?: number; locale?: Locale },
): Promise<Article | null> {
  const db = await getDb();
  const rows = (
    await db.getAllAsync<ArticleRow>('SELECT * FROM content_article WHERE article_id = ?', id)
  ).map(toArticle);
  if (!exact) return resolveCurrent(rows, locale);
  const same = rows.filter(
    (r) =>
      r.version_id === exact.versionId &&
      (exact.translationRevision == null || r.translation_revision === exact.translationRevision),
  );
  // A citation names the language of the text it quoted: that text, as it was, not a translation.
  if (exact.locale) return same.find((r) => r.locale === exact.locale) ?? null;
  return pickText(same, locale);
}

export async function isCurrentVersion(articleId: string, versionId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ version_id: string; version_no: number }>(
    'SELECT version_id, version_no FROM content_article WHERE article_id = ?',
    articleId,
  );
  if (rows.length === 0) return false;
  const top = Math.max(...rows.map((r) => r.version_no));
  return rows.some((r) => r.version_id === versionId && r.version_no === top);
}

/** Filter options present in the pack. */
export async function articleFacets(): Promise<{
  categories: string[];
  parts: string[];
  stages: string[];
}> {
  const db = await getDb();
  const rows = await db.getAllAsync<Pick<ArticleRow, 'category' | 'plant_parts' | 'stages'>>(
    'SELECT category, plant_parts, stages FROM content_article',
  );
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  return {
    categories: uniq(rows.map((r) => r.category).filter((c): c is string => !!c)),
    parts: uniq(rows.flatMap((r) => JSON.parse(r.plant_parts) as string[])),
    stages: uniq(rows.flatMap((r) => JSON.parse(r.stages) as string[])),
  };
}

export async function listDiseases(): Promise<Disease[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ code: string; names: string }>(
    'SELECT code, names FROM content_disease',
  );
  return rows.map((r) => ({ code: r.code, names: JSON.parse(r.names) }));
}

// -------------------------------------------------------------------------- standards

export async function listProfiles(): Promise<StandardProfile[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>(
    'SELECT json FROM content_standard_profile ORDER BY id',
  );
  return rows.map((r) => JSON.parse(r.json));
}

/**
 * One checklist version in the UI language. If it has no translation the source text of the
 * **same version** is shown, flagged as a fallback (AC-23). Items keep their ids in every language,
 * so a tick never depends on the language.
 */
export async function getStandardVersion(
  id: string,
  locale: Locale,
): Promise<StandardVersion | null> {
  const db = await getDb();
  const rows = (
    await db.getAllAsync<{ json: string }>(
      'SELECT json FROM content_standard_version WHERE id = ?',
      id,
    )
  ).map((r) => JSON.parse(r.json) as StandardVersion);
  const mine = rows.find((r) => r.locale === locale);
  if (mine) return mine;
  const original = rows.find((r) => r.locale === r.source_locale) ?? rows[0];
  return original ? { ...original, is_fallback: true } : null;
}

/** Versions of a profile that are on the phone, newest first (the current one and pinned old ones). */
export async function listStandardVersionRefs(
  profileId: string,
): Promise<{ id: string; version_no: number }[]> {
  const db = await getDb();
  return db.getAllAsync<{ id: string; version_no: number }>(
    `SELECT DISTINCT id, version_no FROM content_standard_version
       WHERE profile_id = ? ORDER BY version_no DESC`,
    profileId,
  );
}

// -------------------------------------------------------------------------- contacts

export interface ContactQuery {
  kind?: ContactKind | null;
  province?: string | null;
  text?: string;
}

export async function listContacts(q: ContactQuery = {}): Promise<Contact[]> {
  const db = await getDb();
  const where: string[] = [];
  const args: string[] = [];
  if (q.kind) {
    where.push('kind = ?');
    args.push(q.kind);
  }
  if (q.province) {
    where.push('province = ?');
    args.push(q.province);
  }
  for (const token of searchTokens(q.text ?? '')) {
    where.push('folded LIKE ?');
    args.push(`%${token}%`);
  }
  const rows = await db.getAllAsync<{ json: string }>(
    `SELECT json FROM content_contact ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY folded`,
    args,
  );
  return rows.map((r) => JSON.parse(r.json));
}

export async function getContact(id: string): Promise<Contact | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>(
    'SELECT json FROM content_contact WHERE id = ?',
    id,
  );
  return row ? JSON.parse(row.json) : null;
}

export async function listProvinces(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ province: string }>(
    'SELECT DISTINCT province FROM content_contact WHERE province IS NOT NULL ORDER BY province',
  );
  return rows.map((r) => r.province);
}
