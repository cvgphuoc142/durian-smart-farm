import { entry } from '@/test/scanFixtures';

import { decode, normalize, ScanRuntimeError } from './decode';
import { parseManifest } from './manifest';
import { centerCrop, tensorDims, toTensorData } from './preprocess';
import { runScan } from './router';
import { _stubManifestForTest, loadManifest, stubEngine } from './stub';

const has = (p: string) => p === 'leaf.onnx' || p === 'fruit.onnx';

describe('manifest', () => {
  it('keeps complete entries and drops the rest, with the reason', () => {
    const good = entry();
    const result = parseManifest(
      {
        schema_version: 1,
        entries: [
          good,
          {
            ...entry({
              plant_part: 'fruit',
              artifact: { path: 'gone.onnx', sha256: 'c'.repeat(64) },
            }),
          },
          entry({
            plant_part: 'trunk',
            classes: [
              { index: 0, kind: 'healthy', disease_code: null, labels: {} },
              { index: 1, kind: 'disease', disease_code: null, labels: {} },
            ],
          }),
          entry({ plant_part: 'leaf' }),
          { model_id: 'x', plant_part: 'root' },
        ],
      },
      has,
    );
    expect(result.entries.map((e) => e.plant_part)).toEqual(['leaf']);
    expect(result.rejected.map((r) => r.reason)).toEqual(
      expect.arrayContaining(['artifact_missing', 'duplicate_part']),
    );
    expect(result.rejected).toHaveLength(4);
  });

  it('an empty or broken manifest offers no body part', () => {
    expect(parseManifest({ schema_version: 1, entries: [] }, has).entries).toEqual([]);
    expect(parseManifest({ nope: true }, has).entries).toEqual([]);
  });

  it('the bundled manifest has no model yet, so the release build lists no part', () => {
    expect(loadManifest({ stub: false }).entries).toEqual([]);
  });

  it('the dev stub entries are valid and only appear when asked for', () => {
    expect(_stubManifestForTest().entries).toHaveLength(1);
    const parts = loadManifest({ stub: true }).entries.map((e) => e.plant_part);
    expect(parts).toEqual(['leaf', 'fruit']);
  });
});

