import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { newId, upsert } from '@/api';
import { FormScreen } from '@/components/domain';
import {
  ControlledChipSelect,
  ControlledDatePicker,
  ControlledTextInput,
  Text,
} from '@/components/ui';
import { useFormDraft, useWrite } from '@/hooks';
import { useUnsavedChangesGuard } from '@/navigation/useUnsavedChangesGuard';
import { draftKey, useContextStore } from '@/stores';
import { spacing } from '@/theme';
import { SEASON_STAGES } from '@/types';
import { orNull, toDateString } from '@/utils';
import { optionalNumber, requiredText } from '@/utils/schema';

const KEY = draftKey('farmSetup');

/**
 * SC-02: the minimum to start: one farm, one plot, one season, saved together in one mutation.
 * More plots and seasons are added later from SC-04.
 */
export function CreateFarm() {
  const { t } = useTranslation();
  const ids = useRef({ farm: newId(), plot: newId(), season: newId() }).current;

  const schema = z.object({
    farmName: requiredText(t),
    province: z.string().trim(),
    plotName: requiredText(t),
    variety: z.string().trim(),
    areaHa: optionalNumber(t),
    seasonName: requiredText(t),
    startedOn: z.date(),
    stage: z.enum(SEASON_STAGES),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      farmName: '',
      province: '',
      plotName: '',
      variety: '',
      areaHa: '',
      seasonName: t('setup.defaultSeason', { year: new Date().getFullYear() }),
      startedOn: new Date(),
      stage: 'recovery',
    },
  });
  const draft = useFormDraft(KEY, form);
  useUnsavedChangesGuard(form.formState.isDirty);

  const write = useWrite({
    onSuccess: () => {
      draft.clear();
      // The gate reads this and moves to the tabs.
      useContextStore
        .getState()
        .select({ farmId: ids.farm, plotId: ids.plot, seasonId: ids.season });
    },
  });

  const submit = form.handleSubmit((v) =>
    write.mutate([
      upsert('farm', ids.farm, { name: v.farmName.trim(), province: orNull(v.province) }, null),
      upsert(
        'plot',
        ids.plot,
        {
          farm_id: ids.farm,
          name: v.plotName.trim(),
          variety: orNull(v.variety),
          area_ha: orNull(v.areaHa),
        },
        null,
      ),
      upsert(
        'season',
        ids.season,
        {
          plot_id: ids.plot,
          name: v.seasonName.trim(),
          started_on: toDateString(v.startedOn),
          stage: v.stage,
        },
        null,
      ),
    ]),
  );

  const stageOptions = SEASON_STAGES.map((id) => ({ id, label: t(`stages.${id}`) }));
  const { control } = form;

  return (
    <FormScreen
      name="CreateFarm"
      title={t('screens.CreateFarm')}
      saveLabel={t('setup.start')}
      saving={write.isPending}
      onSave={submit}
    >
      <Text variant="secondary" color="textMuted" style={{ marginBottom: spacing.lg }}>
        {t('setup.intro')}
      </Text>

      <Text variant="cardTitle" style={{ marginBottom: spacing.sm }}>
        {t('setup.farm')}
      </Text>
      <ControlledTextInput
        control={control}
        name="farmName"
        label={t('manage.farmName')}
        required
      />
      <ControlledTextInput control={control} name="province" label={t('manage.province')} />

      <Text variant="cardTitle" style={{ marginBottom: spacing.sm }}>
        {t('setup.plot')}
      </Text>
      <ControlledTextInput
        control={control}
        name="plotName"
        label={t('manage.plotName')}
        required
      />
      <ControlledTextInput control={control} name="variety" label={t('manage.variety')} />
      <ControlledTextInput
        control={control}
        name="areaHa"
        label={t('manage.area')}
        keyboardType="decimal-pad"
        suffix="ha"
      />

      <Text variant="cardTitle" style={{ marginBottom: spacing.sm }}>
        {t('setup.season')}
      </Text>
      <ControlledTextInput
        control={control}
        name="seasonName"
        label={t('manage.seasonName')}
        required
      />
      <ControlledDatePicker
        control={control}
        name="startedOn"
        label={t('manage.startedOn')}
        required
      />
      <ControlledChipSelect
        control={control}
        name="stage"
        label={t('manage.stage')}
        options={stageOptions}
      />
      <View style={{ height: spacing.md }} />
    </FormScreen>
  );
}
