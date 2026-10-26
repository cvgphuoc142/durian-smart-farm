import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { z } from 'zod';

import { ApiRequestError, newId, upsert } from '@/api';
import {
  BottomSheet,
  Button,
  ControlledChipSelect,
  ControlledDatePicker,
  ControlledMoneyInput,
  ControlledTextInput,
  InfoBanner,
  Text,
} from '@/components/ui';
import { useWrite } from '@/hooks';
import { spacing } from '@/theme';
import { SEASON_STAGES, type Farm, type MutationRow, type Plot, type Season } from '@/types';
import { fromDateString, money, orNull, toDateString } from '@/utils';
import { optionalNumber, requiredText } from '@/utils/schema';

function Shell({
  title,
  onClose,
  conflict,
  children,
}: {
  title: string;
  onClose: () => void;
  conflict?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
        {conflict ? (
          <View style={{ marginBottom: spacing.md }}>
            <InfoBanner tone="warning" text={t('form.conflict')} />
          </View>
        ) : null}
        {children}
      </ScrollView>
    </BottomSheet>
  );
}

const rowOf = <T,>(rows: MutationRow[], entity: string, id: string) =>
  rows.find((r) => r.entity === entity && r.row.id === id)?.row as T | undefined;

/** Farm: name and province. */
export function FarmSheet({ farm, onClose }: { farm?: Farm; onClose: () => void }) {
  const { t } = useTranslation();
  const id = useRef(newId()).current;
  const schema = z.object({ name: requiredText(t), province: z.string().trim() });
  type V = z.infer<typeof schema>;
  const toForm = (f: Farm): V => ({ name: f.name, province: f.province ?? '' });
  const form = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: farm ? toForm(farm) : { name: '', province: '' },
  });
  const write = useWrite({
    onSuccess: onClose,
    onConflict: (rows) => {
      const row = rowOf<Farm>(rows, 'farm', farm?.id ?? id);
      if (row) form.reset(toForm(row));
    },
  });
  const conflicted = write.error instanceof ApiRequestError && write.error.isConflict;
  return (
    <Shell
      title={farm ? t('manage.editFarm') : t('manage.addFarm')}
      onClose={onClose}
      conflict={conflicted}
    >
      <ControlledTextInput
        control={form.control}
        name="name"
        label={t('manage.farmName')}
        required
      />
      <ControlledTextInput control={form.control} name="province" label={t('manage.province')} />
      <Button
        label={t('common.save')}
        loading={write.isPending}
        onPress={form.handleSubmit((v) => {
          const data = { name: v.name.trim(), province: orNull(v.province) };
          write.mutate([
            farm ? upsert('farm', farm.id, data, farm.revision) : upsert('farm', id, data, null),
          ]);
        })}
      />
    </Shell>
  );
}

/** Plot: name unique inside the farm (the server checks it too). */
export function PlotSheet({
  farmId,
  plot,
  onClose,
}: {
  farmId: string;
  plot?: Plot;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useRef(newId()).current;
  const schema = z.object({
    name: requiredText(t),
    variety: z.string().trim(),
    area: optionalNumber(t),
    trees: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d+$/.test(v), t('form.numberInvalid')),
  });
  type V = z.infer<typeof schema>;
  const toForm = (p: Plot): V => ({
    name: p.name,
    variety: p.variety ?? '',
    area: p.area_ha ?? '',
    trees: p.tree_count != null ? String(p.tree_count) : '',
  });
  const form = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: plot ? toForm(plot) : { name: '', variety: '', area: '', trees: '' },
  });
  const write = useWrite({
    onSuccess: onClose,
    onConflict: (rows) => {
      const row = rowOf<Plot>(rows, 'plot', plot?.id ?? id);
      if (row) form.reset(toForm(row));
    },
  });
  return (
    <Shell title={plot ? t('manage.editPlot') : t('manage.addPlot')} onClose={onClose}>
      <ControlledTextInput
        control={form.control}
        name="name"
        label={t('manage.plotName')}
        required
      />
      <ControlledTextInput control={form.control} name="variety" label={t('manage.variety')} />
      <ControlledTextInput
        control={form.control}
        name="area"
        label={t('manage.area')}
        keyboardType="decimal-pad"
        suffix="ha"
      />
      <ControlledTextInput
        control={form.control}
        name="trees"
        label={t('manage.trees')}
        keyboardType="number-pad"
      />
      <Button
        label={t('common.save')}
        loading={write.isPending}
        onPress={form.handleSubmit((v) => {
          const data = {
            name: v.name.trim(),
            variety: orNull(v.variety),
            area_ha: orNull(v.area),
            tree_count: v.trees === '' ? null : Number(v.trees),
          };
          write.mutate([
            plot
              ? upsert('plot', plot.id, data, plot.revision)
              : upsert('plot', id, { ...data, farm_id: farmId }, null),
          ]);
        })}
      />
    </Shell>
  );
}

