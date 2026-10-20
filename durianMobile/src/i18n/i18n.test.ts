import en from './en.json';
import vi from './vi.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? keys(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe('i18n', () => {
  it('Vietnamese and English have exactly the same keys', () => {
    const viKeys = new Set(keys(vi));
    const enKeys = new Set(keys(en));
    expect([...viKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !viKeys.has(k))).toEqual([]);
  });

  it('no value is empty', () => {
    for (const catalog of [vi, en]) {
      const empty = keys(catalog).filter((k) => {
        const value = k.split('.').reduce<any>((o, p) => o?.[p], catalog);
        return value === '' || (Array.isArray(value) && value.length === 0);
      });
      expect(empty).toEqual([]);
    }
  });

  it('the weekday row has seven entries in both languages', () => {
    expect(vi.common.weekdaysShort).toHaveLength(7);
    expect(en.common.weekdaysShort).toHaveLength(7);
  });
});
