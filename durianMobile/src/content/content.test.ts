import { contentApi, db, resetMockDb } from '@/api';
import { buildRelease } from '@/api/mock/content';
import { contentRepo, resetDbHandle } from '@/db';

import { fold, searchTokens } from './fold';
import { refreshContent, useContentStatus, validateRelease } from './sync';

beforeEach(() => {
  resetDbHandle();
  resetMockDb();
});

const titles = (list: { title: string }[]) => list.map((a) => a.title);

describe('fold', () => {
  it('drops diacritics and maps đ to d', () => {
    expect(fold('Xì mủ — Đốm lá')).toBe('xi mu — dom la');
    expect(searchTokens('  Thối   TRÁI, 2026! ')).toEqual(['thoi', 'trai', '2026']);
  });
});

describe('content release', () => {
  it('is installed from the server and read offline', async () => {
    expect(await contentRepo.getMeta()).toBeNull();
    expect(await refreshContent()).toBe('updated');
    const meta = await contentRepo.getMeta();
    expect(meta?.release_no).toBe(1);
    expect((await contentRepo.listArticles({ locale: 'vi' })).length).toBe(3);
    // Same release again: nothing to download.
    expect(await refreshContent()).toBe('up_to_date');
  });

  it('finds text with and without diacritics, in both languages (FR-C01, AC-24)', async () => {
    await refreshContent();
    for (const q of ['xì mủ', 'xi mu', 'XI MU', 'phytophthora', 'thoi trai', 'đốm']) {
      const found = await contentRepo.listArticles({ locale: 'vi', text: q });
      if (q === 'đốm') expect(found).toEqual([]);
      else expect(found.length).toBeGreaterThan(0);
    }
    // A disease name in English finds the article, which is then shown in Vietnamese.
    const en = await contentRepo.listArticles({ locale: 'vi', text: 'canker' });
    expect(titles(en)).toEqual(['Bệnh xì mủ (mẫu)']);
    // Prefix match and all words must match.
    expect((await contentRepo.listArticles({ locale: 'vi', text: 'thoi tra' })).length).toBe(1);
    expect(await contentRepo.listArticles({ locale: 'vi', text: 'thoi canker' })).toEqual([]);
  });

  it('shows the source text of the same version when a translation is missing (AC-23)', async () => {
    await refreshContent();
    const list = await contentRepo.listArticles({ locale: 'en' });
    const rot = list.find((a) => a.id === 'art-rot')!;
    expect(rot.is_fallback).toBe(true);
    expect(rot.locale).toBe('vi');
    const fert = list.find((a) => a.id === 'art-fert')!;
    expect(fert.is_fallback).toBe(false);
    expect(fert.title).toBe('Fertilising while fruit grows (sample)');
  });

  it('filters by category, body part and stage', async () => {
    await refreshContent();
    expect((await contentRepo.listArticles({ locale: 'vi', category: 'care' })).length).toBe(1);
    expect((await contentRepo.listArticles({ locale: 'vi', part: 'fruit' })).length).toBe(2);
    expect((await contentRepo.listArticles({ locale: 'vi', stage: 'fruit_growth' })).length).toBe(
      1,
    );
    expect(await contentRepo.articleFacets()).toEqual({
      categories: ['care', 'disease'],
      parts: ['fruit', 'leaf'],
      stages: ['fruit_growth'],
    });
  });

  it('finds related articles by disease and body part (FR-B05)', async () => {
    await refreshContent();
    expect(titles(await contentRepo.relatedArticles('phytophthora', 'leaf', 'vi'))).toEqual([
      'Bệnh xì mủ (mẫu)',
    ]);
    expect(await contentRepo.relatedArticles('phytophthora', 'root', 'vi')).toEqual([]);
    expect(await contentRepo.relatedArticles('unknown_code', 'leaf', 'vi')).toEqual([]);
  });

  it('a failed download keeps the previous release (AC-25)', async () => {
    await refreshContent();
    db.contentRelease = 2;
    db.sim.failRelease = true;
    expect(await refreshContent()).toBe('failed');
    expect(useContentStatus.getState().state).toBe('failed');
    expect((await contentRepo.getMeta())?.release_no).toBe(1);
    expect((await contentRepo.listArticles({ locale: 'vi' })).length).toBe(3);

    // Back online: the same call installs it. Nothing retried by itself in between.
    db.sim.failRelease = false;
    expect(await refreshContent()).toBe('updated');
    expect((await contentRepo.getMeta())?.release_no).toBe(2);
    expect((await contentRepo.listArticles({ locale: 'vi' })).length).toBe(4);
  });

  it('a release that breaks half way rolls back completely', async () => {
    await refreshContent();
    const broken = buildRelease(2);
    // The second contact has no kind, which the table refuses.
    (broken.contacts[1] as { kind: unknown }).kind = null;
    await expect(contentRepo.installRelease(broken, new Date().toISOString())).rejects.toThrow();
    expect((await contentRepo.getMeta())?.release_no).toBe(1);
    expect((await contentRepo.listArticles({ locale: 'vi' })).length).toBe(3);
    expect((await contentRepo.listContacts()).length).toBe(3);
  });

  it('refuses a release that is not the one announced', () => {
    const manifest = { ...buildRelease(2) };
    const other = buildRelease(1);
    expect(() => validateRelease(manifest, other)).toThrow('invalid_release');
    expect(() =>
      validateRelease(manifest, { ...manifest, articles: undefined as never }),
    ).toThrow();
    expect(() => validateRelease(manifest, manifest)).not.toThrow();
  });

  it('refuses a content schema this build cannot read', async () => {
    jest
      .spyOn(contentApi, 'manifest')
      .mockResolvedValueOnce({ ...buildRelease(1), schema_version: 99 });
    expect(await refreshContent()).toBe('unsupported');
    expect(await contentRepo.getMeta()).toBeNull();
  });

  it('a translation revision changes only the text; a cited revision still opens its old text (AC-25)', async () => {
    await refreshContent();
    const cited = {
      article_id: 'art-phyto',
      version_id: 'art-phyto-v1',
      version_no: 1,
      translation_revision: 1,
      source_locale: 'en' as const,
      title: 'Phytophthora canker (sample)',
    };
    await contentRepo.pinCitations([cited]);

    db.contentRelease = 2;
    await refreshContent();

    const now = await contentRepo.getArticle('art-phyto', 'en');
    expect(now?.translation_revision).toBe(2);
    expect(now?.body).toContain('revised');
    // Same article, same version id, same item ids: only the revision moved.
    expect(now?.version_id).toBe('art-phyto-v1');

    const old = await contentRepo.getArticle('art-phyto', 'en', {
      versionId: 'art-phyto-v1',
      translationRevision: 1,
      locale: 'en',
    });
    expect(old?.translation_revision).toBe(1);
    expect(old?.is_fallback).toBe(false);
    expect(old?.body).not.toContain('revised');
  });

  it('an uncited old revision is gone and is not replaced by the new text', async () => {
    await refreshContent();
    db.contentRelease = 2;
    await refreshContent();
    const old = await contentRepo.getArticle('art-phyto', 'en', {
      versionId: 'art-phyto-v1',
      translationRevision: 1,
      locale: 'en',
    });
    expect(old).toBeNull();
  });
});

