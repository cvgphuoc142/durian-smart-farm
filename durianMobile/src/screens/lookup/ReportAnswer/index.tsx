import { useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { chatApi } from '@/api';
import {
  Button,
  Card,
  EmptyState,
  Header,
  InfoBanner,
  Screen,
  Text,
  TextInput,
  useToast,
} from '@/components/ui';
import { useApiErrorMessage, useIsOnline } from '@/hooks';
import type { RootStackParamList } from '@/navigation/types';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useChatMessages } from '@/stores';
import { spacing } from '@/theme';

/**
 * SC-20: report one answer. The farmer sees exactly what will be sent (the question, the answer
 * and its sources) and confirms; nothing else of the chat or the farm goes along (FR-C08). One tap
 * sends one report, and a failed send is not repeated by itself.
 */
export function ReportAnswer() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const toast = useToast();
  const online = useIsOnline();
  const errorText = useApiErrorMessage();
  const { messageId } = useRoute<RouteProp<RootStackParamList, 'ReportAnswer'>>().params;
  const messages = useChatMessages();
  const [reason, setReason] = useState('');
  const sending = useRef(false);

  const index = messages.findIndex((m) => m.id === messageId);
  const answer = index >= 0 ? messages[index] : null;
  // The question is the user turn right before the answer.
  const asked = index > 0 && messages[index - 1].role === 'user' ? messages[index - 1] : null;

  const send = useMutation({
    mutationFn: () =>
      chatApi.report({
        question: asked?.text ?? '',
        answer: answer?.text ?? '',
        citations: answer?.response?.citations ?? [],
        reason: reason.trim() || null,
      }),
    onError: (e) => toast.show(errorText(e), 'error'),
    onSettled: () => {
      sending.current = false;
    },
  });

  const header = (
    <Header title={t('screens.ReportAnswer')} variant="back" onBack={() => nav.goBack()} />
  );

  if (!answer || !asked) {
    return (
      <Screen header={header}>
        <View testID="screen-ReportAnswer">
          <EmptyState icon="chat" title={t('report.gone')} />
        </View>
      </Screen>
    );
  }

  const confirm = () => {
    if (sending.current || send.isSuccess) return;
    if (!online) {
      toast.show(t('errors.needsNetwork'), 'error');
      return;
    }
    sending.current = true;
    send.mutate();
  };

  const citations = answer.response?.citations ?? [];

  return (
    <Screen
      header={header}
      footer={
        send.isSuccess ? (
          <Button label={t('common.done')} onPress={() => nav.goBack()} />
        ) : (
          <Button
            icon="send"
            label={t('report.confirm')}
            loading={send.isPending}
            onPress={confirm}
          />
        )
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}
    >
      <View testID="screen-ReportAnswer" style={{ gap: spacing.md }}>
        {send.isSuccess ? (
          <InfoBanner tone="info" icon="check" text={t('report.sent')} />
        ) : (
          <InfoBanner tone="info" text={t('report.preview')} />
        )}
        <Card>
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" color="textMuted">
              {t('report.question')}
            </Text>
            <Text variant="body">{asked.text}</Text>
            <Text variant="label" color="textMuted">
              {t('report.answer')}
            </Text>
            <Text variant="body">{answer.text || t('chat.noAnswer')}</Text>
            <Text variant="label" color="textMuted">
              {t('report.sources')}
            </Text>
            {citations.length === 0 ? (
              <Text variant="secondary">{t('report.noSources')}</Text>
            ) : (
              citations.map((c) => (
                <Text
                  key={`${c.article_id}-${c.version_id}-${c.translation_revision}`}
                  variant="secondary"
                >
                  {`${c.title} · v${c.version_no}`}
                </Text>
              ))
            )}
          </View>
        </Card>
        {send.isSuccess ? null : (
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('report.reasonPlaceholder')}
            accessibilityLabel={t('report.reason')}
            multiline
          />
        )}
      </View>
    </Screen>
  );
}
