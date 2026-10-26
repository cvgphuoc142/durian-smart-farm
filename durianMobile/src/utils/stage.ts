import type { Season } from '@/types';

/** The label shown for a season's stage: the farmer's own text for "other". */
export const stageLabel = (
  t: (key: string) => string,
  season: Pick<Season, 'stage' | 'stage_other'>,
) => (season.stage === 'other' && season.stage_other ? season.stage_other : t(`stages.${season.stage}`));