describe('standards', () => {
  it('shows the published version, flags a missing profile as empty, and pins a ticked version (AC-16)', async () => {
    await refreshContent();
    const profiles = await contentRepo.listProfiles();
    expect(profiles.map((p) => [p.market_code, p.published_version_id])).toEqual([
      ['CN', 'std-cn-v1'],
      ['EU', null],
    ]);
    const v1 = await contentRepo.getStandardVersion('std-cn-v1', 'vi');
    expect(v1?.items).toHaveLength(3);
    // Item ids are the same in every language, so a tick does not depend on the UI language.
    const en = await contentRepo.getStandardVersion('std-cn-v1', 'en');
    expect(en?.items.map((i) => i.id)).toEqual(v1?.items.map((i) => i.id));
    expect(en?.is_fallback).toBe(false);

    await contentRepo.pinStandardVersion('std-cn-v1');
    db.contentRelease = 2;
    await refreshContent();

    const now = await contentRepo.listProfiles();
    expect(now[0].published_version_id).toBe('std-cn-v2');
    const v2 = await contentRepo.getStandardVersion('std-cn-v2', 'vi');
    expect(v2?.items).toHaveLength(4);
    // v1 is still readable, and v2 shares none of its item ids (a new version starts unticked).
    const kept = await contentRepo.getStandardVersion('std-cn-v1', 'vi');
    expect(kept?.items).toHaveLength(3);
    expect(v2!.items.some((i) => kept!.items.some((k) => k.id === i.id))).toBe(false);
    expect(
      (await contentRepo.listStandardVersionRefs('profile-cn-fresh')).map((v) => v.id),
    ).toEqual(['std-cn-v2', 'std-cn-v1']);
  });

  it('drops an unpinned old version when a release replaces it', async () => {
    await refreshContent();
    db.contentRelease = 2;
    await refreshContent();
    expect(await contentRepo.getStandardVersion('std-cn-v1', 'vi')).toBeNull();
  });
});

describe('directory', () => {
  it('filters by kind, province and words without diacritics', async () => {
    await refreshContent();
    expect((await contentRepo.listContacts()).length).toBe(3);
    expect((await contentRepo.listContacts({ kind: 'expert' })).map((c) => c.id)).toEqual([
      'contact-expert-1',
    ]);
    expect((await contentRepo.listContacts({ province: 'Tiền Giang' })).length).toBe(1);
    expect((await contentRepo.listContacts({ text: 'dak lak' })).length).toBe(2);
    expect((await contentRepo.listContacts({ text: 'benh hai' })).map((c) => c.id)).toEqual([
      'contact-expert-1',
    ]);
    expect(await contentRepo.listProvinces()).toEqual(['Tiền Giang', 'Đắk Lắk']);
  });
});
