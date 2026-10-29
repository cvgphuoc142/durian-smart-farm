import type { ModelEntry } from '@/ai';
import { mutation, newId, syncApi, upsert } from '@/api';
import { scanRepo } from '@/db';
import type { InferenceMetadata } from '@/types';

export const USER = 'mock-user';

/** farm › plot › season on the mock server, so a scan has somewhere to go. */
export async function seedSeason(season = 's1') {
  await syncApi.send(
    mutation(
      upsert('farm', 'f1', { name: 'Vườn A' }, null),
      upsert('plot', 'p1', { farm_id: 'f1', name: 'Lô 1' }, null),
      upsert(
        'season',
        season,
        { plot_id: 'p1', name: 'Vụ 2026', started_on: '2026-03-01', stage: 'fruit_growth' },
        null,
      ),
    ),
  );
}

const inference: InferenceMetadata = {
  model_id: 'm',
  model_version: '1',
  pipeline_version: 'p1',
  threshold_version: 't1',
  inference_ms: 12,
};

export async function makeDraft(over: Partial<Parameters<typeof scanRepo.saveDraft>[0]> = {}) {
  const id = over.id ?? newId();
  await scanRepo.saveDraft({
    id,
    user_id: USER,
    photo_id: newId(),
    photo_uri: `file:///scans/${id}.jpg`,
    mime_type: 'image/jpeg',
    size_bytes: 1234,
    sha256: 'a'.repeat(64),
    plant_part: 'leaf',
    captured_at: new Date().toISOString(),
    outcome: 'suspected',
    error_code: null,
    disease_code: 'anthracnose',
    score: 0.91,
    label_snapshot: 'Thán thư',
    label_locale: 'vi',
    predictions: [{ disease_code: 'anthracnose', score: 0.91 }],
    inference,
    ...over,
  });
  return id;
}

export const entry = (over: Partial<ModelEntry> = {}): ModelEntry => ({
  model_id: 'durian-leaf',
  version: '1.0.0',
  pipeline_version: 'p1',
  threshold_version: 't1',
  plant_part: 'leaf',
  part_labels: { vi: 'Lá', en: 'Leaf' },
  runtime: 'onnx',
  artifact: { path: 'leaf.onnx', sha256: 'b'.repeat(64), size_bytes: 28_000_000 },
  release_notes: 'Bản mới',
  maturity: 'stable',
  supports_healthy: true,
  input: {
    name: 'input',
    width: 2,
    height: 2,
    layout: 'NCHW',
    color: 'RGB',
    scale: 1 / 255,
    mean: [0.5, 0.5, 0.5],
    std: [0.5, 0.5, 0.5],
    resize: 'stretch',
  },
  output: { name: 'logits', activation: 'softmax' },
  classes: [
    { index: 0, kind: 'healthy', disease_code: null, labels: { vi: 'Khỏe', en: 'Healthy' } },
    {
      index: 1,
      kind: 'disease',
      disease_code: 'anthracnose',
      labels: { vi: 'Thán thư', en: 'Anthracnose' },
    },
    { index: 2, kind: 'other', disease_code: null, labels: {} },
  ],
  rules: { suspected_min: 0.7, healthy_min: 0.8 },
  ...over,
});
