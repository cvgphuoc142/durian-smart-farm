import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, StyleSheet, View } from 'react-native';

import { recognizedLabels, STUB_ENABLED } from '@/ai';
import { ModelUpdateBanners } from '@/components/domain/ModelUpdateBanner';
import {
  ChipSelect,
  EmptyState,
  Header,
  InfoBanner,
  Button,
  Screen,
  Text,
  useToast,
} from '@/components/ui';
import { useLocalScans, useRunContext, useScanModels } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { startScan } from '@/sync';
import { colors, radius, spacing } from '@/theme';

interface Picked {
  uri: string;
  width: number;
  height: number;
}

/**
 * SC-12: one photo from the camera or the library, the body part, then the model runs on the phone
 * (FR-B01…B03). Only parts with a complete pipeline in the manifest are offered. Works offline.
 */
export function Scan() {
  const { t, i18n } = useTranslation();
  const nav = useAppNavigation();
  const toast = useToast();
  const focused = useIsFocused();
  const ctx = useRunContext();
  const { entries } = useScanModels();
  const { scans } = useLocalScans();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [chosen, setPart] = useState<string | null>(null);
  // A single body part needs no choosing; entries change when a model is downloaded.
  const part =
    chosen && entries.some((e) => e.plant_part === chosen)
      ? chosen
      : entries.length === 1
        ? entries[0].plant_part
        : null;
  const [running, setRunning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const locale = i18n.language === 'en' ? 'en' : 'vi';
  const drafts = scans.filter((s) => s.state === 'draft' && s.outcome !== 'error').length;
  const stubbed = STUB_ENABLED && entries.some((e) => e.stub);

  const take = async () => {
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.9 });
      if (shot) setPicked({ uri: shot.uri, width: shot.width, height: shot.height });
    } catch {
      toast.show(t('scan.cameraError'), 'error');
    }
  };

  const pick = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
      });
      const asset = res.canceled ? null : res.assets[0];
      if (asset) setPicked({ uri: asset.uri, width: asset.width, height: asset.height });
    } catch {
      toast.show(t('scan.libraryDenied'), 'error');
    }
  };

  const run = async () => {
    if (!picked || !part || !ctx || running) return;
    setRunning(true);
    try {
      const draftId = await startScan(ctx, picked, part);
      nav.navigate('ScanResult', { draftId });
    } catch {
      // The photo could not be read or stored: nothing was kept.
      toast.show(t('scan.imageError'), 'error');
    } finally {
      setRunning(false);
    }
  };

  const noModel = entries.length === 0;
  const selected = entries.find((e) => e.plant_part === part) ?? null;

  return (
    <Screen
      header={
        <Header
          title={t('screens.Scan')}
          variant="back"
          onBack={() => nav.goBack()}
          right={
            <Button
              size="md"
              variant="outline"
              icon="bug"
              label={t('cases.entry')}
              accessibilityLabel={t('scan.history')}
              onPress={() => nav.navigate('Cases')}
              style={{ paddingHorizontal: spacing.md }}
            />
          }
        />
      }
      footer={
        noModel ? undefined : (
          <View style={{ gap: spacing.xs }}>
            {!picked || !part ? (
              <Text variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
                {t('scan.needInput')}
              </Text>
            ) : null}
            <Button
              label={running ? t('scan.running') : t('scan.run')}
              icon="scan"
              loading={running}
              disabled={!picked || !part}
              onPress={run}
            />
          </View>
        )
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-Scan" style={{ gap: spacing.lg }}>
        <ModelUpdateBanners />
        {stubbed ? <InfoBanner tone="warning" text={t('scan.stub')} /> : null}
        {drafts > 0 ? <InfoBanner tone="info" text={t('scan.drafts', { count: drafts })} /> : null}
        {drafts > 0 ? (
          <Button
            variant="outline"
            size="md"
            label={t('scan.openDrafts')}
            onPress={() => nav.navigate('ScanSync')}
          />
        ) : null}

        {noModel ? (
          <EmptyState
            icon="scan"
            title={t('scan.noModelTitle')}
            body={t('scan.noModelBody')}
            actionLabel={t('scan.getModels')}
            onAction={() => nav.navigate('Models')}
          />
        ) : (
          <>
            <View style={styles.frame}>
              {picked ? (
                <Image
                  source={{ uri: picked.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessibilityLabel={t('scan.photoPicked')}
                  accessibilityIgnoresInvertColors
                />
              ) : permission?.granted ? (
                focused ? (
                  <CameraView
                    ref={camera}
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    onCameraReady={() => setCameraReady(true)}
                  />
                ) : null
              ) : (
                <View style={styles.permission}>
                  <Text variant="bodyStrong" style={{ textAlign: 'center' }}>
                    {t('scan.permissionTitle')}
                  </Text>
                  <Text variant="secondary" color="textMuted" style={{ textAlign: 'center' }}>
                    {t('scan.permissionBody')}
                  </Text>
                  <Button
                    size="md"
                    label={
                      permission?.canAskAgain === false ? t('scan.openSettings') : t('scan.grant')
                    }
                    onPress={() =>
                      permission?.canAskAgain === false
                        ? void Linking.openSettings()
                        : void requestPermission()
                    }
                  />
                </View>
              )}
            </View>

            {picked ? (
              <Button
                variant="outline"
                size="md"
                icon="refresh"
                label={t('scan.changePhoto')}
                onPress={() => setPicked(null)}
              />
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  grow
                  size="md"
                  icon="camera"
                  label={t('scan.takePhoto')}
                  disabled={!permission?.granted || !cameraReady}
                  onPress={take}
                />
                <Button
                  grow
                  size="md"
                  variant="outline"
                  icon="image"
                  label={t('scan.pickLibrary')}
                  onPress={pick}
                />
              </View>
            )}

            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">{t('scan.part')}</Text>
              <ChipSelect
                options={entries.map((e) => ({
                  id: e.plant_part,
                  label: e.part_labels[locale],
                  caption: e.maturity === 'beta' ? t('models.beta') : undefined,
                }))}
                value={part}
                onChange={setPart}
              />
              {selected ? (
                <Text variant="secondary" color="textSoft">
                  {t('scan.recognizes', { labels: recognizedLabels(selected, locale).join(', ') })}
                </Text>
              ) : null}
              <Text variant="caption" color="textMuted">
                {t('scan.partHint')}
              </Text>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: {
    // Landscape preview keeps the buttons, the part and Analyse on one screen, even on a small phone.
    aspectRatio: 4 / 3,
    borderRadius: radius.hero,
    overflow: 'hidden',
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: {
    flex: 1,
    alignSelf: 'stretch',
    gap: spacing.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
});
