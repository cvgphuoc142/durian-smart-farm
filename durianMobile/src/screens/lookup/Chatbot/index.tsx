import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ArticleCard, CitationChip } from '@/components/domain';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  InfoBanner,
  ListGroup,
  Screen,
  Text,
  TextInput,
  useToast,
} from '@/components/ui';
import {
  useAiConsent,
  useApiErrorMessage,
  useArticleList,
  useAsk,
  useFormat,
  useSeasonLite,
  useUnsyncedScanCount,
} from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useChatMessages } from '@/stores';
import { getDraft, useDraftStore } from '@/stores/draftStore';
import { colors, radius, spacing } from '@/theme';
import type { ChatMessage } from '@/types';

const DRAFT_KEY = 'chat';
/** A farm snapshot older than this is called out as possibly out of date (FR-C06). */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Typing must not wait on a persisted-store write: a slow keystroke breaks Vietnamese Telex/VNI. */
const DRAFT_SAVE_DELAY_MS = 500;

const saveDraft = (question: string) => {
  const store = useDraftStore.getState();
  if (question.trim()) store.saveDraft(DRAFT_KEY, { question });
  else store.clearDraft(DRAFT_KEY);
};

/**
 * SC-19: ask the chatbot about articles, the season and the cases. It is online-only and needs
 * the farmer's consent to the external AI service. Without either, the same box searches the
 * downloaded articles, the typed question stays as a draft, and nothing is sent when the network
 * returns (FR-C06, C07).
 */
