import type { InferenceMetadata, Locale, PlantPart } from '@/types';

import { decode, ScanRuntimeError, type Decoded } from './decode';
import type { ModelEntry } from './manifest';

/** Runs the model of one entry on one image and returns the raw output vector. */
export interface InferenceEngine {
  classify(entry: ModelEntry, imageUri: string): Promise<ArrayLike<number>>;
}

export interface ScanInference extends Decoded {
  inference_metadata: InferenceMetadata;
}

/** The body parts that have a complete pipeline, in manifest order. */
export const availableParts = (entries: readonly ModelEntry[]) =>
  entries.map((e) => ({ plant_part: e.plant_part, labels: e.part_labels }));

/**
 * Model router + adapter (FR-B03): picks the pipeline for the body part, runs it on the phone and
 * returns a normalised result with the versions that produced it. Any failure is a
 * `ScanRuntimeError`; the caller shows it as the `error` state and does not save it.
 */
export async function runScan(input: {
  entries: readonly ModelEntry[];
  plantPart: PlantPart;
  imageUri: string;
  locale: Locale;
  engine: InferenceEngine;
  clock?: () => number;
}): Promise<ScanInference> {
  const entry = input.entries.find((e) => e.plant_part === input.plantPart);
  if (!entry) throw new ScanRuntimeError('no_pipeline');
  const clock = input.clock ?? Date.now;
  const start = clock();
  let raw: ArrayLike<number>;
  try {
    raw = await input.engine.classify(entry, input.imageUri);
  } catch (e) {
    throw e instanceof ScanRuntimeError ? e : new ScanRuntimeError('run');
  }
  const decoded = decode(entry, raw, input.locale);
  return {
    ...decoded,
    inference_metadata: {
      model_id: entry.model_id,
      model_version: entry.version,
      pipeline_version: entry.pipeline_version,
      threshold_version: entry.threshold_version,
      inference_ms: Math.max(0, Math.round(clock() - start)),
    },
  };
}
