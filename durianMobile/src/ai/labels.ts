import type { Locale } from '@/types';

import type { ModelEntry } from './manifest';

/**
 * What the model can name, in the UI language, straight from the manifest ("Mô hình nhận diện: …").
 * Classes of kind `other` ("not a plant") are never listed. A class without a label in either
 * language shows its disease code rather than being hidden.
 */
export function recognizedLabels(entry: ModelEntry, locale: Locale): string[] {
  const order: Locale[] = locale === 'vi' ? ['vi', 'en'] : ['en', 'vi'];
  return entry.classes
    .filter((c) => c.kind !== 'other')
    .map((c) => order.map((l) => c.labels[l]).find(Boolean) ?? c.disease_code ?? '')
    .filter(Boolean);
}