export function Chatbot() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const toast = useToast();
  const errorText = useApiErrorMessage();
  const messages = useChatMessages();
  const ask = useAsk();
  const consent = useAiConsent();
  const { season, asOf } = useSeasonLite();
  const unsynced = useUnsyncedScanCount();

  const [question, setQuestion] = useState(() => String(getDraft(DRAFT_KEY)?.question ?? ''));
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ question: string; message: string } | null>(null);
  const [searched, setSearched] = useState('');

  const canAsk = ask.online && consent.consented;
  const results = useArticleList({ text: searched });

  const scroller = useRef<ScrollView>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(question);
  latest.current = question;

  // Show the newest message: the question just sent, then its answer or the failure card.
  useEffect(() => {
    const id = requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(id);
  }, [messages.length, pending, failed]);

  const change = (text: string) => {
    setQuestion(text);
    latest.current = text;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => saveDraft(latest.current), DRAFT_SAVE_DELAY_MS);
  };

  // Leaving the screen saves what is typed right away.
  useEffect(
    () => () => {
      if (draftTimer.current) {
        clearTimeout(draftTimer.current);
        saveDraft(latest.current);
      }
    },
    [],
  );

  /** A question that did not get an answer goes back in the box, unless the farmer typed anew. */
  const restore = (q: string) => {
    if (latest.current.trim()) return;
    setQuestion(q);
    latest.current = q;
    saveDraft(q);
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setFailed(null);
    setPending(q);
    // The box empties as soon as the question is sent; a failed send puts it back (see catch).
    clearTimeout(draftTimer.current);
    draftTimer.current = undefined;
    setQuestion('');
    latest.current = '';
    saveDraft('');
    try {
      const reply = await ask.send(q);
      if (!reply) restore(q);
    } catch (e) {
      restore(q);
      // Kept as a draft; the farmer sends it again by hand. A refused consent is re-read first.
      if ((e as { code?: string }).code === 'ai_consent_required') void ask.me.refetch();
      setFailed({ question: q, message: errorText(e) });
    } finally {
      setPending(null);
    }
  };

  const grant = async () => {
    try {
      await consent.grant();
    } catch (e) {
      toast.show(errorText(e), 'error');
    }
  };

  const stale = (m: ChatMessage) => {
    const at = m.response?.context_as_of;
    if (!at) return true;
    return Date.now() - new Date(at).getTime() > STALE_AFTER_MS;
  };

  return (
    <Screen
      scrollRef={scroller}
      header={<Header title={t('screens.Chatbot')} variant="back" onBack={() => nav.goBack()} />}
      footer={
        <View style={{ gap: spacing.sm }}>
          <TextInput
            value={question}
            onChangeText={change}
            placeholder={t(canAsk ? 'chat.placeholder' : 'chat.searchPlaceholder')}
            accessibilityLabel={t('chat.input')}
            multiline
            autoCorrect={false}
          />
          {canAsk ? (
            <Button
              icon="send"
              label={t('chat.send')}
              loading={ask.isPending}
              disabled={question.trim() === ''}
              onPress={() => void send(question)}
            />
          ) : (
            <Button
              icon="search"
              label={t('chat.search')}
              disabled={question.trim() === ''}
              onPress={() => setSearched(question)}
            />
          )}
        </View>
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}
    >
      <View testID="screen-Chatbot" style={{ gap: spacing.md }}>
        {!ask.online ? (
          <InfoBanner tone="warning" icon="wifiOff" text={t('chat.offline')} />
        ) : ask.me.data && !consent.consented ? (
          <Card variant="info">
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">{t('chat.consentTitle')}</Text>
              <Text variant="secondary">{t('chat.consentBody')}</Text>
              <Button
                size="md"
                label={t('chat.consentGrant')}
                loading={consent.busy}
                onPress={() => void grant()}
              />
              <Button
                size="md"
                variant="ghost"
                label={t('screens.Settings')}
                onPress={() => nav.navigate('Settings')}
              />
            </View>
          </Card>
        ) : null}

        {canAsk && season ? (
          <Text variant="caption" color="textMuted">
            {t('chat.context', { season: season.name })}
          </Text>
        ) : null}
        {canAsk && unsynced > 0 ? (
          <InfoBanner tone="warning" icon="cloud" text={t('chat.unsynced', { count: unsynced })} />
        ) : null}

        {messages.length === 0 && !pending && canAsk ? (
          <EmptyState icon="chat" title={t('chat.emptyTitle')} body={t('chat.emptyBody')} />
        ) : null}

        {messages.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={[styles.bubble, styles.mine]}>
              <Text variant="body" color="white">
                {m.text}
              </Text>
            </View>
          ) : (
            <View key={m.id} style={{ gap: spacing.sm }}>
              <View style={[styles.bubble, styles.theirs]}>
                {m.response?.status === 'insufficient_sources' ? (
                  <Badge label={t('chat.insufficient')} tone="warning" icon="alert" />
                ) : null}
                <Text variant="body">{m.text || t('chat.noAnswer')}</Text>
                {m.response && m.response.citations.length > 0 ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text variant="label" color="textMuted">
                      {t('chat.sources')}
                    </Text>
                    {m.response.citations.map((c) => (
                      <CitationChip
                        key={`${c.article_id}-${c.version_id}`}
                        citation={c}
                        onPress={() =>
                          nav.navigate('Article', {
                            articleId: c.article_id,
                            versionId: c.version_id,
                          })
                        }
                      />
                    ))}
                  </View>
                ) : null}
                <Text variant="caption" color="textMuted">
                  {m.response?.context_as_of
                    ? t('chat.asOf', { at: f.dateTime(m.response.context_as_of) })
                    : t('chat.noContext')}
                </Text>
                {m.response && (stale(m) || unsynced > 0) ? (
                  <InfoBanner
                    tone="warning"
                    icon="clock"
                    text={t(unsynced > 0 ? 'chat.unsynced' : 'chat.stale', { count: unsynced })}
                  />
                ) : null}
              </View>
              <Button
                size="md"
                variant="outline"
                icon="alert"
                label={t('chat.report')}
                onPress={() => nav.navigate('ReportAnswer', { messageId: m.id })}
                style={styles.report}
              />
            </View>
          ),
        )}

        {pending ? (
          <View style={[styles.bubble, styles.mine]}>
            <Text variant="body" color="white">
              {pending}
            </Text>
          </View>
        ) : null}

        {failed ? (
          <Card variant="danger">
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">{t('chat.failed')}</Text>
              <Text variant="secondary">{failed.message}</Text>
              <Text variant="secondary" color="textMuted">
                {failed.question}
              </Text>
              <Button
                size="md"
                icon="refresh"
                label={t('common.retry')}
                disabled={!canAsk}
                onPress={() => void send(failed.question)}
              />
            </View>
          </Card>
        ) : null}

        {!canAsk && searched.trim() ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="heading" accessibilityRole="header">
              {t('chat.searchResults')}
            </Text>
            {results.data.length === 0 ? (
              <EmptyState
                icon="search"
                title={t('knowledge.noMatchTitle')}
                body={t('knowledge.noMatchBody')}
              />
            ) : (
              <ListGroup>
                {results.data.map((a) => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    onPress={() => nav.navigate('Article', { articleId: a.id })}
                  />
                ))}
              </ListGroup>
            )}
          </View>
        ) : null}

        <Text variant="caption" color="textMuted">
          {asOf ? t('chat.syncedAt', { at: f.dateTime(asOf) }) : t('chat.neverSynced')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { padding: spacing.md, borderRadius: radius.card, gap: spacing.sm, maxWidth: '92%' },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  report: { alignSelf: 'flex-start' },
});
