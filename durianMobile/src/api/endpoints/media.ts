import type { MediaAsset } from '@/types';

import { http } from '../client';

export interface PrepareMediaRequest {
  /** Stable id so a retried upload is the same asset. */
  asset_id: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
}

export interface PrepareMediaResponse {
  asset: MediaAsset;
  /** Time-limited. Never stored as an id. */
  upload_url: string | null;
}

export interface MediaAccess {
  /** Short-lived signed GET url for a private photo. Never persisted. */
  url: string;
  expires_at: string;
}

export const mediaApi = {
  prepare: (body: PrepareMediaRequest) =>
    http.post<PrepareMediaResponse>('/v1/media/prepare', body),
  access: (assetId: string) => http.get<MediaAccess>(`/v1/media/${assetId}/access`),
  complete: (assetId: string) => http.post<MediaAsset>('/v1/media/complete', { asset_id: assetId }),
};
