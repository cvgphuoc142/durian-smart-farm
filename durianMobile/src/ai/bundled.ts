import type { ParsedManifest } from './manifest';
import { parseManifest } from './manifest';

/**
 * Model files bundled in the build, keyed by the manifest's `artifact.path`. Add the file to
 * `assets/models/`, list it here with a static `require`, and add its entry to `manifest.json`.
 * Metro needs the `require` to be static, so this cannot be built from the manifest.
 *
 * `manifest.json` and the files are generated from the model handoff by
 * `scripts/build-model-manifest.mjs`.
 */
export const bundledArtifacts: Record<string, number> = {
  'leaf-4186d615.onnx': require('../../assets/models/leaf-4186d615.onnx'),
  'stem-4186d615.onnx': require('../../assets/models/stem-4186d615.onnx'),
  'fruit-4186d615.onnx': require('../../assets/models/fruit-4186d615.onnx'),
};

export const bundledManifest: unknown = require('../../assets/models/manifest.json');

export const hasBundledArtifact = (path: string) => path in bundledArtifacts;

export function loadBundledManifest(): ParsedManifest {
  return parseManifest(bundledManifest, hasBundledArtifact);
}
