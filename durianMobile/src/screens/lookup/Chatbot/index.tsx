import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ArticleCard, CitationChip } from '@/components/domain';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Icon,
  Header,
  IconButton,
  ListGroup,
  Markdown,
  Screen,
  Text,
  TextInput,
  useToast,
} from '@/components/ui';
import { useAiConsent, useApiErrorMessage, useArticleList, useAsk } from '@/hooks';
import type { RootStackParamList } from '@/navigation/types';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { openExternal } from '@/services';
import { useChatMessages, useChatStore } from '@/stores';
import { getDraft, useDraftStore } from '@/stores/draftStore';
import { colors, radius, spacing } from '@/theme';
import type { Citation } from '@/types';

const DRAFT_KEY = 'chat';
/** A farm snapshot older than this is called out as possibly out of date (FR-C06). */

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
  const nav = useAppNavigation();
  // Set when opened from a scan result: the answer then draws on that case.
  const params = useRoute<RouteProp<RootStackParamList, 'Chatbot'>>().params;
  const caseId = params?.caseId;
  const toast = useToast();
  const openOriginal = async (url: string) => {
    if (!(await openExternal(url))) toast.show(t('content.cannotOpen'), 'error');
  };
  const errorText = useApiErrorMessage();
  const messages = useChatMessages();
  const ask = useAsk();
  const consent = useAiConsent();

  const [question, setQuestion] = useState(
    () => params?.prefill ?? String(getDraft(DRAFT_KEY)?.question ?? ''),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ question: string; message: string } | null>(null);
  const [searched, setSearched] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const canAsk = ask.online && consent.consented;
  const results = useArticleList({ text: searched });

  const scroller = useRef<ScrollView>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(question);
  latest.current = question;

  // The screen can be reused with new params, so a prefilled question is applied on every change.
  useEffect(() => {
    if (!params?.prefill) return;
    setQuestion(params.prefill);
    latest.current = params.prefill;
  }, [params?.prefill]);

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
      const reply = await ask.send(q, caseId);
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

  return (
    <Screen
      scrollRef={scroller}
      header={
        <Header
          title={t('screens.Chatbot')}
          variant="back"
          onBack={() => nav.goBack()}
          right={
            messages.length > 0 ? (
              <IconButton
                icon="trash"
                variant="outline"
                accessibilityLabel={t('chat.reset')}
                onPress={() => setConfirmReset(true)}
              />
            ) : undefined
          }
        />
      }
      footer={
        <TextInput
          value={question}
          onChangeText={change}
          placeholder={t(canAsk ? 'chat.placeholder' : 'chat.searchPlaceholder')}
          accessibilityLabel={t('chat.input')}
          multiline
          autoCorrect={false}
          style={styles.input}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(canAsk ? 'chat.send' : 'chat.search')}
              accessibilityState={{ disabled: question.trim() === '' || ask.isPending }}
              disabled={question.trim() === '' || ask.isPending}
              onPress={() => (canAsk ? void send(question) : setSearched(question))}
              style={({ pressed }) => [
                styles.sendButton,
                (question.trim() === '' || ask.isPending) && styles.sendDisabled,
                pressed && styles.sendPressed,
              ]}
            >
              {ask.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Icon name={canAsk ? 'send' : 'search'} size={20} color="white" />
              )}
            </Pressable>
          }
        />
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}
    >
      <View testID="screen-Chatbot" style={{ gap: spacing.md }}>
        {ask.online && ask.me.data && !consent.consented ? (
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
                <Markdown>{m.text || t('chat.noAnswer')}</Markdown>
                {m.response && m.response.citations.length > 0 ? (
                  <Sources
                    citations={m.response.citations}
                    onOpen={(c) =>
                      nav.navigate('Article', { articleId: c.article_id, versionId: c.version_id })
                    }
                    onOpenOriginal={(c) => void openOriginal(c.source_links[0])}
                  />
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chat.report')}
                hitSlop={8}
                onPress={() => nav.navigate('ReportAnswer', { messageId: m.id })}
                style={styles.report}
              >
                <Icon name="alert" size={14} color="textMuted" />
                <Text variant="caption" color="textMuted">
                  {t('chat.report')}
                </Text>
              </Pressable>
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

        <ConfirmDialog
          visible={confirmReset}
          title={t('chat.resetTitle')}
          message={t('chat.resetMessage')}
          confirmLabel={t('chat.resetConfirm')}
          destructive
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false);
            useChatStore.getState().reset();
            setFailed(null);
          }}
        />

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
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  input: { minHeight: 40, maxHeight: 120 },
  sendButton: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sendDisabled: { opacity: 0.4 },
  sendPressed: { opacity: 0.7 },
  report: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
});

/** The sources of one answer, folded away until the farmer taps to see them. */
function Sources({
  citations,
  onOpen,
  onOpenOriginal,
}: {
  citations: Citation[];
  onOpen: (c: Citation) => void;
  onOpenOriginal: (c: Citation) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('chat.sources')}
        hitSlop={8}
        onPress={() => setOpen((v) => !v)}
        style={styles.toggle}
      >
        <Text variant="caption" color="textMuted">
          {`${t('chat.sources')} (${citations.length})`}
        </Text>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} color="textMuted" />
      </Pressable>
      {open
        ? citations.map((c) => (
            <CitationChip
              key={`${c.article_id}-${c.version_id}`}
              citation={c}
              onPress={() => onOpen(c)}
              onOpenOriginal={() => onOpenOriginal(c)}
            />
          ))
        : null}
    </View>
  );
}
