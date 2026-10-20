import type { Locale, Prediction, ScanOutcome } from '@/types';

import type { ClassEntry, ModelEntry } from './manifest';

/** Raw output → probabilities, as the manifest says the output is. */
export function normalize(raw: ArrayLike<number>, activation: ModelEntry['output']['activation']) {
  const v = Array.from(raw);
  if (activation === 'none') return v;
  if (activation === 'sigmoid') return v.map((x) => 1 / (1 + Math.exp(-x)));
  const max = Math.max(...v);
  const exps = v.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

export interface Decoded {
  outcome: ScanOutcome;
  disease_code: string | null;
  score: number | null;
  label_snapshot: string | null;
  label_locale: Locale | null;
  predictions: Prediction[];
}

export const PREDICTIONS_KEPT = 3;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function labelOf(c: ClassEntry, locale: Locale): { label: string; locale: Locale } | null {
  const order: Locale[] = locale === 'vi' ? ['vi', 'en'] : ['en', 'vi'];
  for (const l of order) {
    const label = c.labels[l];
    if (label) return { label, locale: l };
  }
  return null;
}

/**
 * Applies the manifest's rules to the scores (FR-B04). The answer is "suspected" only for a class
 * that maps to a known disease and clears the threshold. Everything else is "inconclusive" and
 * carries no label and no disease: nothing is invented.
 */
export function decode(entry: ModelEntry, raw: ArrayLike<number>, locale: Locale): Decoded {
  const scores = normalize(raw, entry.output.activation);
  if (scores.length === 0 || scores.some((s) => !Number.isFinite(s))) {
    throw new ScanRuntimeError('bad_output');
  }
  const byIndex = new Map(entry.classes.map((c) => [c.index, c]));
  const ranked = scores
    .map((score, index) => ({ index, score: clamp01(score) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const predictions: Prediction[] = ranked.slice(0, PREDICTIONS_KEPT).map((r) => {
    const c = byIndex.get(r.index);
    return { disease_code: c?.kind === 'disease' ? c.disease_code : null, score: r.score };
  });

  const inconclusive: Decoded = {
    outcome: 'inconclusive',
    disease_code: null,
    score: null,
    label_snapshot: null,
    label_locale: null,
    predictions,
  };

  const [top, second] = ranked;
  const c = byIndex.get(top.index);
  if (!c || c.kind === 'other') return inconclusive;
  const { margin_min, suspected_min, healthy_min } = entry.rules;
  if (margin_min != null && second && top.score - second.score < margin_min) return inconclusive;

  if (c.kind === 'healthy') {
    if (top.score < healthy_min) return inconclusive;
    const l = labelOf(c, locale);
    return {
      outcome: 'healthy',
      disease_code: null,
      score: top.score,
      label_snapshot: l?.label ?? null,
      label_locale: l?.locale ?? null,
      predictions,
    };
  }

  if (!c.disease_code || top.score < suspected_min) return inconclusive;
  const l = labelOf(c, locale);
  return {
    outcome: 'suspected',
    disease_code: c.disease_code,
    score: top.score,
    label_snapshot: l?.label ?? null,
    label_locale: l?.locale ?? null,
    predictions,
  };
}

/** The model could not run or answered nonsense. Shown as the `error` state; never saved. */
export class ScanRuntimeError extends Error {
  constructor(readonly code: 'no_pipeline' | 'model_load' | 'image' | 'run' | 'bad_output') {
    super(code);
  }
}
