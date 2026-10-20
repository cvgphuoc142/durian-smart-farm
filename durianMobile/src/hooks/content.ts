import { useEffect, useRef, useState } from 'react';

import { onContentChange, refreshContent, useContentStatus } from '@/content';
import { contentRepo } from '@/db';
import type { ArticleQuery, ContactQuery, ContentMeta } from '@/db/contentRepo';
import type { Article, Contact, Disease, Locale, StandardProfile, StandardVersion } from '@/types';

import { useFormat } from './useFormat';

/**
 * Reads the content pack on the phone and re-reads it when a new release is installed. Works
 * offline; `ready` is false until the first read finished.
 */
function useContent<T>(load: () => Promise<T>, deps: readonly unknown[], empty: T) {
  const [state, setState] = useState<{ data: T; ready: boolean }>({ data: empty, ready: false });
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    const read = () =>
      loadRef.current().then(
        (data) => alive && setState({ data, ready: true }),
        () => alive && setState({ data: empty, ready: true }),
      );
    void read();
    const off = onContentChange(() => void read());
    return () => {
      alive = false;
      off();
    };
    // `empty` is a constant at every call site; `deps` are the inputs of `load`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

const NO_ARTICLES: Article[] = [];
const NO_CONTACTS: Contact[] = [];
const NO_STRINGS: string[] = [];
const NO_DISEASES: Disease[] = [];
const FACETS = { categories: NO_STRINGS, parts: NO_STRINGS, stages: NO_STRINGS };

/** Which release is on the phone, or `null` if none was ever downloaded. */
export function useContentMeta() {
  return useContent<ContentMeta | null>(() => contentRepo.getMeta(), [], null);
}

/** Download state for the Knowledge screen, plus the manual refresh. */
export function useContentRefresh() {
  const status = useContentStatus();
  return { ...status, refresh: () => refreshContent() };
}

export function useArticleList(query: Omit<ArticleQuery, 'locale'>) {
  const { locale } = useFormat();
  const { text, category, part, stage, diseaseCode } = query;
  return useContent(
    () => contentRepo.listArticles({ locale, text, category, part, stage, diseaseCode }),
    [locale, text, category, part, stage, diseaseCode],
    NO_ARTICLES,
  );
}

export function useArticleFacets() {
  return useContent(() => contentRepo.articleFacets(), [], FACETS).data;
}

export function useDiseases() {
  return useContent(() => contentRepo.listDiseases(), [], NO_DISEASES).data;
}

/** The article, or exactly the cited version and translation revision. `null` = not on the phone. */
export function useArticle(
  articleId: string,
  exact?: { versionId: string; translationRevision?: number; locale?: Locale },
) {
  const { locale } = useFormat();
  const versionId = exact?.versionId;
  const revision = exact?.translationRevision;
  const citedLocale = exact?.locale;
  return useContent<{ article: Article | null; current: boolean }>(
    async () => {
      const article = await contentRepo.getArticle(
        articleId,
        locale,
        versionId ? { versionId, translationRevision: revision, locale: citedLocale } : undefined,
      );
      const current = article
        ? await contentRepo.isCurrentVersion(articleId, article.version_id)
        : true;
      return { article, current };
    },
    [articleId, locale, versionId, revision, citedLocale],
    { article: null, current: true },
  );
}

/**
 * Approved articles that match a disease and body part (FR-B05). Empty when the pack has none,
 * and the result screen then says "no related article". No product or shop is ever suggested.
 */
export function useRelatedArticles(diseaseCode: string | null, plantPart: string): Article[] {
  const { locale } = useFormat();
  return useContent(
    () =>
      diseaseCode
        ? contentRepo.relatedArticles(diseaseCode, plantPart, locale)
        : Promise.resolve(NO_ARTICLES),
    [diseaseCode, plantPart, locale],
    NO_ARTICLES,
  ).data;
}

export interface StandardEntry {
  profile: StandardProfile;
  /** The published version; `null` when nothing is approved for this market yet. */
  version: StandardVersion | null;
  /** Versions on the phone, newest first. */
  versions: { id: string; version_no: number }[];
}

export function useStandards() {
  const { locale } = useFormat();
  return useContent<StandardEntry[]>(
    async () => {
      const profiles = await contentRepo.listProfiles();
      return Promise.all(
        profiles.map(async (profile) => ({
          profile,
          version: profile.published_version_id
            ? await contentRepo.getStandardVersion(profile.published_version_id, locale)
            : null,
          versions: await contentRepo.listStandardVersionRefs(profile.id),
        })),
      );
    },
    [locale],
    [],
  );
}

export function useStandardVersion(id: string | null) {
  const { locale } = useFormat();
  return useContent<StandardVersion | null>(
    () => (id ? contentRepo.getStandardVersion(id, locale) : Promise.resolve(null)),
    [id, locale],
    null,
  );
}

export function useContacts(query: ContactQuery) {
  const { kind, province, text } = query;
  return useContent(
    () => contentRepo.listContacts({ kind, province, text }),
    [kind, province, text],
    NO_CONTACTS,
  );
}

export function useProvinces() {
  return useContent(() => contentRepo.listProvinces(), [], NO_STRINGS).data;
}

export function useContact(id: string) {
  return useContent<Contact | null>(() => contentRepo.getContact(id), [id], null);
}
