/**
 * Lower-case text without diacritics, `đ` as `d`: "Xì mủ" and "xi mu" are the same word (FR-C01).
 * Used for the search index and for the query, so both sides fold the same way.
 */
export function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** Words of a search box after folding. Anything that is not a letter or digit separates words. */
export function searchTokens(text: string): string[] {
  return fold(text).match(/[a-z0-9]+/g) ?? [];
}
