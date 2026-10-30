import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, fontFamily, radius, spacing } from '@/theme';

import { Text } from './Text';

/** Inline `**bold**`, `*italic*` / `_italic_` and `code`; anything else stays plain text. */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text key={i} variant="bodyStrong">
          {inline(part.slice(2, -2))}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <Text key={i} style={styles.code}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (
      ((part.startsWith('*') && part.endsWith('*')) ||
        (part.startsWith('_') && part.endsWith('_'))) &&
      part.length > 2
    ) {
      return (
        <Text key={i} style={styles.italic}>
          {inline(part.slice(1, -1))}
        </Text>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string };

const HEADING = /^#{1,6}\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fence: string[] | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', text: para.join('\n') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ...list });
    list = null;
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (fence) {
        blocks.push({ type: 'code', text: fence.join('\n') });
        fence = null;
      } else {
        flushPara();
        flushList();
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(line);
      continue;
    }
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: 'heading', text: heading[1] });
    } else if (bullet || numbered) {
      flushPara();
      const ordered = !bullet;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`; // a wrapped list item
    } else {
      flushList();
      para.push(line);
    }
  }
  if (fence) blocks.push({ type: 'code', text: fence.join('\n') });
  flushPara();
  flushList();
  return blocks;
}

export interface MarkdownProps {
  children: string;
  color?: 'text' | 'white';
}

/** A small, dependency-free renderer for the subset of Markdown the chatbot answers with. */
export function Markdown({ children, color = 'text' }: MarkdownProps) {
  return (
    <View style={styles.root}>
      {parse(children).map((b, i) => {
        switch (b.type) {
          case 'heading':
            return (
              <Text key={i} variant="bodyStrong" color={color} accessibilityRole="header">
                {inline(b.text)}
              </Text>
            );
          case 'code':
            return (
              <View key={i} style={styles.codeBlock}>
                <Text style={styles.code}>{b.text}</Text>
              </View>
            );
          case 'list':
            return (
              <View key={i} style={styles.list}>
                {b.items.map((item, n) => (
                  <View key={n} style={styles.item}>
                    <Text color={color} style={styles.marker}>
                      {b.ordered ? `${n + 1}.` : '•'}
                    </Text>
                    <Text color={color} style={styles.flex}>
                      {inline(item)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          default:
            return (
              <Text key={i} color={color}>
                {inline(b.text)}
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  list: { gap: spacing.xs },
  item: { flexDirection: 'row', gap: spacing.sm },
  marker: { minWidth: 18 },
  flex: { flex: 1 },
  italic: { fontStyle: 'italic', fontFamily: fontFamily.regular },
  code: { fontFamily: 'Courier', backgroundColor: colors.surfaceMuted },
  codeBlock: {
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceMuted,
  },
});
