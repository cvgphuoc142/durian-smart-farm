import type { ParsedManifest } from './manifest';
import { parseManifest } from './manifest';

/**
 * Model files bundled in the build, keyed by the manifest's `artifact.path`. Add the file to
 * `assets/models/`, list it here with a static `require`, and add its entry to `manifest.json`.
 * Metro needs the `require` to be static, so this cannot be built from the manifest.
 *
 * Empty until the model provider delivers the files; Scan then has no body parts to offer.
 */
export const bundledArtifacts: Record<string, number> = {
  // 'leaf-v1.onnx': require('../../assets/models/leaf-v1.onnx'),
};

export const bundledManifest: unknown = require('../../assets/models/manifest.json');

export const hasBundledArtifact = (path: string) => path in bundledArtifacts;

export function loadBundledManifest(): ParsedManifest {
  return parseManifest(bundledManifest, hasBundledArtifact);
}
