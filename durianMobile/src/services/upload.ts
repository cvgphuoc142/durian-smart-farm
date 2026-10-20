import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';

import { ApiRequestError } from '@/api';

/**
 * Sends the photo bytes to the time-limited URL from `media/prepare`. `mock:` URLs belong to the
 * in-process backend and have nowhere to go.
 */
export async function uploadPhoto(uploadUrl: string, fileUri: string, mimeType: string) {
  if (uploadUrl.startsWith('mock:')) return;
  let status: number;
  try {
    const res = await uploadAsync(uploadUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': mimeType },
    });
    status = res.status;
  } catch {
    throw new ApiRequestError({ code: 'network', message: 'upload failed', retryable: true });
  }
  if (status >= 200 && status < 300) return;
  throw new ApiRequestError({
    code: status === 403 ? 'upload_url_expired' : 'upload_failed',
    message: `upload ${status}`,
    status,
    // An expired URL is fixed by asking `prepare` again, which the next run does.
    retryable: status === 403 || status >= 500 || status === 408 || status === 429,
  });
}
