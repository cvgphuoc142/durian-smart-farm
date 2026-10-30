import { matchLevel } from './ScanResultCard';

describe('matchLevel', () => {
  it('words the score instead of showing a percentage', () => {
    expect(matchLevel(0.93)).toBe('matchHigh');
    expect(matchLevel(0.8)).toBe('matchHigh');
    expect(matchLevel(0.79)).toBe('matchMid');
    expect(matchLevel(0.6)).toBe('matchMid');
    expect(matchLevel(0.59)).toBe('matchLow');
  });
});
