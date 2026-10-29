import { USE_MOCK } from '@/config';

import type { ModelEntry, ParsedManifest } from './manifest';
import { parseManifest } from './manifest';
import type { InferenceEngine } from './router';

/**
 * TEST-ONLY classifier so the Scan screens can be built before the real model arrives. It is on
 * only in a development build that also runs on the mock backend. It is never in a release build,
 * its results say so on screen, and Scan is not accepted while it is the only model.
 */
export const STUB_ENABLED = __DEV__ && USE_MOCK;
export const STUB_MODEL_ID = 'dev-stub';

const stubEntry = (plant_part: string, vi: string, en: string): ModelEntry => ({
  model_id: STUB_MODEL_ID,
  version: '0',
  pipeline_version: 'stub-0',
  threshold_version: 'stub-0',
  plant_part,
  part_labels: { vi, en },
  runtime: 'onnx',
  artifact: { path: 'dev-stub', sha256: '0'.repeat(64), size_bytes: 1 },
  release_notes: 'Mô hình thử nghiệm',
  maturity: 'beta',
  supports_healthy: true,
  input: {
    name: 'input',
    width: 8,
    height: 8,
    layout: 'NCHW',
    color: 'RGB',
    scale: 1 / 255,
    mean: [0, 0, 0],
    std: [1, 1, 1],
    resize: 'stretch',
  },
  output: { name: 'output', activation: 'softmax' },
  classes: [
    { index: 0, kind: 'healthy', disease_code: null, labels: { vi: 'Khỏe', en: 'Healthy' } },
    {
      index: 1,
      kind: 'disease',
      disease_code: 'dev_stub_disease',
      labels: { vi: 'Bệnh thử nghiệm', en: 'Test disease' },
    },
    { index: 2, kind: 'other', disease_code: null, labels: {} },
  ],
  rules: { suspected_min: 0.5, healthy_min: 0.5 },
  stub: true,
});

/** Deterministic scores from the image path, so a test sees the same result twice. */
export const stubEngine: InferenceEngine = {
  async classify(_entry, imageUri) {
    let h = 7;
    for (let i = 0; i < imageUri.length; i++) h = (h * 31 + imageUri.charCodeAt(i)) >>> 0;
    const pick = h % 3;
    const logits = [0, 0, 0];
    if (pick === 2) return [0.2, 0.1, 0.15];
    logits[pick] = 3;
    return logits;
  },
};

/**
 * The entries the scan screens use: the models installed on the phone, plus the stub parts in a
 * development build. A real model of a part always wins over the stub.
 */
export function withStubs(real: ParsedManifest, options: { stub?: boolean } = {}): ParsedManifest {
  if (!(options.stub ?? STUB_ENABLED)) return real;
  const have = new Set(real.entries.map((e) => e.plant_part));
  const stubs = [stubEntry('leaf', 'Lá', 'Leaf'), stubEntry('fruit', 'Trái', 'Fruit')].filter(
    (e) => !have.has(e.plant_part),
  );
  return { entries: [...real.entries, ...stubs], rejected: real.rejected };
}

// Keeps the stub entries valid against the schema (checked once in tests).
export const _stubManifestForTest = (): ParsedManifest =>
  parseManifest({ schema_version: 1, entries: [stubEntry('leaf', 'Lá', 'Leaf')] });
