// Stages the models of a handoff folder for publishing: writes assets/models/manifest.json and copies the
// ONNX files next to it (the folder is git-ignored; the app downloads models, it does not bundle them).
// Then, in durianBackend: uv run python -m scripts.publish_models ../durianMobile/assets/models/manifest.json --files ../durianMobile/assets/models --publish
// Usage: node scripts/build-model-manifest.mjs ../mobile-model-sdk-handoff
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('usage: build-model-manifest.mjs <handoff dir>');
const out = new URL('../assets/models/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const PARTS = {
  leaf: { vi: 'Lá', en: 'Leaf' },
  stem: { vi: 'Thân / cành', en: 'Stem / branch' },
  fruit: { vi: 'Quả', en: 'Fruit' },
};
const LABELS = {
  anthracnose_disease: ['Bệnh thán thư', 'Anthracnose'],
  canker_disease: ['Bệnh loét', 'Canker'],
  mealybug_infestation: ['Rệp sáp', 'Mealybug infestation'],
  pink_disease: ['Bệnh hồng', 'Pink disease'],
  sooty_mold: ['Bệnh muội đen', 'Sooty mold'],
  stem_blight: ['Bệnh cháy thân', 'Stem blight'],
  thrips_disease: ['Bọ trĩ', 'Thrips'],
  yellow_leaf: ['Vàng lá', 'Yellow leaf'],
  stem_cracking_gummosis: ['Nứt thân chảy mủ', 'Stem cracking and gummosis'],
  fruit_rot: ['Thối trái', 'Fruit rot'],
};
const label = (c) => {
  const [vi, en] = LABELS[c] ?? [];
  return vi ? { vi, en } : { en: c.replaceAll('_', ' ') };
};

const entries = [];
for (const part of Object.keys(PARTS)) {
  const m = JSON.parse(readFileSync(join(src, part, 'manifest.json'), 'utf8'));
  if (m.supports_healthy) throw new Error(`${part}: unexpected healthy support`);
  const file = `${part}-${m.version.slice(0, 8)}.onnx`;
  copyFileSync(join(src, part, 'model.onnx'), join(out, file));
  const p = m.preprocess;
  entries.push({
    model_id: m.model_id,
    version: m.version,
    pipeline_version: 'js-letterbox-1',
    threshold_version: `energy-${m.version.slice(0, 8)}`,
    plant_part: m.plant_part,
    part_labels: PARTS[part],
    runtime: 'onnx',
    artifact: { path: file, sha256: m.sha256 },
    input: {
      name: m.input_tensor.name,
      width: m.input_tensor.shape[3],
      height: m.input_tensor.shape[2],
      layout: p.layout,
      color: p.convert,
      scale: p.rescale,
      mean: p.mean,
      std: p.std,
      resize: 'letterbox',
      pad: p.pad_rgb,
    },
    output: {
      name: m.output_tensor.name,
      activation: 'temperature_softmax',
      temperature: m.temperature,
    },
    classes: m.classes.map((c, index) => ({
      index,
      kind: 'disease',
      disease_code: m.class_to_disease_code[c],
      labels: label(c),
    })),
    rules: {
      suspected_min: m.confidence_threshold,
      healthy_min: 1,
      energy_max: m.ood_detection.energy_threshold,
    },
  });
}
writeFileSync(
  join(out, 'manifest.json'),
  JSON.stringify({ schema_version: 1, entries }, null, 2) + '\n',
);
console.log(entries.map((e) => e.artifact.path).join('\n'));
