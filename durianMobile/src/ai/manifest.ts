import { z } from 'zod';

/**
 * The model manifest the server publishes (`GET /v1/models/manifest`, FR-B03). One entry per body
 * part. Everything the scan screens show or do comes from here: the body parts, the labels, whether
 * a healthy result is possible, whether the model is still beta. The same schema reads the entries
 * kept on the phone.
 *
 * Keep in step with `durianBackend/app/scan_models/schema.py`.
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
      /** File name; the download link comes from `GET /v1/models/{id}/{version}/download`. */
      path: z.string().min(1),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      size_bytes: z.number().int().positive(),
    }),
    /** Vietnamese text shown when this version is offered, e.g. "Thêm 2 nhãn bệnh mới". */
    release_notes: z.string().min(1),
    /** `beta`: the screens say the model is still being improved. */
    maturity: z.enum(['stable', 'beta']),
    /** True only when a class has kind `healthy`; "Khỏe" is never shown otherwise. */
    supports_healthy: z.boolean(),
    /** Vietnamese note about this model's limits, shown under its results. */
    limitations: z.string().min(1).nullish(),
    /** An app older than this ignores the entry and asks the user to update the app. */
    min_app_version: z
      .string()
      .regex(/^\d+(\.\d+){0,2}$/)
      .nullish(),
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
      resize: z.enum(['stretch', 'center_crop', 'letterbox']),
      /** `letterbox` only: RGB (0–255) of the padding around the image. */
      pad: z.tuple([z.number(), z.number(), z.number()]).optional(),
    }),
    output: z.object({
      name: z.string().min(1),
      /** What the raw output is: logits, or already probabilities. */
      activation: z.enum(['softmax', 'sigmoid', 'none', 'temperature_softmax']),
      /** `temperature_softmax` only: softmax(logits / T). */
      temperature: z.number().positive().optional(),
    }),
    classes: z.array(classEntry).min(2),
    rules: z.object({
      /** A disease class needs at least this score to be called "suspected". */
      suspected_min: unit,
      healthy_min: unit,
      /** Optional: top-1 must beat top-2 by this much, else the answer is "inconclusive". */
      margin_min: unit.optional(),
      /** Optional: energy -T·log Σ exp(z/T) above this means the photo is out of distribution. */
      energy_max: z.number().optional(),
    }),
  })
  .superRefine((e, ctx) => {
    if (e.input.resize === 'letterbox' && !e.input.pad) {
      ctx.addIssue({ code: 'custom', path: ['input', 'pad'], message: 'letterbox needs a pad' });
    }
    if (e.output.activation === 'temperature_softmax' && !e.output.temperature) {
      ctx.addIssue({
        code: 'custom',
        path: ['output', 'temperature'],
        message: 'temperature_softmax needs a temperature',
      });
    }
    if (e.supports_healthy !== e.classes.some((c) => c.kind === 'healthy')) {
      ctx.addIssue({
        code: 'custom',
        path: ['supports_healthy'],
        message: 'supports_healthy must match the classes',
      });
    }
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

/** Newest manifest layout this build reads. A newer one needs a newer app. */
export const SUPPORTED_MANIFEST_SCHEMA = 1;

export const manifestSchema = z.object({
  schema_version: z.literal(SUPPORTED_MANIFEST_SCHEMA),
  /** Changes whenever anything in `entries` changes; `null` for a list kept on the phone. */
  revision: z.string().optional(),
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

/** `1.2.3` against `1.10`: numbers, missing parts are 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

/** True when this app is older than the entry asks for. */
export const appTooOld = (entry: ModelEntry, appVersion: string) =>
  entry.min_app_version != null && compareVersions(appVersion, entry.min_app_version) < 0;

/**
 * Keeps the entries that are complete: valid shape and one per body part. A part that fails is
 * dropped, not guessed at (FR-B02). `accept` may veto a valid entry with a reason.
 */
export function parseManifest(
  raw: unknown,
  accept: (entry: ModelEntry) => string | null = () => null,
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
    const veto = accept(entry);
    if (veto) {
      rejected.push({ ...ref, reason: veto });
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
