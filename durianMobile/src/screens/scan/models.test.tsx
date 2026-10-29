import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';

import { refreshModels, useModelStore, useModelTransfer } from '@/ai';
import { modelFiles } from '@/ai/modelFiles';
import { db } from '@/api';
import { useScanEntry, useScanModels } from '@/hooks';
import i18n from '@/i18n';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore, useContextStore } from '@/stores';
import { entry, makeDraft, seedSeason } from '@/test/scanFixtures';
import { renderWithProviders, resetApp, TEST_USER } from '@/test/utils';

let mockOnline = true;
jest.mock('@/hooks/useIsOnline', () => ({ useIsOnline: () => mockOnline }));

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: React.forwardRef(function CameraView() {
      return React.createElement(View, { testID: 'camera' });
    }),
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn(), jest.fn()],
  };
});
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
const USER = 'mock-user';

const leaf = entry({
  model_id: 'durianos_leaf',
  version: 'v1',
  release_notes: 'Thêm 2 nhãn bệnh mới',
  maturity: 'beta',
  supports_healthy: false,
  limitations: 'Chưa nhận ra lá khỏe',
  artifact: { path: 'leaf.onnx', sha256: 'a'.repeat(64), size_bytes: 28_000_000 },
  classes: [
    {
      index: 0,
      kind: 'disease',
      disease_code: 'leaf__anthracnose',
      labels: { vi: 'Bệnh thán thư' },
    },
    { index: 1, kind: 'disease', disease_code: 'leaf__canker', labels: { vi: 'Bệnh loét' } },
  ],
});

beforeAll(async () => {
  await i18n.changeLanguage('vi');
});

beforeEach(() => {
  mockOnline = true;
  resetApp();
  useAuthStore.setState({ user: { ...TEST_USER, id: USER } });
  // The disk "has" the downloaded file with the right size and hash.
  jest.spyOn(modelFiles, 'sizeOf').mockReturnValue(leaf.artifact.size_bytes);
  jest.spyOn(modelFiles, 'sha256').mockResolvedValue(leaf.artifact.sha256);
});
afterEach(() => jest.restoreAllMocks());

async function start() {
  await seedSeason();
  useContextStore.getState().select({ farmId: 'f1', plotId: 'p1', seasonId: 's1' });
  renderWithProviders(<RootNavigator />);
  await screen.findByTestId('screen-SeasonOverview');
}
const openScan = async () => {
  fireEvent.press(screen.getAllByLabelText(new RegExp(`^${t('tabs.scan')}`))[0]);
  await screen.findByTestId('screen-Scan');
};

describe('a new model is announced, then downloaded when the farmer taps', () => {
  it('shows a red dot on the Scan tab and the banner with notes and size, and downloads on tap', async () => {
    db.models = [leaf];
    expect(await refreshModels('1.0.0')).toBe('update_available');
    await start();

    expect(screen.getByTestId('scan-new-model-dot')).toBeTruthy();
    await openScan();
    expect(screen.getByText(t('models.newFor', { part: 'Lá' }))).toBeTruthy();
    expect(screen.getByText('Thêm 2 nhãn bệnh mới (28MB)')).toBeTruthy();
    // Nothing was downloaded by itself.
    expect(useModelStore.getState().installed).toEqual({});

    fireEvent.press(screen.getByText(t('models.download')));
    await waitFor(() => expect(useModelStore.getState().installed.leaf).toBeTruthy());
    await waitFor(() => expect(screen.queryByText(t('models.newFor', { part: 'Lá' }))).toBeNull());

    // The scan screen now follows the manifest: the part, its beta mark and its labels.
    expect(screen.getByText('Lá')).toBeTruthy();
    expect(screen.getAllByText(t('models.beta')).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByText('Lá'));
    expect(
      screen.getByText(t('scan.recognizes', { labels: 'Bệnh thán thư, Bệnh loét' })),
    ).toBeTruthy();
    expect(screen.queryByTestId('scan-new-model-dot')).toBeNull();
  });

  it('on mobile data it asks first and downloads only after the second tap', async () => {
    const cellular = jest.spyOn(require('@/ai/modelFiles'), 'isOnCellular').mockResolvedValue(true);
    db.models = [leaf];
    await refreshModels('1.0.0');
    await start();
    await openScan();

    fireEvent.press(screen.getByText(t('models.download')));
    await screen.findByText(t('models.cellularTitle'));
    expect(screen.getByText(t('models.cellularBody', { size: '28MB' }))).toBeTruthy();
    expect(useModelStore.getState().installed).toEqual({});

    fireEvent.press(screen.getAllByText(t('models.download')).at(-1)!);
    await waitFor(() => expect(useModelStore.getState().installed.leaf).toBeTruthy());
    expect(cellular).toHaveBeenCalled();
  });

  it('a failed download says why and can be retried; the dot stays', async () => {
    jest.spyOn(modelFiles, 'sha256').mockResolvedValue('f'.repeat(64));
    db.models = [leaf];
    await refreshModels('1.0.0');
    await start();
    await openScan();
    fireEvent.press(screen.getByText(t('models.download')));
    await screen.findByText(t('models.errors.hash_mismatch'));
    expect(screen.getByText(t('models.retry'))).toBeTruthy();
    expect(useModelStore.getState().installed).toEqual({});
    expect(useModelTransfer.getState().errors.leaf).toBe('hash_mismatch');
  });
});

