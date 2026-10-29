import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { decode, energy } from './decode';
import { parseManifest } from './manifest';

const handoff = join(__dirname, '../../../mobile-model-sdk-handoff');
const staged = join(__dirname, '../../assets/models/manifest.json');
const vectors = (part: string) => {
  try {
    return JSON.parse(readFileSync(join(handoff, part, 'reference_vectors.json'), 'utf8'));
  } catch {
    return null;
  }
};

/** The staged models (`scripts/build-model-manifest.mjs`) as the server would publish them. */
const staged_entries = () => {
  if (!existsSync(staged)) return [];
  const raw = JSON.parse(readFileSync(staged, 'utf8')) as { entries: Record<string, unknown>[] };
  return parseManifest({
    schema_version: 1,
    entries: raw.entries.map((e) => ({
      ...e,
      artifact: { ...(e.artifact as object), size_bytes: 1 },
      release_notes: 'test',
      maturity: 'beta',
      supports_healthy: false,
    })),
  }).entries;
};

/** Runs only where the handoff folder and the staged manifest sit next to the app; otherwise there is nothing to compare to. */
describe('decode on the handoff reference logits', () => {
  for (const entry of staged_entries()) {
    const ref = vectors(entry.plant_part);
    (ref ? it : it.skip)(`${entry.plant_part}: never healthy, energy is finite`, () => {
      const items: { expected_logits: number[] }[] = ref.items ?? ref.vectors ?? ref;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        const r = decode(entry, item.expected_logits, 'vi');
        expect(['suspected', 'inconclusive']).toContain(r.outcome);
        expect(Number.isFinite(energy(item.expected_logits, entry.output.temperature!))).toBe(true);
      }
    });
  }

  it('is a no-op when nothing is staged', () => {
    expect(Array.isArray(staged_entries())).toBe(true);
  });
});
