import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions (delete, discard). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel={t('common.cancel')}
        >
          <View style={styles.backdrop} />
        </Pressable>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {message ? (
            <Text variant="body" color="textMuted">
              {message}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              label={cancelLabel ?? t('common.cancel')}
              variant="outline"
              grow
              onPress={onCancel}
            />
            <Button
              label={confirmLabel ?? t('common.confirm')}
              variant={destructive ? 'danger' : 'primary'}
              grow
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: spacing.xxl },
  backdrop: { flex: 1, backgroundColor: 'rgba(23,36,28,0.5)' },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    gap: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
