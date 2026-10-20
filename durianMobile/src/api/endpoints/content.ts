import type { ContentManifest, ContentRelease } from '@/types';

import { http } from '../client';

export const contentApi = {
  manifest: () => http.get<ContentManifest>('/v1/content/manifest'),
  release: (releaseNo: number) => http.get<ContentRelease>(`/v1/content/releases/${releaseNo}`),
};