describe('decode (FR-B04, FR-B11)', () => {
  const e = entry();

  it('a disease class above its threshold is "suspected", with code, label and score', () => {
    const r = decode(e, [0, 5, 0], 'vi');
    expect(r).toMatchObject({
      outcome: 'suspected',
      disease_code: 'anthracnose',
      label_snapshot: 'Thán thư',
      label_locale: 'vi',
    });
    expect(r.score).toBeGreaterThan(0.9);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it('the label follows the UI language, and falls back to the other one with its real locale', () => {
    expect(decode(e, [0, 5, 0], 'en')).toMatchObject({
      label_snapshot: 'Anthracnose',
      label_locale: 'en',
    });
    const viOnly = entry({
      classes: entry().classes.map((c) =>
        c.index === 1 ? { ...c, labels: { vi: 'Thán thư' } } : c,
      ),
    });
    expect(decode(viOnly, [0, 5, 0], 'en')).toMatchObject({
      label_snapshot: 'Thán thư',
      label_locale: 'vi',
    });
  });

  it('a healthy class above its threshold is "healthy" and has no disease', () => {
    expect(decode(e, [5, 0, 0], 'vi')).toMatchObject({ outcome: 'healthy', disease_code: null });
  });

  it('below the threshold the answer is "inconclusive": no disease, no label, no score', () => {
    const r = decode(e, [1, 1.2, 0.9], 'vi');
    expect(r).toMatchObject({
      outcome: 'inconclusive',
      disease_code: null,
      score: null,
      label_snapshot: null,
    });
    expect(r.predictions).toHaveLength(3);
  });

  it('an "other" class or an index with no mapping never becomes a disease', () => {
    expect(decode(e, [0, 0, 6], 'vi').outcome).toBe('inconclusive');
    expect(decode(e, [0, 0, 0, 9], 'vi')).toMatchObject({
      outcome: 'inconclusive',
      disease_code: null,
    });
  });

  it('a margin rule turns a close call into "inconclusive"', () => {
    const m = entry({ rules: { suspected_min: 0.4, healthy_min: 0.4, margin_min: 0.3 } });
    expect(decode(m, [0, 1, 0.9], 'vi').outcome).toBe('inconclusive');
  });

  it('probabilities pass through when the manifest says the output has no activation', () => {
    const p = entry({ output: { name: 'p', activation: 'none' } });
    expect(decode(p, [0.05, 0.9, 0.05], 'vi')).toMatchObject({ outcome: 'suspected', score: 0.9 });
    expect(normalize([0, 0], 'sigmoid')).toEqual([0.5, 0.5]);
  });

  it('a non-number in the output is a runtime error, not a result', () => {
    expect(() => decode(e, [NaN, 1, 0], 'vi')).toThrow(ScanRuntimeError);
    expect(() => decode(e, [], 'vi')).toThrow(ScanRuntimeError);
  });
});

describe('router', () => {
  const entries = [entry()];

  it('runs the pipeline of the body part and records the versions and time', async () => {
    let t = 1000;
    const r = await runScan({
      entries,
      plantPart: 'leaf',
      imageUri: 'file:///a.jpg',
      locale: 'vi',
      engine: { classify: async () => [0, 5, 0] },
      clock: () => (t += 40),
    });
    expect(r.inference_metadata).toEqual({
      model_id: 'durian-leaf',
      model_version: '1.0.0',
      pipeline_version: 'p1',
      threshold_version: 't1',
      inference_ms: 40,
    });
  });

  it('a body part with no pipeline, or an engine that throws, ends in ScanRuntimeError', async () => {
    const base = { entries, imageUri: 'x', locale: 'vi' as const };
    await expect(
      runScan({ ...base, plantPart: 'trunk', engine: { classify: async () => [1] } }),
    ).rejects.toMatchObject({ code: 'no_pipeline' });
    await expect(
      runScan({
        ...base,
        plantPart: 'leaf',
        engine: {
          classify: async () => {
            throw new Error('native crash');
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'run' });
  });

  it('the stub gives the same answer for the same photo', async () => {
    const stub = loadManifest({ stub: true }).entries[0];
    const a = await stubEngine.classify(stub, 'file:///1.jpg');
    const b = await stubEngine.classify(stub, 'file:///1.jpg');
    expect(a).toEqual(b);
  });
});

describe('preprocess', () => {
  const rgba = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255];
  const input = entry().input;

  it('NCHW with mean/std 0.5: one plane per channel, scaled to −1…1', () => {
    const d = toTensorData(rgba, input);
    expect(Array.from(d.slice(0, 4))).toEqual([1, -1, -1, 1]); // R plane
    expect(Array.from(d.slice(4, 8))).toEqual([-1, 1, -1, 1]); // G plane
    expect(tensorDims(input)).toEqual([1, 3, 2, 2]);
  });

  it('NHWC with BGR: pixels interleaved, channels swapped', () => {
    const d = toTensorData(rgba, { ...input, layout: 'NHWC', color: 'BGR' });
    expect(Array.from(d.slice(0, 3))).toEqual([-1, -1, 1]); // first pixel is pure red → B,G,R
    expect(tensorDims({ ...input, layout: 'NHWC' })).toEqual([1, 2, 2, 3]);
  });

  it('centre crop keeps the target aspect ratio', () => {
    expect(centerCrop(400, 200, 100, 100)).toEqual({
      originX: 100,
      originY: 0,
      width: 200,
      height: 200,
    });
    expect(centerCrop(200, 400, 100, 100)).toEqual({
      originX: 0,
      originY: 100,
      width: 200,
      height: 200,
    });
  });
});