/**
 * Season: name, dates, stage (changed by hand, FR-A04) and the three forecast numbers. A forecast
 * left empty stays `null`: "not entered" is not zero.
 */
export function SeasonSheet({
  plotId,
  season,
  onClose,
}: {
  plotId: string;
  season?: Season;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useRef(newId()).current;
  const schema = z.object({
    name: requiredText(t),
    startedOn: z.date(),
    stage: z.enum(SEASON_STAGES),
    stageOther: z.string().trim(),
    expectedHarvest: z.date().nullable(),
    yieldKg: optionalNumber(t),
    price: optionalNumber(t),
    cost: optionalNumber(t),
  });
  type V = z.infer<typeof schema>;
  const checked = schema.refine((v) => v.stage !== 'other' || v.stageOther !== '', {
    path: ['stageOther'],
    message: t('form.required'),
  });
  const toForm = (s: Season): V => ({
    name: s.name,
    startedOn: fromDateString(s.started_on),
    stage: s.stage,
    stageOther: s.stage_other ?? '',
    expectedHarvest: s.expected_harvest_on ? fromDateString(s.expected_harvest_on) : null,
    yieldKg: s.forecast_yield_kg ?? '',
    price: s.forecast_price_vnd_kg ?? '',
    cost: s.forecast_total_cost_vnd ?? '',
  });
  const form = useForm<V>({
    resolver: zodResolver(checked),
    defaultValues: season
      ? toForm(season)
      : {
          name: t('setup.defaultSeason', { year: new Date().getFullYear() }),
          startedOn: new Date(),
          stage: 'recovery',
          stageOther: '',
          expectedHarvest: null,
          yieldKg: '',
          price: '',
          cost: '',
        },
  });
  const stage = useWatch({ control: form.control, name: 'stage' });
  const write = useWrite({
    onSuccess: onClose,
    onConflict: (rows) => {
      const row = rowOf<Season>(rows, 'season', season?.id ?? id);
      if (row) form.reset(toForm(row));
    },
  });
  return (
    <Shell title={season ? t('manage.editSeason') : t('manage.addSeason')} onClose={onClose}>
      <ControlledTextInput
        control={form.control}
        name="name"
        label={t('manage.seasonName')}
        required
      />
      <ControlledDatePicker
        control={form.control}
        name="startedOn"
        label={t('manage.startedOn')}
        required
      />
      <ControlledChipSelect
        control={form.control}
        name="stage"
        label={t('manage.stage')}
        options={SEASON_STAGES.map((s) => ({ id: s, label: t(`stages.${s}`) }))}
      />
      {stage === 'other' ? (
        <ControlledTextInput
          control={form.control}
          name="stageOther"
          label={t('manage.stageOther')}
          required
        />
      ) : null}
      <ControlledDatePicker
        control={form.control}
        name="expectedHarvest"
        label={t('manage.expectedHarvest')}
        placeholder={t('overview.noForecast')}
      />
      <Text variant="cardTitle" style={{ marginBottom: spacing.sm }}>
        {t('overview.forecast')}
      </Text>
      <ControlledTextInput
        control={form.control}
        name="yieldKg"
        label={t('overview.forecastYield')}
        keyboardType="decimal-pad"
        suffix="kg"
      />
      <ControlledMoneyInput
        control={form.control}
        name="price"
        label={t('overview.forecastPrice')}
        suffix="₫/kg"
      />
      <ControlledMoneyInput
        control={form.control}
        name="cost"
        label={t('overview.forecastCost')}
      />
      <Button
        label={t('common.save')}
        loading={write.isPending}
        onPress={form.handleSubmit((v) => {
          const data = {
            name: v.name.trim(),
            started_on: toDateString(v.startedOn),
            stage: v.stage,
            stage_other: v.stage === 'other' ? v.stageOther.trim() : null,
            expected_harvest_on: v.expectedHarvest ? toDateString(v.expectedHarvest) : null,
            forecast_yield_kg: money.normalizeKg(v.yieldKg),
            forecast_price_vnd_kg: money.normalizeVnd(v.price),
            forecast_total_cost_vnd: money.normalizeVnd(v.cost),
          };
          const changed =
            !season ||
            data.forecast_yield_kg !== season.forecast_yield_kg ||
            data.forecast_price_vnd_kg !== season.forecast_price_vnd_kg ||
            data.forecast_total_cost_vnd !== season.forecast_total_cost_vnd;
          const withStamp = changed
            ? { ...data, forecast_updated_at: new Date().toISOString() }
            : data;
          write.mutate([
            season
              ? upsert('season', season.id, withStamp, season.revision)
              : upsert('season', id, { ...withStamp, plot_id: plotId }, null),
          ]);
        })}
      />
    </Shell>
  );
}
