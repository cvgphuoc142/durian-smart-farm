import { http } from '../client';

/** Answer of `GET /v1/models/manifest`. `entries` are parsed by `@/ai` (`parseManifest`). */
export interface ModelManifestResponse {
  schema_version: number;
  revision: string;
  published_at: string | null;
  entries: unknown[];
}

/** A short-lived link to one model file. The phone checks `sha256` and `size_bytes` itself. */
export interface ModelDownloadInfo {
  url: string;
  expires_at: string;
  sha256: string;
  size_bytes: number;
  path: string;
}

/** Wire contract: `durianBackend/openapi.json` (`getModelManifest`, `getModelDownload`, `setPushToken`). */
export const modelsApi = {
  manifest: () => http.get<ModelManifestResponse>('/v1/models/manifest'),
  download: (modelId: string, version: string) =>
    http.get<ModelDownloadInfo>(
      `/v1/models/${encodeURIComponent(modelId)}/${encodeURIComponent(version)}/download`,
    ),
  registerPush: (token: string, platform: 'ios' | 'android') =>
    http.put<{ status: string }>('/v1/me/push-token', { token, platform }),
  unregisterPush: (token: string) =>
    http.delete<{ status: string }>(`/v1/me/push-token?token=${encodeURIComponent(token)}`),
};
