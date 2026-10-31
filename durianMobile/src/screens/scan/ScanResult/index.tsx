import { useRoute, type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { STUB_MODEL_ID } from '@/ai';
import { CallExpertButton, ScanPhoto, ScanResultCard } from '@/components/domain';
import {
  Badge,
  Button,
  EmptyState,
  Header,
  InfoBanner,
  KeyValueGrid,
  ListRow,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import {
  useLocalScan,
  usePartLabel,
  useRelatedArticles,
  useRunContext,
  useScanEntry,
} from '@/hooks';
import type { RootStackParamList } from '@/navigation/types';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { discardScan, rerunDraft } from '@/sync';
import { spacing } from '@/theme';

/**
 * SC-13: the answer of the model, in one of four states (FR-B04). It is a suspicion with the
 * model's own score, never a sure diagnosis, and it has no link to a product or a shop.
 */
export function ScanResult() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const { draftId } = useRoute<RouteProp<RootStackParamList, 'ScanResult'>>().params;
  const scan = useLocalScan(draftId);
  const ctx = useRunContext();
  const part = usePartLabel();
  const related = useRelatedArticles(scan?.disease_code ?? null, scan?.plant_part ?? '');
  const model = useScanEntry(scan?.plant_part, scan?.inference);
  const [busy, setBusy] = useState(false);

  const header = (
    <Header title={t('screens.ScanResult')} variant="back" onBack={() => nav.goBack()} />
  );

  if (scan === undefined) {
    return (
      <Screen header={header} contentStyle={{ paddingHorizontal: spacing.gutter }}>
        <Skeleton height={260} radius={20} />
      </Screen>
    );
  }
  if (scan === null) {
    return (
      <Screen header={header}>
        <View testID="screen-ScanResult">
          <EmptyState
            icon="scan"
            title={t('result.gone')}
            actionLabel={t('common.back')}
            onAction={() => nav.goBack()}
          />
        </View>
      </Screen>
    );
  }

  const saved = scan.state !== 'draft';
  const failed = scan.outcome === 'error';
  const stub = scan.inference?.model_id === STUB_MODEL_ID;

  const retry = async () => {
    if (!ctx || busy) return;
    setBusy(true);
    try {
      await rerunDraft(ctx, scan.id);
    } finally {
      setBusy(false);
    }
  };
  const another = async () => {
    await discardScan(scan.user_id, scan.id);
    nav.goBack();
  };

  return (
    <Screen
      header={header}
      footer={
        saved ? undefined : (
          <View style={{ gap: spacing.sm }}>
            {failed ? (
              <Button label={t('result.retry')} icon="refresh" loading={busy} onPress={retry} />
            ) : (
              <Button
                label={t('result.save')}
                icon="check"
                onPress={() => nav.navigate('SaveScan', { draftId: scan.id })}
              />
            )}
            <Button variant="outline" label={t('result.otherPhoto')} onPress={another} />
          </View>
        )
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-ScanResult" style={{ gap: spacing.lg }}>
        {stub ? <InfoBanner tone="warning" text={t('scan.stub')} /> : null}
        {saved ? <InfoBanner tone="info" text={t('result.alreadySaved')} /> : null}
        <ScanPhoto uri={scan.photo_uri} size={300} accessibilityLabel={t('screens.ScanResult')} />
        <ScanResultCard
          state={scan.outcome}
          label={scan.label_snapshot}
          predictions={scan.predictions}
          errorCode={scan.error_code}
        />
        <KeyValueGrid items={[{ label: t('result.part'), value: part(scan.plant_part) }]} />
        {model?.maturity === 'beta' ? <Badge label={t('models.beta')} tone="warning" /> : null}
        {model?.limitations ? <InfoBanner tone="warning" text={model.limitations} /> : null}
        {scan.inference ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('result.model', {
                id: scan.inference.model_id,
                version: scan.inference.model_version,
              })}
            </Text>
            {stub ? <Badge label={t('result.stub')} tone="warning" /> : null}
          </View>
        ) : null}

        {failed ? null : (
          <View style={{ gap: spacing.sm }}>
            <Text variant="heading" accessibilityRole="header">
              {t('result.relatedTitle')}
            </Text>
            {related.length === 0 ? (
              <Text variant="secondary" color="textMuted">
                {t('result.noRelated')}
              </Text>
            ) : (
              related.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.title}
                  leading={{ type: 'tile', icon: 'book', tone: 'info' }}
                  chevron
                  onPress={() => nav.navigate('Article', { articleId: a.id })}
                />
              ))
            )}
          </View>
        )}

        {scan.outcome === 'suspected' ? <CallExpertButton /> : null}

        <Button
          variant="outline"
          icon="chat"
          label={t('result.askAssistant')}
          onPress={() =>
            nav.navigate('Chatbot', {
              // A case made with this scan exists on the server only once the scan is synced.
              caseId: (scan.meta_done ? scan.new_case?.id : undefined) ?? scan.case_id ?? undefined,
              prefill: t(scan.label_snapshot ? 'result.askPrefill' : 'result.askPrefillNoLabel', {
                label: scan.label_snapshot,
              }),
            })
          }
        />

        <InfoBanner tone="info" text={t('result.disclaimer')} />
      </View>
    </Screen>
  );
}
