import { z } from 'zod';

/**
 * The model manifest bundled with the app (brief §5, FR-B03). One entry per body part; the UI lists
 * only parts whose entry is complete and whose model file is really in the build.
 *
 * Assumed layout: the provider has not sent a manifest yet. The fields follow architecture-overview
 * "Scan offline với nhiều model"; change them here, in one place, when the real one arrives.
 */
const unit = z.number().min(0).max(1);

const classEntry = z.object({
  /** Index in the model output vector. */
  index: z.number().int().min(0),
  /** `healthy`, a `disease` with a stable code, or `other` (e.g. "not a plant"): never shown as a disease. */
  kind: z.enum(['disease', 'healthy', 'other']),
  /** Stable `disease.code`. Required for `disease`, forbidden otherwise: an unmapped class is never invented into one. */
  disease_code: z.string().min(1).nullable(),
  labels: z.object({ vi: z.string().min(1).optional(), en: z.string().min(1).optional() }),
});

export const modelEntrySchema = z
  .object({
    model_id: z.string().min(1),
    version: z.string().min(1),
    pipeline_version: z.string().min(1),
    threshold_version: z.string().min(1),
    plant_part: z.string().min(1),
    part_labels: z.object({ vi: z.string().min(1), en: z.string().min(1) }),
    runtime: z.literal('onnx'),
    artifact: z.object({
      /** Key into the bundled model files (`src/ai/bundled.ts`). */
      path: z.string().min(1),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    input: z.object({
      name: z.string().min(1),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      layout: z.enum(['NCHW', 'NHWC']),
      color: z.enum(['RGB', 'BGR']),
      /** Pixel (0–255) × scale, then (x − mean) / std per channel in `color` order. */
      scale: z.number().positive(),
      mean: z.tuple([z.number(), z.number(), z.number()]),
      std: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
      resize: z.enum(['stretch', 'center_crop']),
    }),
    output: z.object({
      name: z.string().min(1),
      /** What the raw output is: logits, or already probabilities. */
      activation: z.enum(['softmax', 'sigmoid', 'none']),
    }),
    classes: z.array(classEntry).min(2),
    rules: z.object({
      /** A disease class needs at least this score to be called "suspected". */
      suspected_min: unit,
      healthy_min: unit,
      /** Optional: top-1 must beat top-2 by this much, else the answer is "inconclusive". */
      margin_min: unit.optional(),
    }),
  })
  .superRefine((e, ctx) => {
    const seen = new Set<number>();
    e.classes.forEach((c, i) => {
      if (seen.has(c.index)) {
        ctx.addIssue({ code: 'custom', path: ['classes', i, 'index'], message: 'duplicate index' });
      }
      seen.add(c.index);
      if (c.kind === 'disease' && !c.disease_code) {
        ctx.addIssue({
          code: 'custom',
          path: ['classes', i, 'disease_code'],
          message: 'a disease class needs a disease_code',
        });
      }
      if (c.kind !== 'disease' && c.disease_code) {
        ctx.addIssue({
          code: 'custom',
          path: ['classes', i, 'disease_code'],
          message: 'only a disease class has a disease_code',
        });
      }
    });
  });

export const manifestSchema = z.object({
  schema_version: z.literal(1),
  entries: z.array(z.unknown()),
});

export type ModelEntry = z.infer<typeof modelEntrySchema> & {
  /** Dev stub, never in a release build. */
  stub?: boolean;
};
export type ClassEntry = ModelEntry['classes'][number];

export interface RejectedEntry {
  model_id: string | null;
  plant_part: string | null;
  reason: string;
}

export interface ParsedManifest {
  entries: ModelEntry[];
  rejected: RejectedEntry[];
}

/**
 * Keeps the entries that are complete: valid shape, one per body part, and with the model file
 * present in the build (`hasArtifact`). A part that fails is dropped, not guessed at (FR-B02).
 */
export function parseManifest(
  raw: unknown,
  hasArtifact: (path: string) => boolean,
): ParsedManifest {
  const head = manifestSchema.safeParse(raw);
  if (!head.success) {
    return { entries: [], rejected: [{ model_id: null, plant_part: null, reason: 'manifest' }] };
  }
  const entries: ModelEntry[] = [];
  const rejected: RejectedEntry[] = [];
  for (const item of head.data.entries) {
    const meta = item as { model_id?: unknown; plant_part?: unknown };
    const ref = {
      model_id: typeof meta?.model_id === 'string' ? meta.model_id : null,
      plant_part: typeof meta?.plant_part === 'string' ? meta.plant_part : null,
    };
    const parsed = modelEntrySchema.safeParse(item);
    if (!parsed.success) {
      rejected.push({ ...ref, reason: parsed.error.issues[0]?.message ?? 'invalid' });
      continue;
    }
    const entry = parsed.data;
    if (!hasArtifact(entry.artifact.path)) {
      rejected.push({ ...ref, reason: 'artifact_missing' });
      continue;
    }
    if (entries.some((e) => e.plant_part === entry.plant_part)) {
      rejected.push({ ...ref, reason: 'duplicate_part' });
      continue;
    }
    entries.push(entry);
  }
  return { entries, rejected };
}
