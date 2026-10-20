import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

/** Asks for confirmation before leaving a dirty form (header back, swipe, Android back). */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const navigation = useNavigation();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isDirty) return;
    return navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      Alert.alert(t('common.unsavedTitle'), t('common.unsavedMessage'), [
        { text: t('common.keepEditing'), style: 'cancel' },
        {
          text: t('common.discard'),
          style: 'destructive',
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });
  }, [isDirty, navigation, t]);
}
