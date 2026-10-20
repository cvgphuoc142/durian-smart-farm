import type { DateString, Entity, Kg, Timestamp, Vnd } from './common';

export interface Farm extends Entity {
  name: string;
  province: string | null;
  locality_text: string | null;
}

export interface Plot extends Entity {
  farm_id: string;
  /** Unique among the live plots of the farm. */
  name: string;
  variety: string | null;
  area_ha: string | null;
  tree_count: number | null;
  planted_year: number | null;
}

export const SEASON_STAGES = [
  'recovery',
  'flower_induction',
  'flowering_fruit_set',
  'fruit_growth',
  'harvest',
] as const;
export type SeasonStage = (typeof SEASON_STAGES)[number];

export interface Season extends Entity {
  plot_id: string;
  name: string;
  started_on: DateString;
  stage: SeasonStage;
  expected_harvest_on: DateString | null;
  /** Set when the farmer closes the season. At most one season per plot has this `null`. */
  closed_on: DateString | null;
  /** The three forecast inputs. `null` = not entered, which is not the same as 0. */
  forecast_yield_kg: Kg | null;
  forecast_price_vnd_kg: Vnd | null;
  forecast_total_cost_vnd: Vnd | null;
  forecast_updated_at: Timestamp | null;
}

export const CARE_KINDS = [
  'watering',
  'fertilizing',
  'spraying',
  'pruning',
  'inspection',
  'treatment',
  'other',
] as const;
export type CareKind = (typeof CARE_KINDS)[number];

/** Fertilizing and spraying must list at least one input with a product name. */
export const CARE_KINDS_WITH_INPUTS: readonly CareKind[] = ['fertilizing', 'spraying'];

export interface CareInput {
  id: string;
  product_name: string;
  amount: string | null;
  unit: string | null;
  active_ingredient: string | null;
}

export interface CareLog extends Entity {
  season_id: string;
  case_id: string | null;
  photo_id: string | null;
  occurred_on: DateString;
  kind: CareKind;
  note: string | null;
  inputs: CareInput[];
}
