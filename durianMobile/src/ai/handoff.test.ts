import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { decode, energy } from './decode';
import { loadManifest } from './stub';

const handoff = join(__dirname, '../../../mobile-model-sdk-handoff');
const vectors = (part: string) => {
  try {
    return JSON.parse(readFileSync(join(handoff, part, 'reference_vectors.json'), 'utf8'));
  } catch {
    return null;
  }
};

/** Runs only where the handoff folder sits next to the app; otherwise there is nothing to compare to. */
describe('decode on the handoff reference logits', () => {
  const { entries } = loadManifest({ stub: false });
  for (const entry of entries) {
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
});
