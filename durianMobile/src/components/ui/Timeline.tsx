import { StyleSheet, View } from 'react-native';

import { colors, tones, type Tone } from '@/theme';

import { Badge } from './Badge';
import { Text } from './Text';

export interface TimelineItem {
  id: string;
  date: string;
  title: string;
  detail?: string;
  /** Short type pill, e.g. "Bệnh", "Bón phân". */
  type?: string;
  tone?: Tone;
  /** Hollow dot for steps that have not happened yet. */
  pending?: boolean;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <View>
      {items.map((item, i) => {
        const tone = tones[item.tone ?? 'primary'];
        const last = i === items.length - 1;
        return (
          <View key={item.id} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  item.pending
                    ? { borderColor: tone.dot, backgroundColor: colors.surface }
                    : { borderColor: tone.dot, backgroundColor: tone.dot },
                ]}
              />
              {last ? null : <View style={styles.line} />}
            </View>
            <View style={[styles.body, last && styles.bodyLast]}>
              <View style={styles.meta}>
                <Text variant="caption" color="textMuted">
                  {item.date}
                </Text>
                {item.type ? <Badge label={item.type} tone={item.tone ?? 'primary'} /> : null}
              </View>
              <Text variant="bodyStrong">{item.title}</Text>
              {item.detail ? (
                <Text variant="secondary" color="textMuted">
                  {item.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, marginTop: 3 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, gap: 2, paddingBottom: 16 },
  bodyLast: { paddingBottom: 0 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
