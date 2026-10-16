import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, Chip, ListGroup, ListRow, ProgressBar } from '@/components/ui';
import i18n from '@/i18n';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const wrap = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

describe('ui kit', () => {
  beforeAll(() => i18n.changeLanguage('vi'));

  it('Button fires onPress and blocks it while loading', () => {
    const onPress = jest.fn();
    const { rerender } = wrap(<Button label="Lưu" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <Button label="Lưu" onPress={onPress} loading />
      </SafeAreaProvider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Chip exposes its selected state', () => {
    wrap(<Chip label="Tốt" selected />);
    expect(screen.getByRole('button', { name: /Tốt/ })).toBeSelected();
  });

  it('ProgressBar clamps the ratio', () => {
    wrap(<ProgressBar ratio={1.4} />);
    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityValue', {
      min: 0,
      max: 100,
      now: 100,
    });
  });

  it('ListGroup renders every row', () => {
    wrap(
      <ListGroup>
        <ListRow title="Lô A" />
        <ListRow title="Lô B" />
      </ListGroup>,
    );
    expect(screen.getByText('Lô A')).toBeTruthy();
    expect(screen.getByText('Lô B')).toBeTruthy();
  });
});
