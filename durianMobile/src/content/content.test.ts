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
    expect((await contentRepo.listArticles({})).length).toBe(3);
    // Same release again: nothing to download.
    expect(await refreshContent()).toBe('up_to_date');
  });

  it('finds text with and without diacritics (FR-C01, AC-24)', async () => {
    await refreshContent();
    for (const q of ['xì mủ', 'xi mu', 'XI MU', 'phytophthora', 'thoi trai', 'đốm']) {
      const found = await contentRepo.listArticles({ text: q });
      if (q === 'đốm') expect(found).toEqual([]);
      else expect(found.length).toBeGreaterThan(0);
    }
    // A disease name in English finds the article.
    const en = await contentRepo.listArticles({ text: 'canker' });
    expect(titles(en)).toEqual(['Bệnh xì mủ (mẫu)']);
    // Prefix match and all words must match.
    expect((await contentRepo.listArticles({ text: 'thoi tra' })).length).toBe(1);
    expect(await contentRepo.listArticles({ text: 'thoi canker' })).toEqual([]);
  });

  it('filters by category, body part and stage', async () => {
    await refreshContent();
    expect((await contentRepo.listArticles({ category: 'care' })).length).toBe(1);
    expect((await contentRepo.listArticles({ part: 'fruit' })).length).toBe(2);
    expect((await contentRepo.listArticles({ stage: 'fruit_growth' })).length).toBe(
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
    expect(titles(await contentRepo.relatedArticles('phytophthora', 'leaf'))).toEqual([
      'Bệnh xì mủ (mẫu)',
    ]);
    expect(await contentRepo.relatedArticles('phytophthora', 'root')).toEqual([]);
    expect(await contentRepo.relatedArticles('unknown_code', 'leaf')).toEqual([]);
  });

  it('a failed download keeps the previous release (AC-25)', async () => {
    await refreshContent();
    db.contentRelease = 2;
    db.sim.failRelease = true;
    expect(await refreshContent()).toBe('failed');
    expect(useContentStatus.getState().state).toBe('failed');
    expect((await contentRepo.getMeta())?.release_no).toBe(1);
    expect((await contentRepo.listArticles({})).length).toBe(3);

    // Back online: the same call installs it. Nothing retried by itself in between.
    db.sim.failRelease = false;
    expect(await refreshContent()).toBe('updated');
    expect((await contentRepo.getMeta())?.release_no).toBe(2);
    expect((await contentRepo.listArticles({})).length).toBe(4);
  });

  it('a release that breaks half way rolls back completely', async () => {
    await refreshContent();
    const broken = buildRelease(2);
    // The second contact has no kind, which the table refuses.
    (broken.contacts[1] as { kind: unknown }).kind = null;
    await expect(contentRepo.installRelease(broken, new Date().toISOString())).rejects.toThrow();
    expect((await contentRepo.getMeta())?.release_no).toBe(1);
    expect((await contentRepo.listArticles({})).length).toBe(3);
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

  it('a cited version still opens its old text after a newer one is published (AC-25)', async () => {
    await refreshContent();
    const cited = {
      article_id: 'art-phyto',
      version_id: 'art-phyto-v1',
      version_no: 1,
      title: 'Bệnh xì mủ (mẫu)',
      source_links: [],
    };
    await contentRepo.pinCitations([cited]);

    db.contentRelease = 2;
    await refreshContent();

    const now = await contentRepo.getArticle('art-phyto');
    expect(now?.version_no).toBe(2);
    expect(now?.body).toContain('bản sửa');

    const old = await contentRepo.getArticle('art-phyto', { versionId: 'art-phyto-v1' });
    expect(old?.version_no).toBe(1);
    expect(old?.body).not.toContain('bản sửa');
  });

  it('an uncited old version is gone and is not replaced by the new text', async () => {
    await refreshContent();
    db.contentRelease = 2;
    await refreshContent();
    expect(await contentRepo.getArticle('art-phyto', { versionId: 'art-phyto-v1' })).toBeNull();
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
    const v1 = await contentRepo.getStandardVersion('std-cn-v1');
    expect(v1?.items).toHaveLength(3);
    expect(v1?.title).toContain('Tiêu chuẩn CN');

    await contentRepo.pinStandardVersion('std-cn-v1');
    db.contentRelease = 2;
    await refreshContent();

    const now = await contentRepo.listProfiles();
    expect(now[0].published_version_id).toBe('std-cn-v2');
    const v2 = await contentRepo.getStandardVersion('std-cn-v2');
    expect(v2?.items).toHaveLength(4);
    // v1 is still readable, and v2 shares none of its item ids (a new version starts unticked).
    const kept = await contentRepo.getStandardVersion('std-cn-v1');
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
    expect(await contentRepo.getStandardVersion('std-cn-v1')).toBeNull();
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
