import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { formatDate } from '@/utils';

import { BottomSheet } from './BottomSheet';
import { IconButton } from './IconButton';
import { Select } from './Select';
import { Text } from './Text';

export interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  title?: string;
  error?: boolean;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Date field with a month-grid bottom sheet (no native date-picker dependency). */
export function DatePicker({ value, onChange, placeholder, title, error }: DatePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const weekdayLabels = t('common.weekdaysShort', { returnObjects: true }) as unknown as string[];
  const [cursor, setCursor] = useState(() => value ?? new Date());

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from(
        { length: days },
        (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1),
      ),
    ];
  }, [cursor]);

  const shiftMonth = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  return (
    <>
      <Select
        icon="calendar"
        value={value ? formatDate(value) : undefined}
        placeholder={placeholder}
        error={error}
        onPress={() => {
          setCursor(value ?? new Date());
          setOpen(true);
        }}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title ?? placeholder}>
        <View style={styles.monthBar}>
          <IconButton
            icon="chevronLeft"
            size={44}
            variant="outline"
            accessibilityLabel="‹"
            onPress={() => shiftMonth(-1)}
          />
          <Text variant="heading">
            {t('common.monthYear', { month: cursor.getMonth() + 1, year: cursor.getFullYear() })}
          </Text>
          <IconButton
            icon="chevronRight"
            size={44}
            variant="outline"
            accessibilityLabel="›"
            onPress={() => shiftMonth(1)}
          />
        </View>
        <View style={styles.grid}>
          {weekdayLabels.map((w) => (
            <View key={w} style={styles.cell}>
              <Text variant="caption" color="textMuted">
                {w}
              </Text>
            </View>
          ))}
          {cells.map((d, i) => {
            if (!d) return <View key={`e${i}`} style={styles.cell} />;
            const selected = value != null && sameDay(d, value);
            const today = sameDay(d, new Date());
            return (
              <View key={d.toISOString()} style={styles.cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={formatDate(d)}
                  onPress={() => {
                    onChange(d);
                    setOpen(false);
                  }}
                  style={[
                    styles.day,
                    selected && styles.daySelected,
                    today && !selected && styles.dayToday,
                  ]}
                >
                  <Text variant="body" color={selected ? 'white' : 'text'}>
                    {d.getDate()}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  day: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1.5, borderColor: colors.primary },
});
