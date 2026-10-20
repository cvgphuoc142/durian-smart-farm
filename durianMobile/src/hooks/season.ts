import { useMemo } from 'react';

import { money } from '@/utils';

import { live, useSelection, useSnapshot } from './snapshot';

/**
 * Everything the money and journal screens need for the selected season: the live rows, and the
 * totals worked out from exactly those rows (the backend stays authoritative after sync).
 */
export function useSeasonData() {
  const { data } = useSnapshot();
  const { farm, plot, season } = useSelection();
  const seasonId = season?.id ?? null;

  return useMemo(() => {
    const inSeason = <T extends { season_id: string }>(rows: T[]) =>
      rows.filter((r) => r.season_id === seasonId);
    const expenses = inSeason(live(data.expenses));
    const sales = inSeason(live(data.sales));
    const saleIds = new Set(sales.map((s) => s.id));
    const payments = live(data.sale_payments).filter((p) => saleIds.has(p.sale_id));
    const careLogs = inSeason(live(data.care_logs));
    const cases = inSeason(live(data.disease_cases));
    return {
      farm,
      plot,
      season,
      expenses,
      sales,
      payments,
      careLogs,
      cases,
      summary: money.seasonSummary({ expenses, sales, payments }),
      forecast: season ? money.seasonForecast(season) : null,
    };
  }, [data, farm, plot, season, seasonId]);
}
