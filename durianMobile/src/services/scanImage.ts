import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Longest side of the photo that is stored and uploaded. The model gets its own smaller copy. */
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.8;

export interface StagedImage {
  uri: string;
  mime_type: 'image/jpeg';
  size_bytes: number;
  sha256: string;
}

const scansDir = () => new Directory(Paths.document, 'scans');

const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256OfFile(uri: string): Promise<string> {
  const bytes = await new File(uri).bytes();
  return hex(await digest(CryptoDigestAlgorithm.SHA256, bytes));
}

/**
 * Compresses the picked photo and moves it into the app's own storage, which survives a restart
 * and is not cleaned by the system. Only after this returns may the UI say "saved" (FR-B10).
 * The file is named by `photoId`, so staging the same photo twice gives the same file.
 */
export async function stageImage(
  sourceUri: string,
  photoId: string,
  size: { width: number; height: number },
): Promise<StagedImage> {
  const longest = Math.max(size.width, size.height);
  let context = ImageManipulator.manipulate(sourceUri);
  if (longest > MAX_SIDE) {
    context = context.resize(
      size.width >= size.height ? { width: MAX_SIDE } : { height: MAX_SIDE },
    );
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

  const dir = scansDir();
  dir.create({ idempotent: true, intermediates: true });
  const target = new File(dir, `${photoId}.jpg`);
  if (target.exists) target.delete();
  new File(saved.uri).move(target);

  return {
    uri: target.uri,
    mime_type: 'image/jpeg',
    size_bytes: target.size,
    sha256: await sha256OfFile(target.uri),
  };
}

export function fileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/** Best effort: a leftover file is harmless, a failure here must not block the user. */
export function removeImage(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