describe('the screens follow what is installed', () => {
  it('lists only installed parts, and the result knows beta and limits of the model that made it', async () => {
    useModelStore.getState().install({ entry: leaf, file: 'm.onnx', installed_at: '' });
    const models = renderHook(() => useScanModels());
    expect(models.result.current.entries.map((e) => e.plant_part)).toContain('leaf');
    const hit = renderHook(() =>
      useScanEntry('leaf', { model_id: 'durianos_leaf', model_version: 'v1' } as never),
    );
    expect(hit.result.current).toMatchObject({
      maturity: 'beta',
      limitations: 'Chưa nhận ra lá khỏe',
    });
    expect(renderHook(() => useScanEntry('stem', null)).result.current).toBeNull();
  });

  it('the result screen shows the beta mark and the limits of the model', async () => {
    useModelStore.getState().install({ entry: leaf, file: 'm.onnx', installed_at: '' });
    await start();
    await makeDraft({
      plant_part: 'leaf',
      inference: {
        model_id: 'durianos_leaf',
        model_version: 'v1',
        pipeline_version: 'p',
        threshold_version: 't',
        inference_ms: 1,
      },
    });
    fireEvent.press(screen.getAllByLabelText(t('tabs.journal'))[0]);
    await screen.findByTestId('screen-CareLogs');
    fireEvent.press(screen.getAllByLabelText(t('screens.Cases')).at(-1)!);
    await screen.findByTestId('screen-Cases');
    fireEvent.press(screen.getAllByLabelText(t('cases.syncStatus')).at(-1)!);
    await screen.findByText(t('scanSync.drafts'));
    fireEvent.press(screen.getAllByText(t('scanSync.continue')).at(-1)!);
    await screen.findByTestId('screen-ScanResult');
    expect(screen.getByText(t('models.beta'))).toBeTruthy();
    expect(screen.getByText('Chưa nhận ra lá khỏe')).toBeTruthy();
  });
});

async function openSettings() {
  fireEvent.press(screen.getAllByLabelText(t('tabs.more'))[0]);
  await screen.findByText(t('more.settings'));
  fireEvent.press(screen.getAllByText(t('more.settings')).at(-1)!);
  await screen.findByTestId('screen-Settings');
}

describe('Settings', () => {
  it('shows the model section and checks on tap', async () => {
    db.models = [leaf];
    await start();
    await openSettings();
    expect(screen.getByText(t('settings.modelsNone'))).toBeTruthy();
    fireEvent.press(screen.getAllByText(t('models.check')).at(-1)!);
    await screen.findByText(t('settings.modelsNew', { count: 1 }));
    expect(screen.getByText(t('models.newFor', { part: 'Lá' }))).toBeTruthy();
  });

  it('the model screen is reachable from Settings and says so when there is nothing', async () => {
    await start();
    await openSettings();
    fireEvent.press(screen.getByText(t('settings.modelsManage')));
    await screen.findByTestId('screen-Models');
    expect(screen.getByText(t('models.noneTitle'))).toBeTruthy();
  });

  it('the model screen downloads, shows what is installed and goes back to the previous version', async () => {
    const older = {
      ...leaf,
      version: 'v0',
      artifact: { ...leaf.artifact, sha256: 'b'.repeat(64) },
    };
    useModelStore.getState().install({ entry: older, file: 'old.onnx', installed_at: '' });
    useModelStore.getState().install({ entry: leaf, file: 'new.onnx', installed_at: '' });
    await start();
    await openSettings();
    fireEvent.press(screen.getByText(t('settings.modelsManage')));
    await screen.findByTestId('screen-Models');
    expect(screen.getByText(t('models.versionLine', { version: 'v1', size: '28MB' }))).toBeTruthy();
    expect(
      screen.getByText(t('scan.recognizes', { labels: 'Bệnh thán thư, Bệnh loét' })),
    ).toBeTruthy();
    fireEvent.press(screen.getByText(t('models.rollbackTo', { version: 'v0' })));
    fireEvent.press(screen.getAllByText(t('models.rollback')).at(-1)!);
    await waitFor(() =>
      expect(useModelStore.getState().installed.leaf.current.entry.version).toBe('v0'),
    );
  });
});
